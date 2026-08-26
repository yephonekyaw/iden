import { AxiosError } from "axios";
import type { components } from "./schema";

export type ErrorBody = components["schemas"]["ErrorResponse"];

/** One field-level message from a 422, e.g. `{ field: "body.email", … }`. */
export interface FieldError {
  field: string;
  message: string;
}

/**
 * Every failure the provider can return, in one shape.
 *
 * `core/errors.py` guarantees `{ code, message, details }` for everything
 * outside `/oauth2/*`, and re-serialises bare `HTTPException`s into it too — so
 * a screen never has to guess whether it got a domain error or a framework one.
 */
export class IdenError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown>;
  /** Seconds to wait, from `Retry-After` on a 429 or 503. */
  readonly retryAfter: number | null;

  constructor(init: {
    code: string;
    message: string;
    status: number;
    details?: Record<string, unknown>;
    retryAfter?: number | null;
  }) {
    super(init.message);
    this.name = "IdenError";
    this.code = init.code;
    this.status = init.status;
    this.details = init.details ?? {};
    this.retryAfter = init.retryAfter ?? null;
  }

  /**
   * The 422 field errors, with the `body.` prefix stripped so the names match
   * the form fields react-hook-form registered.
   */
  get fieldErrors(): FieldError[] {
    const fields = this.details.fields;
    if (!Array.isArray(fields)) return [];
    return fields.flatMap((entry) => {
      if (typeof entry !== "object" || entry === null) return [];
      const { field, message } = entry as Record<string, unknown>;
      if (typeof field !== "string" || typeof message !== "string") return [];
      return [{ field: field.replace(/^body\./, ""), message }];
    });
  }

  /**
   * RFC 9470: the resource server is asking for a more recent sign-in, and says
   * how recent in the `WWW-Authenticate` challenge. Returns the required age in
   * seconds, or null when this is an ordinary 403.
   */
  get stepUpMaxAge(): number | null {
    if (this.status !== 403) return null;
    const value = this.details.wwwAuthenticate;
    if (typeof value !== "string") return null;
    if (!value.includes("insufficient_user_authentication")) return null;
    const match = /max_age=(\d+)/.exec(value);
    return match?.[1] ? Number(match[1]) : null;
  }
}

function parseRetryAfter(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? seconds : null;
}

/** Narrows anything axios throws into an IdenError. */
export function toIdenError(error: unknown): IdenError {
  if (error instanceof IdenError) return error;

  if (error instanceof AxiosError) {
    const response = error.response;
    if (!response) {
      return new IdenError({
        code: "network_error",
        message: "Could not reach the server. Check your connection and try again.",
        status: 0,
      });
    }

    const body: unknown = response.data;
    const isErrorBody =
      typeof body === "object" &&
      body !== null &&
      typeof (body as ErrorBody).code === "string" &&
      typeof (body as ErrorBody).message === "string";

    // `/oauth2/*` answers RFC 6749 `{ error, error_description }` instead.
    const oauth =
      typeof body === "object" &&
      body !== null &&
      typeof (body as { error?: unknown }).error === "string"
        ? (body as { error: string; error_description?: string })
        : null;

    const headers = response.headers as Record<string, unknown>;
    return new IdenError({
      code: isErrorBody ? (body as ErrorBody).code : (oauth?.error ?? "error"),
      message: isErrorBody
        ? (body as ErrorBody).message
        : (oauth?.error_description ?? "Something went wrong."),
      status: response.status,
      details: {
        ...(isErrorBody ? ((body as ErrorBody).details ?? {}) : {}),
        wwwAuthenticate: headers["www-authenticate"],
      },
      retryAfter: parseRetryAfter(headers["retry-after"]),
    });
  }

  return new IdenError({
    code: "error",
    message: error instanceof Error ? error.message : "Something went wrong.",
    status: 0,
  });
}
