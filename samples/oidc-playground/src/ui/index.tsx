import { useId, useState, type ComponentProps, type ReactNode } from "react";

/**
 * The playground's UI kit.
 *
 * Small on purpose and dependency-free: this sample should run after one
 * `pnpm install` with nothing from the rest of the repository. Every value here
 * is a DESIGN.md token defined in `theme.css`.
 */

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// --------------------------------------------------------------------------
// Controls
// --------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "onDark";

const BUTTON: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-on-primary hover:bg-primary-active disabled:bg-primary-disabled disabled:text-muted",
  secondary:
    "border border-hairline bg-canvas text-ink hover:bg-surface-soft disabled:text-muted-soft",
  ghost: "text-ink hover:bg-surface-soft disabled:text-muted-soft",
  onDark:
    "bg-surface-dark-elevated text-on-dark hover:bg-surface-dark-soft disabled:text-on-dark-soft",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: "md" | "sm" }) {
  return (
    <button
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium",
        "transition-colors duration-100 disabled:pointer-events-none disabled:cursor-not-allowed",
        "[&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
        size === "sm" ? "h-8 px-3 text-caption" : "h-control px-5 text-body-sm",
        BUTTON[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-control w-full rounded-md border border-hairline bg-canvas px-3.5 text-body-sm text-ink",
        "placeholder:text-muted-soft focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/15",
        "disabled:bg-surface-soft disabled:text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-control w-full rounded-md border border-hairline bg-canvas px-3 text-body-sm text-ink",
        "focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/15",
        className,
      )}
      {...props}
    />
  );
}

/** A label, its control, and the sentence that explains it. */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: (props: { id: string; "aria-describedby": string | undefined }) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-caption font-medium text-body-strong">
        {label}
      </label>
      {children({ id, "aria-describedby": hintId })}
      {hint ? (
        <p id={hintId} className="text-caption text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** A parameter that is either sent or not, where whether to send it is the point. */
export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
      />
      <div className="min-w-0">
        <label htmlFor={id} className="text-body-sm text-ink">
          {label}
        </label>
        {hint ? <p className="mt-0.5 text-caption text-muted">{hint}</p> : null}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Structure
// --------------------------------------------------------------------------

/**
 * One numbered stage of the flow.
 *
 * Numbered rather than tabbed because the protocol has an order and the
 * playground's whole job is to show it: you cannot exchange a code you have not
 * been given.
 */
export function Stage({
  step,
  title,
  lede,
  children,
  done,
  disabled,
}: {
  step: number;
  title: string;
  lede?: ReactNode;
  children: ReactNode;
  done?: boolean;
  disabled?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border bg-canvas p-6 sm:p-8",
        done ? "border-primary/40" : "border-hairline",
        disabled && "opacity-55",
      )}
      aria-disabled={disabled}
    >
      <header className="mb-6 flex items-start gap-4">
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-caption tabular-nums",
            done ? "bg-primary text-on-primary" : "border border-hairline text-muted",
          )}
        >
          {step}
        </span>
        <div className="min-w-0">
          <h2 className="text-title-lg text-ink">{title}</h2>
          {lede ? <p className="mt-1 max-w-prose text-body-sm text-muted">{lede}</p> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "coral" | "success" | "error" | "dark";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-surface-card text-body-strong",
    coral: "bg-primary text-on-primary uppercase text-caption-upper",
    success: "bg-success/15 text-success",
    error: "bg-error/12 text-error",
    dark: "bg-surface-dark-elevated text-on-dark-soft",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption whitespace-nowrap",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

/** A statement about the flow that is true or false right now. */
export function Check({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-body-sm">
      <span
        aria-hidden="true"
        className={cn("mt-2 h-1.5 w-1.5 shrink-0 rounded-full", ok ? "bg-success" : "bg-error")}
      />
      <span className={ok ? "text-body" : "text-error"}>{children}</span>
      <span className="sr-only">{ok ? "(passed)" : "(failed)"}</span>
    </li>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border-l-2 border-primary/50 bg-surface-soft px-4 py-3 text-body-sm text-body">
      {children}
    </p>
  );
}

// --------------------------------------------------------------------------
// Showing what went over the wire
// --------------------------------------------------------------------------

function Copy({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
      className="shrink-0 rounded-sm px-2 py-1 text-caption text-on-dark-soft hover:bg-surface-dark-elevated hover:text-on-dark"
    >
      {copied ? "Copied" : "Copy"}
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </button>
  );
}

/**
 * A dark panel holding something literal — a URL, a token, a JSON body.
 *
 * Wraps rather than scrolls: these are strings people read across, and a URL
 * you have to scroll sideways to see the end of is a URL you cannot check.
 */
export function Code({
  label,
  value,
  tone = "default",
}: {
  label?: string;
  value: string;
  tone?: "default" | "error";
}) {
  return (
    <div className="overflow-hidden rounded-lg bg-surface-dark">
      {label || value ? (
        <div className="flex items-center justify-between gap-3 border-b border-hairline-dark px-4 py-2">
          <span className="text-caption-upper uppercase text-on-dark-soft">{label}</span>
          <Copy value={value} />
        </div>
      ) : null}
      <pre
        className={cn(
          "font-identity overflow-x-auto px-4 py-3 text-code whitespace-pre-wrap break-all",
          tone === "error" ? "text-error" : "text-on-dark",
        )}
      >
        {value}
      </pre>
    </div>
  );
}

export function Json({ label, value }: { label?: string; value: unknown }) {
  return <Code label={label} value={JSON.stringify(value, null, 2)} />;
}

/** A row of `key: value`, for reading a claim set or a query string. */
export function Rows({ entries }: { entries: [string, ReactNode][] }) {
  return (
    <dl className="m-0 divide-y divide-hairline-soft">
      {entries.map(([key, value]) => (
        <div key={key} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2.5">
          <dt className="font-identity min-w-44 text-caption text-muted">{key}</dt>
          <dd className="min-w-0 flex-1 text-body-sm text-body-strong">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** IDEN's spike mark, inline so the sample carries no asset dependency. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12 1.5l1.9 6.9 5.1-4.4-3.2 6.3 6.7-1.4-6 3.6 6 3.6-6.7-1.4 3.2 6.3-5.1-4.4L12 22.5l-1.9-6.9-5.1 4.4 3.2-6.3-6.7 1.4 6-3.6-6-3.6 6.7 1.4L4.9 4l5.1 4.4z" />
    </svg>
  );
}
