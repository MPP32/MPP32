const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "";

// Shape of backend error envelope: { error: { message, code?, fields? } }
export interface ApiFieldError {
  path: string;
  message: string;
}

export interface ApiErrorDetails {
  message: string;
  code?: string;
  fields?: ApiFieldError[];
}

class ApiError extends Error {
  public details?: ApiErrorDetails;
  constructor(
    message: string,
    public status: number,
    public data?: unknown,
    details?: ApiErrorDetails
  ) {
    super(message);
    this.name = "ApiError";
    this.details = details;
  }
}

// Response envelope type - all app routes return { data: T }
interface ApiResponse<T> {
  data: T;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const config: RequestInit = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    credentials: "include",
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    const errorObj = json?.error;
    const details: ApiErrorDetails | undefined =
      errorObj && typeof errorObj === "object" && typeof errorObj.message === "string"
        ? {
            message: errorObj.message,
            code: typeof errorObj.code === "string" ? errorObj.code : undefined,
            fields: Array.isArray(errorObj.fields)
              ? errorObj.fields
                  .filter(
                    (f: unknown): f is ApiFieldError =>
                      typeof f === "object" &&
                      f !== null &&
                      typeof (f as ApiFieldError).path === "string" &&
                      typeof (f as ApiFieldError).message === "string"
                  )
              : undefined,
          }
        : undefined;
    throw new ApiError(
      // Try app-route format first, fallback to generic message (Better Auth uses this)
      json?.error?.message || json?.message || `Request failed with status ${response.status}`,
      response.status,
      json?.error || json,
      details
    );
  }

  // 1. Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  // 2. JSON responses: parse and unwrap { data }
  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    const json: ApiResponse<T> = await response.json();
    return json.data;
  }

  // 3. Non-JSON: return undefined (caller should use api.raw() for these)
  return undefined as T;
}

// Raw request for non-JSON endpoints (uploads, downloads, streams)
async function rawRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const url = `${API_BASE_URL}${endpoint}`;
  const config: RequestInit = {
    ...options,
    headers: {
      ...options.headers,
    },
    credentials: "include",
  };
  return fetch(url, config);
}

export const api = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(endpoint: string, data?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(endpoint: string, data?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(endpoint: string, data?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: "DELETE" }),

  // Escape hatch for non-JSON endpoints
  raw: rawRequest,
};

export { ApiError };
