import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Button, Field, IdenError, Input } from "@iden/shared";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router";
import { z } from "zod";
import { confirmPasswordReset, requestPasswordReset } from "../api";
import { AuthLayout } from "../AuthLayout";

const request = z.object({ email: z.string().min(1, "Enter your email address.") });

// 12 characters is the server's floor (`PasswordResetConfirm.newPassword`).
const reset = z
  .object({
    newPassword: z.string().min(12, "Use at least 12 characters."),
    confirm: z.string(),
  })
  .refine((values) => values.newPassword === values.confirm, {
    path: ["confirm"],
    message: "Both entries must match.",
  });

export function ForgotRoute() {
  const form = useForm({ resolver: zodResolver(request), defaultValues: { email: "" } });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof request>) => requestPasswordReset(values.email),
  });

  // The server answers 202 whether or not the address exists, so the copy must
  // not confirm an account either.
  if (mutation.isSuccess) {
    return (
      <AuthLayout title="Check your email">
        <p className="text-body-md text-body">
          If <span className="text-body-strong">{form.getValues("email")}</span> belongs to an
          account, a reset link is on its way. It is valid for 15 minutes and can be used once.
        </p>
      </AuthLayout>
    );
  }

  const problem = mutation.error instanceof IdenError ? mutation.error : null;

  return (
    <AuthLayout
      title="Reset your password"
      lede="Enter the address you sign in with and we'll send a reset link."
    >
      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      >
        <Field label="Email" error={form.formState.errors.email?.message}>
          {(props) => (
            <Input {...props} {...form.register("email")} type="email" autoComplete="username" autoFocus />
          )}
        </Field>

        {problem ? (
          <p role="alert" className="text-body-sm text-error">
            {problem.status === 429
              ? `Too many requests. Try again in ${problem.retryAfter ?? 3600} seconds.`
              : problem.message}
          </p>
        ) : null}

        <Button type="submit" variant="primary" disabled={mutation.isPending}>
          {mutation.isPending ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </AuthLayout>
  );
}

export function ResetRoute() {
  const [params] = useSearchParams();
  const token = params.get("token");

  const form = useForm({
    resolver: zodResolver(reset),
    defaultValues: { newPassword: "", confirm: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof reset>) =>
      confirmPasswordReset({ token: token ?? "", newPassword: values.newPassword }),
  });

  if (!token) {
    return (
      <AuthLayout title="This link is incomplete">
        <p className="text-body-md text-body">
          Open the link from the email exactly as it was sent, or{" "}
          <a className="text-primary underline-offset-2 hover:underline" href="/auth/forgot">
            request a new one
          </a>
          .
        </p>
      </AuthLayout>
    );
  }

  if (mutation.isSuccess) {
    return (
      <AuthLayout title="Password changed">
        <p className="text-body-md text-body">
          Every session and refresh token was signed out. Return to the application and sign in with
          your new password.
        </p>
      </AuthLayout>
    );
  }

  const problem = mutation.error instanceof IdenError ? mutation.error : null;
  const spent = problem?.code === "invalid_reset_token";

  return (
    <AuthLayout
      title="Choose a new password"
      lede="Signing in everywhere else will end when you save this."
    >
      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      >
        <Field
          label="New password"
          hint="At least 12 characters."
          error={form.formState.errors.newPassword?.message}
        >
          {(props) => (
            <Input
              {...props}
              {...form.register("newPassword")}
              type="password"
              autoComplete="new-password"
              autoFocus
            />
          )}
        </Field>

        <Field label="Confirm new password" error={form.formState.errors.confirm?.message}>
          {(props) => (
            <Input {...props} {...form.register("confirm")} type="password" autoComplete="new-password" />
          )}
        </Field>

        {problem ? (
          <p role="alert" className="text-body-sm text-error">
            {spent ? (
              <>
                This reset link has expired or was already used.{" "}
                <a className="text-primary underline-offset-2 hover:underline" href="/auth/forgot">
                  Request a new one
                </a>
                .
              </>
            ) : (
              problem.message
            )}
          </p>
        ) : null}

        <Button type="submit" variant="primary" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save new password"}
        </Button>
      </form>
    </AuthLayout>
  );
}
