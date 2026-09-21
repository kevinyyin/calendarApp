import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ReconnectBanner } from "@/components/ReconnectBanner";
import { NavBar } from "@/components/NavBar";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Overlap — shared calendars for friends",
  description:
    "See friends' shared calendars in one merged view and find a mutual free slot in seconds.",
};

// DIRECTION CONTRACT — greppable audit trail for the 2026-09-21 redesign.
// React/JSX has no native raw-comment node, so this is emitted via a
// display:none host element rather than a literal top-level <!-- --> —
// the closest available fidelity to "first child of body, survives the
// production build, greppable in built output."
const DIRECTION_CONTRACT = `
THESIS: Overlap refuses the generic Tailwind-indigo SaaS-dashboard default;
the idea is that checking friends' availability should feel as calm and
considered as Apple product typography, not like filling out a form.
OWN-WORLD: warm ivory/charcoal neutrals, never cold slate; one deep-pine
teal accent; Plus Jakarta Sans throughout at a generous scale; soft
dual-layer shadows; one exponential ease-out entrance per view.
STORY: a visitor recognizes restraint and confidence immediately, trusts
the app with their calendar, and reads each screen's one primary action
without hunting.
FIRST VIEWPORT: /login — centered wordmark and headline at generous scale,
one sentence of supporting copy, one full-width sign-in control, vastly
more surrounding whitespace than before.
FORM: standing-exit/canon path (new-work.md) — user-pinned Apple-marketing
restraint plus Things 3 / Fantastical warmth, confirmed 2026-09-21;
concept-seed roll (seed e5f5655b, index 5) superseded per "a pinned
direction beats the roll, always."
FINISH: unreviewed and undocumented is unfinished; this build ends with
the finish review, the verdict, DESIGN.md, and every shipping raster
carrying its provenance
`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  let needsReconnect = false;
  if (session?.user?.id) {
    const [row] = await db.select().from(users).where(eq(users.id, session.user.id));
    needsReconnect = row?.needsReconnect ?? false;
  }

  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <div
          aria-hidden="true"
          style={{ display: "none" }}
          dangerouslySetInnerHTML={{ __html: `<!--${DIRECTION_CONTRACT}-->` }}
        />
        {session?.user && <NavBar label={session.user.name ?? session.user.email} />}
        {needsReconnect && <ReconnectBanner />}
        {children}
      </body>
    </html>
  );
}
