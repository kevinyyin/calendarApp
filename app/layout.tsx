import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ReconnectBanner } from "@/components/ReconnectBanner";
import { NavBar } from "@/components/NavBar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Overlap — shared calendars for friends",
  description:
    "See friends' shared calendars in one merged view and find a mutual free slot in seconds.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  let needsReconnect = false;
  if (session?.user?.id) {
    const [row] = await db.select().from(users).where(eq(users.id, session.user.id));
    needsReconnect = row?.needsReconnect ?? false;
  }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {session?.user && <NavBar label={session.user.name ?? session.user.email} />}
        {needsReconnect && <ReconnectBanner />}
        {children}
      </body>
    </html>
  );
}
