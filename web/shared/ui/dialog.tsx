import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, Copy, KeyRound, TriangleAlert, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Badge } from "./badge";
import { Button } from "./button";
import { cn } from "./cn";

function Overlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn("fixed inset-0 z-50 bg-surface-dark/40 backdrop-blur-[1px]", className)}
      {...props}
    />
  );
}

function Content({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <Overlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2",
          "rounded-xl border border-hairline bg-canvas p-8 shadow-[0_1px_3px_rgba(20,20,19,0.08)]",
          "data-[state=open]:step-in",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute right-4 top-4 rounded-md p-1.5 text-muted-soft hover:bg-surface-soft hover:text-ink"
          aria-label="Close"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export const Dialog = Object.assign(DialogPrimitive.Root, {
  Trigger: DialogPrimitive.Trigger,
  Close: DialogPrimitive.Close,
  Content,
  Title: DialogPrimitive.Title,
  Description: DialogPrimitive.Description,
});

/**
 * Names what will happen before it happens, including the consequences the
 * server would otherwise deliver as a surprise — a `force=true` delete taking
 * dependants with it, a password reset ending every session.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  onConfirm,
  destructive = true,
  pending = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
  pending?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content>
        {destructive ? (
          <span
            aria-hidden="true"
            className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-error/10 text-error"
          >
            <TriangleAlert className="h-5 w-5" />
          </span>
        ) : null}
        <Dialog.Title className="pr-8 font-display text-display-sm text-ink">{title}</Dialog.Title>
        <Dialog.Description asChild>
          <div className="mt-3 text-body-md text-body">{body}</div>
        </Dialog.Description>
        <div className="mt-8 flex justify-end gap-3">
          <Dialog.Close asChild>
            <Button variant="secondary">Cancel</Button>
          </Dialog.Close>
          <Button
            variant={destructive ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={pending}
          >
            {confirmLabel}
          </Button>
        </div>
      </Dialog.Content>
    </Dialog>
  );
}

/**
 * Client secrets and generated passwords are returned exactly once and never
 * stored. The screen has to say so before it is dismissed, not after.
 */
export function SecretRevealOnce({
  label,
  secret,
  note,
}: {
  label: string;
  secret: string;
  note?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg bg-surface-dark p-6">
      <div className="flex items-center justify-between gap-4">
        <p className="flex items-center gap-2 text-caption-upper uppercase text-on-dark-soft">
          <KeyRound aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
          {label}
        </p>
        <Badge tone="coral">Shown once</Badge>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <code className="font-identity min-w-0 flex-1 break-all text-on-dark">{secret}</code>
        <Button variant="onDark" size="sm" onClick={copy}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="mt-4 text-body-sm text-on-dark-soft">
        {note ?? "This is the only time it is shown. Store it now — it cannot be retrieved later."}
      </p>
      <span aria-live="polite" className="sr-only">
        {copied ? `${label} copied to clipboard` : ""}
      </span>
    </div>
  );
}
