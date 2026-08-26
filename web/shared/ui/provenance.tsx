import { KeyRound, ShieldCheck, UsersRound } from "lucide-react";
import { Fragment } from "react";
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
 * A scope value, set as the grammar it is: `resource:object:action`. The colons
 * are separators rather than characters, and the action — the part that decides
 * whether this is a look or a change — carries the weight.
 *
 * The segments are spans with no whitespace between them, so selecting the chip
 * still copies `admin:users:read` exactly. These are strings people paste into
 * configuration files; the typography may not alter them.
 */
export function ScopeChip({ value, className }: { value: string; className?: string }) {
  const segments = value.split(":");

  return (
    <code
      className={cn(
        "font-identity inline-flex items-baseline rounded-xs bg-surface-card px-1.5 py-0.5",
        "whitespace-nowrap text-muted",
        className,
      )}
    >
      {segments.map((segment, index) => (
        <Fragment key={index}>
          {index > 0 ? (
            <span aria-hidden="true" className="px-[0.12em] text-primary/70">
              :
            </span>
          ) : null}
          <span className={index === segments.length - 1 ? "font-medium text-ink" : undefined}>
            {segment}
          </span>
        </Fragment>
      ))}
    </code>
  );
}

/** Where a scope came from, in the order the resolver unions them. */
function derivations(scope: ResolvedScope) {
  const sources: { icon: typeof KeyRound; label: string }[] = [];
  if (scope.viaDirect) sources.push({ icon: KeyRound, label: "granted directly" });
  for (const role of scope.viaRoles) sources.push({ icon: ShieldCheck, label: role });
  for (const group of scope.viaGroups) sources.push({ icon: UsersRound, label: group });
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
        "flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-hairline-soft py-2.5 last:border-b-0",
        "sm:grid sm:grid-cols-[minmax(0,20rem)_1fr] sm:items-baseline",
        className,
      )}
    >
      <ScopeChip value={scope.value} className="justify-self-start" />
      {description ? (
        <span className="text-body-sm text-body">{description}</span>
      ) : sources.length === 0 ? (
        <span className="text-caption text-muted-soft">unattributed</span>
      ) : (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted">
          <span className="sr-only">granted through</span>
          {sources.map((source, index) => (
            <span key={index} className="inline-flex items-center gap-1.5">
              <source.icon aria-hidden="true" className="h-3.5 w-3.5 text-muted-soft" />
              {source.label}
            </span>
          ))}
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
        <ProvenanceRow key={scope.value} scope={scope} description={descriptions?.[scope.value]} />
      ))}
    </ul>
  );
}
