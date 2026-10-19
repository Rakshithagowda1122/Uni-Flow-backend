function getApiBaseUrl() {
  const envUrl = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");
  if (envUrl) {
    return envUrl.endsWith("/api/v1") ? envUrl : `${envUrl}/api/v1`;
  }
  return import.meta.env.PROD ? "/api/v1" : "http://localhost:8000/api/v1";
}

const API_BASE_URL = getApiBaseUrl();

export function clearClientSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("token");
  window.localStorage.removeItem("user");
  window.dispatchEvent(new Event("uniflow:session-ended"));
}

export async function checkApiHealth() {
  const healthUrl = API_BASE_URL.startsWith("/")
    ? "/api/health"
    : `${API_BASE_URL.replace(/\/api\/v1$/, "")}/health`;

  let response;
  try {
    response = await fetch(healthUrl, {
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "Cannot reach the API service. Confirm the backend is deployed and Vercel's API_BASE_URL is configured.",
    );
  }

  if (!response.ok) {
    throw new Error(`API health check failed with status ${response.status}.`);
  }

  return response.json();
}

export async function apiRequest(endpoint, options = {}) {
  const headers = new Headers(options.headers || {});

  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("token");
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

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
      "Cannot reach the UniFlow API service. Check the backend deployment and API_BASE_URL configuration.",
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
