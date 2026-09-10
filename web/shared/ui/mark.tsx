import { cn } from "./cn";

/** The eight angles the spokes sit at. Eight, not four, so the mark reads as a
    burst at 16px and still holds its shape at 96px. */
const SPOKES = [0, 45, 90, 135, 180, 225, 270, 315];

/**
 * The accent glyph: claims converging on one identity, drawn in DESIGN.md's
 * radial-spike vernacular. Inherits `currentColor` — it is type, not an image.
 *
 * This is punctuation, not the logo — it bullets eyebrows and captions at sizes
 * where `Logo` would blur into a smudge. The lockup uses `Logo`.
 */
export function Mark({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn("h-4 w-4 shrink-0", className)}
      {...props}
    >
      {SPOKES.map((angle) => (
        <path
          key={angle}
          d="M12 2.4 L13.15 10.6 L12 12.6 L10.85 10.6 Z"
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
    </svg>
  );
}
