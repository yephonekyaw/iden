import type { ReactNode } from "react";
import { IdenError } from "../api/errors";
import { Button } from "./button";
import { cn } from "./cn";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-lg border border-hairline bg-canvas p-8", className)}
      {...props}
    />
  );
}

/**
 * An empty list is an invitation to act, never "No data". The caller supplies
 * the action, because what to do next depends on what is empty.
 */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-hairline px-8 py-14 text-center">
      <p className="text-title-md text-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-prose text-body-sm text-body">{body}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

/**
 * Errors say what happened and what to do. The rate-limit and outage cases get
 * their own wording because "something went wrong" is wrong for both — the user
 * did nothing wrong, and waiting is the fix.
 */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const problem = error instanceof IdenError ? error : null;
  const wait = problem?.retryAfter;

  const message =
    problem?.status === 429
      ? `Too many attempts. Try again in ${wait ?? 60} seconds.`
      : problem?.status === 503
        ? "The server is not accepting requests right now. This is usually brief."
        : (problem?.message ?? "Something went wrong.");

  return (
    <div
      role="alert"
      className="rounded-lg border border-hairline bg-surface-soft px-6 py-5"
    >
      <p className="text-title-sm text-ink">{message}</p>
      {problem?.code && problem.status !== 429 ? (
        <p className="mt-1 text-caption text-muted">
          <span className="font-identity">{problem.code}</span>
        </p>
      ) : null}
      {onRetry ? (
        <Button className="mt-4" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-body-sm text-muted" role="status">
      <span
        aria-hidden="true"
        className="h-4 w-4 animate-spin rounded-full border-2 border-hairline border-t-primary"
      />
      {label}
    </div>
  );
}
