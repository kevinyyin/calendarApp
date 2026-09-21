"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/actions";
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
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          <span className="mr-5 shrink-0 text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            Overlap
          </span>
          <nav className="flex items-center gap-1">
            {LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2.5 text-sm transition-colors duration-200 ${
                    isActive
                      ? "bg-surface-muted font-medium text-foreground"
                      : "text-muted hover:bg-surface-muted hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        {label && (
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">{label}</span>
            <form action={signOutAction}>
              <SubmitButton
                pendingText="Signing out…"
                className="shrink-0 whitespace-nowrap rounded-full px-4 py-2.5 text-sm text-muted transition active:scale-95 hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
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
