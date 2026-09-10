import type { Branding } from "../config";
import { cn } from "./cn";
import { Logo } from "./logo";
import { Mark } from "./mark";

/**
 * The lockup: the organization first, IDEN underneath it.
 *
 * People sign in to their university, not to the identity provider that happens
 * to be running behind it — so the organization takes the display serif and
 * IDEN drops to a caption. With no organization configured, IDEN takes the
 * larger line and there is no second one.
 */
export function Brand({
  branding,
  variant = "compact",
  className,
}: {
  branding: Branding;
  /** `page` is the sign-in screen, where the lockup is the only thing on the canvas. */
  variant?: "compact" | "page";
  className?: string;
}) {
  const page = variant === "page";
  const { organization, logoUrl } = branding;

  if (!organization && !logoUrl) {
    return (
      <span className={cn("inline-flex items-center gap-2.5", className)}>
        <Logo className={cn("text-primary", page ? "h-8 w-8" : "h-6 w-6")} />
        <span
          className={cn(
            "font-display tracking-[0.22em]",
            page ? "text-display-sm" : "text-title-lg",
          )}
        >
          IDEN
        </span>
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          className={cn("w-auto shrink-0 object-contain", page ? "max-h-11" : "max-h-8")}
        />
      ) : null}
      <span className="min-w-0">
        {organization ? (
          <span
            className={cn(
              // `truncate` clips at the line box, and the display serif's
              // ascenders and descenders both overrun a 1.2 line-height — so
              // without the padding a name like "Luang" loses the tail of its g.
              "block truncate py-0.5 font-display",
              page ? "text-display-sm" : "text-title-md",
            )}
          >
            {organization}
          </span>
        ) : null}
        <span
          className={cn(
            "flex items-center gap-2 text-caption-upper uppercase opacity-65",
            page ? "mt-3" : "mt-2",
          )}
        >
          <Mark className={cn("text-primary", page ? "h-3 w-3" : "h-2.5 w-2.5")} />
          {page ? "Secured by IDEN" : "IDEN"}
        </span>
      </span>
    </span>
  );
}
