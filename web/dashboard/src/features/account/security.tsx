import {
  Button,
  ConfirmDialog,
  ErrorState,
  Field,
  IdenError,
  Input,
  SecretRevealOnce,
  Spinner,
} from "@iden/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { useApi } from "../../app/api";
import { useStepUp } from "../../app/session";
import { PageHeader } from "../../app/shell";
import { useTotpStatus, type TotpEnrollment, type TotpStatus } from "./api";

export function SecurityRoute() {
  return (
    <>
      <PageHeader
        title="Security"
        lede="Your password, the address you sign in with, and your authenticator app."
      />
      <div className="flex max-w-xl flex-col gap-12">
        <PasswordSection />
        <EmailSection />
        <TotpSection />
      </div>
    </>
  );
}

/**
 * Both credential changes require a sign-in within the last five minutes. When
 * the server says so (RFC 9470), the fix is to re-authenticate and come back —
 * not to show the user an error they cannot act on.
 */
function StepUpNotice({ problem }: { problem: IdenError | null }) {
  const stepUp = useStepUp();
  const maxAge = problem?.stepUpMaxAge;
  if (!maxAge) return null;

  return (
    <div className="rounded-lg border border-hairline bg-surface-soft p-5">
      <p className="text-title-sm text-ink">Confirm it's you first</p>
      <p className="mt-1 text-body-sm text-body">
        Changing this needs a sign-in from the last {Math.round(maxAge / 60)} minutes.
      </p>
      <Button className="mt-4" size="sm" variant="primary" onClick={() => stepUp(maxAge)}>
        Enter your password
      </Button>
    </div>
  );
}

function PasswordSection() {
  const api = useApi();
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNext] = useState("");

  const change = useMutation({
    mutationFn: async () => {
      const response = await api.post<{ sessionsEnded: number }>("/entity/credentials/password", {
        currentPassword,
        newPassword,
      });
      return response.data;
    },
    onSuccess: () => {
      setCurrent("");
      setNext("");
    },
  });

  const problem = change.error instanceof IdenError ? change.error : null;

  return (
    <section>
      <h2 className="text-title-lg text-ink">Password</h2>
      <form
        noValidate
        className="mt-4 flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          change.mutate();
        }}
      >
        <Field label="Current password">
          {(props) => (
            <Input
              {...props}
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrent(event.target.value)}
            />
          )}
        </Field>
        <Field
          label="New password"
          hint="At least 12 characters."
          error={
            problem?.code === "same_password"
              ? "Choose a password you haven't used here."
              : undefined
          }
        >
          {(props) => (
            <Input
              {...props}
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNext(event.target.value)}
            />
          )}
        </Field>

        <StepUpNotice problem={problem} />

        {problem && !problem.stepUpMaxAge && problem.code !== "same_password" ? (
          <p role="alert" className="text-body-sm text-error">
            {problem.code === "wrong_password"
              ? "That current password is not right."
              : problem.message}
          </p>
        ) : null}

        <div className="flex items-center gap-4">
          <Button type="submit" variant="primary" disabled={change.isPending}>
            {change.isPending ? "Changing…" : "Change password"}
          </Button>
          <span aria-live="polite" className="text-caption text-muted">
            {change.isSuccess
              ? `Password changed. ${change.data.sessionsEnded} other session${change.data.sessionsEnded === 1 ? "" : "s"} signed out.`
              : ""}
          </span>
        </div>
      </form>
    </section>
  );
}

function EmailSection() {
  const api = useApi();
  const [email, setEmail] = useState("");
  const [currentPassword, setPassword] = useState("");

  const change = useMutation({
    mutationFn: async () => {
      const response = await api.post<{ sessionsEnded: number }>("/entity/credentials/email", {
        email,
        currentPassword,
      });
      return response.data;
    },
    onSuccess: () => setPassword(""),
  });

  const problem = change.error instanceof IdenError ? change.error : null;

  return (
    <section>
      <h2 className="text-title-lg text-ink">Sign-in address</h2>
      <p className="mt-1 text-body-sm text-muted">
        Changing this changes the address you sign in with, and signs out your other sessions.
      </p>
      <form
        noValidate
        className="mt-4 flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          change.mutate();
        }}
      >
        <Field
          label="New email address"
          error={
            problem?.code === "email_taken"
              ? "That address already belongs to an account."
              : undefined
          }
        >
          {(props) => (
            <Input
              {...props}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}
        </Field>
        <Field label="Your password">
          {(props) => (
            <Input
              {...props}
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </Field>

        <StepUpNotice problem={problem} />

        {problem && !problem.stepUpMaxAge && problem.code !== "email_taken" ? (
          <p role="alert" className="text-body-sm text-error">
            {problem.code === "wrong_password" ? "That password is not right." : problem.message}
          </p>
        ) : null}

        <div className="flex items-center gap-4">
          <Button type="submit" variant="primary" disabled={change.isPending}>
            {change.isPending ? "Changing…" : "Change address"}
          </Button>
          <span aria-live="polite" className="text-caption text-muted">
            {change.isSuccess ? "Address changed." : ""}
          </span>
        </div>
      </form>
    </section>
  );
}

function TotpSection() {
  const api = useApi();
  const status = useTotpStatus(api);
  const queryClient = useQueryClient();
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [removing, setRemoving] = useState(false);

  const enroll = useMutation({
    mutationFn: async () => {
      const response = await api.post<TotpEnrollment>("/entity/totp/enroll");
      return response.data;
    },
    onSuccess: setEnrollment,
  });

  const confirm = useMutation({
    mutationFn: async () => {
      const response = await api.post<TotpStatus>("/entity/totp/confirm", { code });
      return response.data;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(["totp"], next);
      setEnrollment(null);
      setCode("");
    },
  });

  const remove = useMutation({
    mutationFn: () => api.delete("/entity/totp"),
    onSuccess: () => {
      setRemoving(false);
      void queryClient.invalidateQueries({ queryKey: ["totp"] });
    },
  });

  if (status.isPending) return <Spinner label="Checking your authenticator" />;
  if (status.isError)
    return <ErrorState error={status.error} onRetry={() => void status.refetch()} />;

  const removeProblem = remove.error instanceof IdenError ? remove.error : null;
  const confirmProblem = confirm.error instanceof IdenError ? confirm.error : null;

  return (
    <section>
      <h2 className="text-title-lg text-ink">Authenticator app</h2>

      {status.data.enrolled ? (
        <>
          <p className="mt-1 text-body-sm text-body">
            Set up and in use. You'll be asked for a code when an application requires two factors.
          </p>
          <StepUpNotice problem={removeProblem} />
          <Button className="mt-4" variant="secondary" onClick={() => setRemoving(true)}>
            Remove authenticator
          </Button>
          <ConfirmDialog
            open={removing}
            onOpenChange={setRemoving}
            title="Remove your authenticator?"
            body="Applications that require two factors will not let you in until you set up a new one."
            confirmLabel="Remove authenticator"
            pending={remove.isPending}
            onConfirm={() => remove.mutate()}
          />
        </>
      ) : enrollment ? (
        <div className="mt-4 flex flex-col gap-5">
          <p className="text-body-sm text-body">
            Scan this with your authenticator app, then enter the code it shows.
          </p>
          <div className="w-fit rounded-lg bg-canvas p-4 ring-1 ring-hairline">
            <QRCodeSVG value={enrollment.uri} size={168} bgColor="#faf9f5" fgColor="#141413" />
          </div>
          <SecretRevealOnce
            label="Or enter this key by hand"
            secret={enrollment.secret}
            note="Only needed if your app cannot scan the code."
          />
          <Field
            label="Six-digit code"
            error={
              confirmProblem?.code === "totp_wrong_code"
                ? "That code is not right. Codes change every 30 seconds."
                : confirmProblem?.message
            }
          >
            {(props) => (
              <Input
                {...props}
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="font-identity tracking-[0.4em]"
              />
            )}
          </Field>
          <div className="flex gap-3">
            <Button variant="primary" disabled={confirm.isPending} onClick={() => confirm.mutate()}>
              {confirm.isPending ? "Checking…" : "Turn on"}
            </Button>
            <Button variant="ghost" onClick={() => setEnrollment(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-1 text-body-sm text-body">
            Not set up. An authenticator app gives you a second factor for applications that ask for
            one.
          </p>
          <Button
            className="mt-4"
            variant="primary"
            disabled={enroll.isPending}
            onClick={() => enroll.mutate()}
          >
            {enroll.isPending ? "Preparing…" : "Set up authenticator"}
          </Button>
        </>
      )}
    </section>
  );
}
