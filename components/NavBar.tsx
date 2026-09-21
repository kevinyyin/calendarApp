import Link from "next/link";
import { signOut } from "@/lib/auth";
import { SubmitButton } from "@/components/SubmitButton";

const LINKS = [
  { href: "/", label: "This week" },
  { href: "/find-time", label: "Find a time" },
  { href: "/calendars", label: "Calendars" },
  { href: "/friends", label: "Friends" },
] as const;

export function NavBar({
  label,
}: {
  /** Display name or email for the signed-in user, shown at the right edge. */
  label?: string | null;
}) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          <span className="mr-2 shrink-0 text-sm font-semibold tracking-tight text-foreground">
            Overlap
          </span>
          <nav className="flex items-center gap-1">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        {label && (
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">{label}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <SubmitButton
                pendingText="Signing out…"
                className="shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-muted transition active:scale-95 hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
              >
                Sign out
              </SubmitButton>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
