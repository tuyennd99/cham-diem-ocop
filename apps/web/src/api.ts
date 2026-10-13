import { getSession, setSession } from "./auth";

export interface ApiResult<T> {
  data: T;
  meta?: { page: number; limit: number; total: number; totalPages: number };
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

const apiBase = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

export async function api<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const headers = new Headers(init.headers);
  const session = getSession();
  if (session?.accessToken) headers.set("Authorization", `Bearer ${session.accessToken}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${apiBase}${path}`, { ...init, headers });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && session) {
      setSession(null);
      window.location.replace("/login");
    }
    const message = typeof body === "object" && body !== null && "message" in body && typeof body.message === "string"
      ? body.message
      : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }
  if (typeof body === "object" && body !== null && "data" in body) {
    return { data: body.data as T, ...( "meta" in body ? { meta: body.meta as ApiResult<T>["meta"] } : {}) };
  }
  return { data: body as T };
}

export async function apiBlob(path: string): Promise<Blob> {
  const headers = new Headers();
  const session = getSession();
  if (session?.accessToken) headers.set("Authorization", `Bearer ${session.accessToken}`);
  const response = await fetch(`${apiBase}${path}`, { headers });
  if (!response.ok) {
    if (response.status === 401 && session) {
      setSession(null);
      window.location.replace("/login");
    }
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new ApiError(body?.message ?? `Request failed (${response.status})`, response.status);
  }
  return response.blob();
}

export function jsonBody(value: unknown): string {
  return JSON.stringify(value);
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Có lỗi xảy ra. Vui lòng thử lại.";
}
