import { useId, useState, type ComponentProps, type ReactNode } from "react";

/**
 * The playground's UI kit.
 *
 * Small on purpose and dependency-free: this sample should run after one
 * `pnpm install` with nothing from the rest of the repository. Every value here
 * is a token defined in `theme.css`: black rules, hard shadows, no radius.
 */

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// --------------------------------------------------------------------------
// Controls
// --------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "onDark";

const BUTTON: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-active disabled:bg-primary-disabled",
  secondary: "bg-surface-soft text-ink hover:bg-warning",
  ghost: "border-transparent bg-transparent text-ink shadow-none hover:bg-warning",
  onDark: "bg-surface-dark text-on-dark hover:bg-surface-dark-elevated",
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
        "inline-flex shrink-0 items-center justify-center gap-2 border-[3px] border-ink uppercase",
        "font-semibold tracking-wide shadow-drop-sm transition-[transform,box-shadow] duration-75",
        // The press. A brutalist button has somewhere to go.
        "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-drop-xs",
        "active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:text-muted",
        "[&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
        size === "sm" ? "h-9 px-3 text-caption" : "h-control px-5 text-body-sm",
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
        "h-control w-full border-[3px] border-ink bg-surface-soft px-3 text-body-sm text-ink",
        "font-identity placeholder:text-muted-soft",
        "focus:bg-warning/25 focus:shadow-drop-xs focus:outline-none",
        "disabled:bg-surface-card disabled:text-muted",
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
        "h-control w-full border-[3px] border-ink bg-surface-soft px-2.5 text-body-sm font-medium text-ink",
        "focus:shadow-drop-xs focus:outline-none",
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
      <label
        htmlFor={id}
        className="font-identity text-caption font-bold tracking-wide text-ink uppercase"
      >
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
        className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-primary"
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
        "border-[3px] border-ink bg-surface-soft p-6 shadow-drop sm:p-8",
        disabled && "opacity-55",
      )}
      aria-disabled={disabled}
    >
      <header className="mb-6 flex items-start gap-4">
        <span
          aria-hidden="true"
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center border-[3px] border-ink",
            "text-title-sm tabular-nums",
            done ? "bg-primary text-on-primary" : "bg-canvas text-ink",
          )}
        >
          {done ? "✓" : step}
        </span>
        <div className="min-w-0">
          <h2 className="text-title-lg text-ink">{title}</h2>
          {lede ? <p className="mt-1.5 max-w-prose text-body-sm text-body">{lede}</p> : null}
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
    neutral: "bg-surface-card text-ink",
    coral: "bg-primary text-on-primary",
    success: "bg-success text-ink",
    error: "bg-error text-surface-soft",
    dark: "bg-surface-dark text-on-dark",
  };
  return (
    <span
      className={cn(
        "font-identity inline-flex items-center gap-1.5 border-2 border-ink px-2 py-0.5",
        "text-caption font-bold tracking-wide whitespace-nowrap uppercase",
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
        className={cn(
          "mt-1.5 h-3 w-3 shrink-0 border-2 border-ink",
          ok ? "bg-success" : "bg-error",
        )}
      />
      <span className={ok ? "text-body" : "text-error"}>{children}</span>
      <span className="sr-only">{ok ? "(passed)" : "(failed)"}</span>
    </li>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="border-[3px] border-ink bg-warning px-4 py-3 text-body-sm font-medium text-ink">
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
      className="font-identity shrink-0 border-2 border-transparent px-2 py-0.5 text-caption font-bold text-on-dark-soft uppercase hover:border-on-dark-soft hover:text-on-dark"
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
    <div className="border-[3px] border-ink bg-surface-dark shadow-drop-sm">
      {label || value ? (
        <div className="flex items-center justify-between gap-3 border-b-[3px] border-hairline-dark px-4 py-2">
          <span className="font-identity text-caption-upper text-on-dark-soft uppercase">
            {label}
          </span>
          <Copy value={value} />
        </div>
      ) : null}
      <pre
        className={cn(
          "font-identity overflow-x-auto px-4 py-3 text-code whitespace-pre-wrap break-all",
          tone === "error" ? "text-error-soft" : "text-on-dark",
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
    <dl className="m-0 divide-y-2 divide-ink border-[3px] border-ink bg-canvas">
      {entries.map(([key, value]) => (
        <div key={key} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-3 py-2.5">
          <dt className="font-identity min-w-44 text-caption font-bold text-muted uppercase">
            {key}
          </dt>
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
