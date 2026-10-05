export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string>; authExpired?: boolean };

export class ValidationError extends Error {
  constructor(public fieldErrors: Record<string, string>, message = "Please fix the highlighted fields.") {
    super(message);
  }
}
export class AdminAuthError extends Error {
  constructor() {
    super("Not authenticated");
  }
}
