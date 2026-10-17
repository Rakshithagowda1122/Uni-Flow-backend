export const config = {
  api: {
    bodyParser: false,
  },
};

const ALLOWED_METHODS = new Set([
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function respondWithError(response, status, detail) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify({ detail }));
}

export default async function handler(request, response) {
  if (!ALLOWED_METHODS.has(request.method)) {
    response.setHeader("Allow", [...ALLOWED_METHODS].join(", "));
    respondWithError(response, 405, "This API request method is not supported.");
    return;
  }

  const rawBackendOrigin =
    process.env.API_BASE_URL ||
    process.env.VITE_API_BASE_URL ||
    "https://uni-flow-backend.onrender.com";

  let backend;
  try {
    const formatted =
      rawBackendOrigin.startsWith("http://") ||
      rawBackendOrigin.startsWith("https://")
        ? rawBackendOrigin
        : `https://${rawBackendOrigin}`;
    backend = new URL(formatted);
  } catch {
    respondWithError(response, 500, "The API proxy URL is invalid.");
    return;
  }

  if (backend.protocol !== "https:" && backend.hostname !== "localhost" && backend.hostname !== "127.0.0.1") {
    respondWithError(
      response,
      500,
      "API_BASE_URL must be an HTTPS backend origin.",
    );
    return;
  }

  const backendOrigin = backend.origin;

  const requestUrl = new URL(request.url, "https://vercel.invalid");
  const routePath = requestUrl.searchParams.get("path") || "";
  const routeParts = routePath.split("/").filter(Boolean);
  const isHealthCheck = routeParts.length === 1 && routeParts[0] === "health";
  const isApiRoute = routeParts[0] === "v1" && routeParts.length > 1;
  if (!isHealthCheck && !isApiRoute) {
    respondWithError(response, 404, "The requested API route does not exist.");
    return;
  }

  const upstreamPath = isHealthCheck
    ? "/health"
    : `/api/${routeParts.join("/")}`;
  requestUrl.searchParams.delete("path");
  const upstreamUrl = new URL(upstreamPath, backendOrigin);
  upstreamUrl.search = requestUrl.searchParams.toString();

  const upstreamHeaders = new Headers();
  for (const name of ["accept", "content-type", "cookie", "origin", "authorization"]) {
    const value = request.headers[name];
    if (typeof value === "string") upstreamHeaders.set(name, value);
  }

  try {
    const body =
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await readRequestBody(request);
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers: upstreamHeaders,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(25_000),
    });

    response.statusCode = upstream.status;
    for (const name of ["cache-control", "content-type", "location"]) {
      const value = upstream.headers.get(name);
      if (value) response.setHeader(name, value);
    }

    const cookies = upstream.headers.getSetCookie?.() ?? [];
    if (cookies.length) response.setHeader("Set-Cookie", cookies);

    if (request.method === "HEAD" || upstream.status === 204) {
      response.end();
      return;
    }

    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    console.error("UniFlow API proxy request failed.", error);
    respondWithError(
      response,
      502,
      "The API service could not be reached. Check the backend deployment and its logs.",
    );
  }
}
