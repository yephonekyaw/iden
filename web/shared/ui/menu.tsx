import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import type { ComponentProps } from "react";
import { cn } from "./cn";

function Content({
  className,
  sideOffset = 8,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-52 rounded-lg border border-hairline bg-canvas p-1.5",
          "shadow-[0_1px_3px_rgba(20,20,19,0.08)]",
          "data-[state=open]:step-in",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

function Item({ className, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2.5 rounded-sm px-2.5 py-2",
        "text-body-sm text-body-strong outline-none",
        "data-[highlighted]:bg-surface-soft data-[highlighted]:text-ink",
        "[&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:text-muted",
        className,
      )}
      {...props}
    />
  );
}

function Label({ className, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn("px-2.5 pb-1 pt-2 text-caption-upper uppercase text-muted-soft", className)}
      {...props}
    />
  );
}

function Separator({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn("my-1.5 h-px bg-hairline-soft", className)}
      {...props}
    />
  );
}

export const Menu = Object.assign(DropdownMenuPrimitive.Root, {
  Trigger: DropdownMenuPrimitive.Trigger,
  Content,
  Item,
  Label,
  Separator,
});
