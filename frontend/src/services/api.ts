import axios from "axios";

/**
 * Robustly extract a user-friendly error string from various FastAPI response payloads:
 * - String details: "Không tìm thấy giao dịch"
 * - Object details (Rate Limit 429): { success: false, message: "...", retry_after_seconds: ... }
 * - Array details (Pydantic validation errors): [{ loc: [...], msg: "..." }]
 * - Standard message fields: { message: "..." }
 */
export function extractErrorMessage(error: any): string {
  const data = error.response?.data;
  if (!data) {
    return error.message || "An unexpected network error occurred.";
  }

  const detail = data.detail;

  // 1. Array format (FastAPI Pydantic RequestValidationError)
  if (Array.isArray(detail)) {
    const errorMsgs = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const field = Array.isArray(item.loc) ? item.loc.slice(1).join(".") : "";
          const msg = item.msg || item.message || JSON.stringify(item);
          return field ? `${field}: ${msg}` : msg;
        }
        return String(item);
      })
      .filter(Boolean);
    if (errorMsgs.length > 0) {
      return errorMsgs.join("; ");
    }
  }

  // 2. Object format (e.g. Rate Limit 429 error payload: { success: false, message: ... })
  if (detail && typeof detail === "object") {
    if (typeof detail.message === "string" && detail.message.trim()) {
      return detail.message.trim();
    }
    try {
      return JSON.stringify(detail);
    } catch {
      return "Rate limit or request error";
    }
  }

  // 3. String detail
  if (typeof detail === "string" && detail.trim()) {
    return detail.trim();
  }

  // 4. Fallback to data.message (e.g. FastAPI global exception handler)
  if (typeof data.message === "string" && data.message.trim()) {
    return data.message.trim();
  }

  return error.message || "An unexpected network error occurred.";
}

export const api = axios.create({
  baseURL: "/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

api.interceptors.response.use(
  (response: any) => response,
  (error: any) => {
    const message = extractErrorMessage(error);
    console.error("[API Error]", message, error);
    return Promise.reject(new Error(message));
  }
);

export default api;
