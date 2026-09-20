import { signIn } from "@/lib/auth";

export function ReconnectBanner() {
  return (
    <div className="border-b border-warning-border bg-warning-muted px-6 py-2.5">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
        <p className="flex items-center gap-2 text-sm text-warning">
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4 shrink-0"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.165 2.357-1.165 3.03 0l6.28 10.875c.673 1.166-.17 2.63-1.516 2.63H3.72c-1.347 0-2.189-1.464-1.515-2.63L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
              clipRule="evenodd"
            />
          </svg>
          Your Google Calendar connection has expired — new events won&apos;t sync until you reconnect.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="shrink-0 rounded-md border border-warning-border px-3 py-1 text-sm font-medium text-warning transition-colors hover:bg-warning-border/40"
          >
            Reconnect
          </button>
        </form>
      </div>
    </div>
  );
}
