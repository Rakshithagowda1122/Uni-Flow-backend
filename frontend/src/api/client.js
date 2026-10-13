const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1"
).replace(/\/+$/, "");
const apiBaseUrl = new URL(API_BASE_URL);

if (apiBaseUrl.port === "3000") {
  throw new Error(
    "VITE_API_BASE_URL must point to the FastAPI backend, not the frontend on port 3000.",
  );
}

export function clearClientSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("token");
  window.localStorage.removeItem("user");
  window.dispatchEvent(new Event("uniflow:session-ended"));
}

export async function apiRequest(endpoint, options = {}) {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("token");
  }

  const headers = new Headers(options.headers || {});
  headers.delete("Authorization");
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${normalizedEndpoint}`, {
      ...options,
      headers,
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "Cannot connect to server. Ensure FastAPI backend is running on port 8000.",
    );
  }

  if (
    response.status === 401 &&
    !normalizedEndpoint.includes("/auth/login") &&
    typeof window !== "undefined"
  ) {
    clearClientSession();
    if (window.location.pathname !== "/login") {
      window.location.replace("/login");
    }
  }

  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  const result = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const detail = result?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : detail?.message ||
          `API request failed with status ${response.status}.`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return result;
}
