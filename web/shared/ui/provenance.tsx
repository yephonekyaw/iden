import { cn } from "./cn";

/**
 * The shape both `/admin/users/{id}/effective-scopes` and `/entity/permissions`
 * return: a scope, and the three ways it can have been granted.
 */
export interface ResolvedScope {
  value: string;
  viaDirect: boolean;
  viaRoles: string[];
  /** Entries read `"Students → member"` — the group, then the role it holds. */
  viaGroups: string[];
}

/**
 * A scope value. Monospace because these are strings people compare character
 * by character and paste into configuration files, not prose.
 */
export function ScopeChip({ value, className }: { value: string; className?: string }) {
  return (
    <code
      className={cn(
        "font-identity rounded-xs bg-surface-card px-1.5 py-0.5 text-ink whitespace-nowrap",
        className,
      )}
    >
      {value}
    </code>
  );
}

/** Where a scope came from, in the order the resolver unions them. */
function derivations(scope: ResolvedScope): string[] {
  const sources: string[] = [];
  if (scope.viaDirect) sources.push("granted directly");
  sources.push(...scope.viaRoles);
  sources.push(...scope.viaGroups);
  return sources;
}

/**
 * The answer to "why can this person do that?", which is the question an access
 * control system exists to answer. The server already resolves it; this renders
 * it without editorialising.
 */
export function ProvenanceRow({
  scope,
  description,
  className,
}: {
  scope: ResolvedScope;
  /** Shown instead of the derivation when explaining a scope to the person granting it. */
  description?: string;
  className?: string;
}) {
  const sources = derivations(scope);
  return (
    <li
      className={cn(
        "flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-hairline-soft py-2.5 last:border-b-0",
        className,
      )}
    >
      <ScopeChip value={scope.value} />
      {description ? (
        <span className="text-body-sm text-body">{description}</span>
      ) : (
        <span className="text-caption text-muted">
          <span aria-hidden="true">←</span>
          <span className="sr-only">granted through</span> {sources.join(", ") || "unattributed"}
        </span>
      )}
    </li>
  );
}

export function ProvenanceTrace({
  scopes,
  descriptions,
  className,
}: {
  scopes: ResolvedScope[];
  /** Scope value → admin-written description, for the consent screen. */
  descriptions?: Record<string, string>;
  className?: string;
}) {
  return (
    <ul className={cn("m-0 list-none p-0", className)}>
      {scopes.map((scope) => (
        <ProvenanceRow
          key={scope.value}
          scope={scope}
          description={descriptions?.[scope.value]}
        />
      ))}
    </ul>
  );
}
