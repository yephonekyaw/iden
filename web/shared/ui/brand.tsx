import type { Branding } from "../config";
import { cn } from "./cn";
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
        <Mark className={cn("text-primary", page ? "h-5 w-5" : "h-4 w-4")} />
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
              "block truncate font-display",
              page ? "text-display-sm" : "text-title-md",
            )}
          >
            {organization}
          </span>
        ) : null}
        <span className="mt-0.5 flex items-center gap-1.5 text-caption-upper uppercase opacity-65">
          <Mark className="h-2.5 w-2.5 text-primary" />
          {page ? "Secured by IDEN" : "IDEN"}
        </span>
      </span>
    </span>
  );
}
