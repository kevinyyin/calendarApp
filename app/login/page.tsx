import { signIn } from "@/lib/auth";
import { SubmitButton } from "@/components/SubmitButton";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="text-sm font-semibold tracking-tight text-accent">
          Overlap
        </span>
        <h1 className="text-2xl font-semibold text-foreground">
          See when you&apos;re both free
        </h1>
        <p className="max-w-xs text-sm text-muted">
          Connect your Google Calendar to view friends&apos; shared schedules
          and find a time that works for everyone.
        </p>
      </div>

      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/onboarding" });
        }}
      >
        <SubmitButton
          pendingText="Redirecting to Google…"
          className="flex items-center gap-3 rounded-md border border-border bg-surface px-5 py-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-surface-muted disabled:opacity-50"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
            <path
              fill="#4285F4"
              d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.48a5.54 5.54 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.56-5.17 3.56-8.82Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3.02c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.12A12 12 0 0 0 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54V6.61H1.26a12 12 0 0 0 0 10.78l4.01-3.12Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.77c1.76 0 3.34.6 4.59 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.26 6.61l4.01 3.12C6.22 6.88 8.87 4.77 12 4.77Z"
            />
          </svg>
          Sign in with Google
        </SubmitButton>
      </form>
    </main>
  );
}
