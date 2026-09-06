import type { ComponentProps } from "react";
import { cn } from "./cn";

/**
 * The card chrome shared by every list of rows.
 *
 * Exported as a class string rather than only as a component because one list
 * — `ProvenanceTrace` — renders its own `<ul>`, and a `<ul>` cannot be nested
 * inside another one. That component draws its frame from this constant, so
 * there is still exactly one definition of what the chrome is.
 */
export const ROW_CARD = "overflow-hidden rounded-lg border border-border bg-background";

/**
 * A card containing a list of divided rows.
 *
 * The alternative — a bare list with a rule above and below — leaves rows
 * floating against the page with nothing holding them, and reads as unstyled
 * rather than deliberate. Enclosing them says where the list starts and stops.
 *
 * Still a `<ul>`: these are enumerations, and the reset is the price of having
 * a browser announce them as one.
 */
export function RowCard({ className, ...props }: ComponentProps<"ul">) {
  return <ul className={cn("m-0 list-none p-0", ROW_CARD, className)} {...props} />;
}

/**
 * One row. Owns its divider and its padding; the layout inside it belongs to
 * the caller, because no two of these lists hold the same shape of thing.
 *
 * The padding sits on the row rather than the card so the dividers run the full
 * width. `py-4` suits a row of two or three lines — a dense list of one-liners
 * passes `py-2.5`, which wins through `cn`.
 */
export function Row({ className, ...props }: ComponentProps<"li">) {
  return (
    <li
      className={cn("border-b border-hairline-soft px-5 py-4 last:border-b-0", className)}
      {...props}
    />
  );
}
