"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Power, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SecretRevealCard } from "@/components/shared/secret-reveal-card";
import { deleteClient, rotateClientSecret, setClientStatus } from "@/lib/api/clients";

export function ClientActions({
  clientId,
  clientName,
  status,
}: {
  clientId: string;
  clientName: string;
  status: "active" | "disabled";
}) {
  const router = useRouter();
  const [secret, setSecret] = React.useState<string | null>(null);
  const [confirmRotate, setConfirmRotate] = React.useState(false);
  const [confirmToggle, setConfirmToggle] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  return (
    <div className="space-y-4">
      {secret ? (
        <SecretRevealCard label="client secret" secret={secret} onDismiss={() => setSecret(null)} />
      ) : null}

      <Card className="p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Actions
        </h3>
        <div className="mt-4 space-y-2">
          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={() => setConfirmRotate(true)}
          >
            <KeyRound className="h-4 w-4" /> Rotate secret
          </Button>
          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={() => setConfirmToggle(true)}
          >
            <Power className="h-4 w-4" />
            {status === "active" ? "Disable client" : "Enable client"}
          </Button>
          <Button
            variant="danger-outline"
            className="w-full justify-start"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-4 w-4" /> Delete client
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmRotate}
        onOpenChange={setConfirmRotate}
        title="Rotate client secret?"
        description="The current secret will stop working immediately. The new secret is shown once and cannot be retrieved later."
        confirmLabel="Rotate secret"
        onConfirm={async () => {
          const { client_secret } = await rotateClientSecret(clientId);
          setSecret(client_secret);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={confirmToggle}
        onOpenChange={setConfirmToggle}
        title={status === "active" ? "Disable client?" : "Enable client?"}
        description={
          status === "active"
            ? "Disabled clients cannot mint new tokens. Existing tokens remain valid until they expire."
            : "The client will be able to authenticate users and request tokens."
        }
        confirmLabel={status === "active" ? "Disable" : "Enable"}
        destructive={status === "active"}
        onConfirm={async () => {
          await setClientStatus(clientId, status === "active" ? "disabled" : "active");
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this client?"
        description={
          <>
            This permanently deletes <strong>{clientName}</strong>. All associated tokens will be invalidated.
          </>
        }
        confirmLabel="Delete permanently"
        destructive
        requireText={clientName}
        onConfirm={async () => {
          await deleteClient(clientId);
          router.push("/admin/clients");
          router.refresh();
        }}
      />
    </div>
  );
}
