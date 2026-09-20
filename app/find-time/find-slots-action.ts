"use server";

import { auth } from "@/lib/auth";
import { findMutualFreeSlotsByUsername } from "./actions";
import type { Interval } from "@/lib/free-slots";

// Small wrapping server action so the client component (app/find-time/page.tsx)
// never needs to know the viewer's user id itself — client components can't
// call `auth()` directly, so this injects `session.user.id` server-side
// before delegating to findMutualFreeSlotsByUsername.
export async function findSlotsForCurrentUser(
  friendUsernames: string[],
  durationMinutes: number,
  // Supplied by the client as `new Date().getTimezoneOffset()`: the server
  // has no way to know the viewer's timezone on its own, and the spec's
  // 8am-10pm waking window is defined in the viewer's local time. Defaults
  // to UTC if a caller omits it.
  timezoneOffsetMinutes: number = 0,
): Promise<Interval[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const now = new Date();
  const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  return findMutualFreeSlotsByUsername(session.user.id, {
    friendUsernames,
    start: now,
    end: twoWeeksOut,
    durationMinutes,
    timezoneOffsetMinutes,
  });
}
