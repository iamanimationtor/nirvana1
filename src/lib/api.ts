/* ─────────────────────────────────────────────────────────────
 *  API client
 *  Talks to the PHP backend under /api. If the backend is not
 *  reachable (e.g. static preview), it transparently falls back
 *  to an in-browser demo backend so the whole store stays usable.
 * ───────────────────────────────────────────────────────────── */
import { demoHandle } from "./demo-backend";

export const API_BASE =
  (typeof window !== "undefined" && window.NIRVANA?.apiBase) ||
  ((import.meta as any)?.env?.VITE_API_BASE as string | undefined) ||
  "/api";

export class ApiError extends Error {
  constructor(message: string, public status = 400, public code = "error") {
    super(message);
  }
}

let backendState: "unknown" | "live" | "demo" = "unknown";
export const isDemoBackend = () => backendState === "demo";

type Method = "GET" | "POST" | "PUT" | "DELETE";

export async function api<T = unknown>(method: Method, path: string, body?: unknown, opts: { form?: FormData; idempotencyKey?: string; orderToken?: string } = {}): Promise<T> {
  if (backendState === "demo") {
    // Forward idempotency/orderToken via body/query for demo backend simulation
    let demoPath = path;
    let demoBody: unknown = body;
    if (opts.orderToken && method === "GET" && path.startsWith("/orders/")) {
      const sep = demoPath.includes("?") ? "&" : "?";
      demoPath = `${demoPath}${sep}token=${encodeURIComponent(opts.orderToken)}`;
    }
    if (opts.idempotencyKey && body && typeof body === "object" && !Array.isArray(body)) {
      demoBody = { ...(body as Record<string, unknown>), idempotencyKey: opts.idempotencyKey } as unknown;
    }
    return demoHandle<T>(method, demoPath, demoBody, opts.form);
  }
  try {
    const headers: Record<string, string> = {
        "X-Requested-With": "nirvana",
        ...(opts.form ? {} : { "Content-Type": "application/json" }),
      };
    if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
    if (opts.orderToken) headers["X-Order-Token"] = opts.orderToken;
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: "same-origin",
      headers,
      body: opts.form ? opts.form : body !== undefined ? JSON.stringify(body) : undefined,
    });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) throw new TypeError("non-json");
    const data = (await res.json()) as { ok: boolean; error?: string; code?: string } & T;
    backendState = "live";
    if (!res.ok || data.ok === false) throw new ApiError(data.error || "خطای سرور", res.status, data.code || "error");
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    // Only static/dev previews may fall back. Production must expose a visible
    // backend error instead of silently accepting orders into localStorage.
    const allowDemo = typeof window !== "undefined"
      ? window.NIRVANA?.demoFallback ?? ((import.meta as any)?.env?.DEV ?? false)
      : false;
    if (backendState !== "live" && allowDemo) {
      backendState = "demo";
      return demoHandle<T>(method, path, body, opts.form);
    }
    throw new ApiError("ارتباط با سرور برقرار نشد", 0, "network");
  }
}

export const get = <T,>(p: string, opts?: { orderToken?: string }) => api<T>("GET", p, undefined, { orderToken: opts?.orderToken });
export const post = <T,>(p: string, b?: unknown, opts?: { idempotencyKey?: string }) => api<T>("POST", p, b, { idempotencyKey: opts?.idempotencyKey });
export const put = <T,>(p: string, b?: unknown) => api<T>("PUT", p, b);
export const del = <T,>(p: string) => api<T>("DELETE", p);
// Extra helper for GET with token
export const getWithToken = <T,>(p: string, token?: string) => api<T>("GET", p, undefined, { orderToken: token });
