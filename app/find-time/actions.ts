"use server";

import { db } from "@/db/client";
import { events, googleCalendars, users } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getVisibleCalendars } from "@/lib/visibility";
import { findFreeSlots, type Interval } from "@/lib/free-slots";

export async function findMutualFreeSlots(
  viewerId: string,
  options: {
    friendUserIds: string[];
    start: Date;
    end: Date;
    durationMinutes: number;
    // The viewer's `Date#getTimezoneOffset()` value, threaded from the
    // browser (app/find-time/page.tsx) so the 8am-10pm waking window means
    // 8am-10pm where the viewer actually is. Omitted => UTC.
    timezoneOffsetMinutes?: number;
  },
): Promise<Interval[]> {
  // The viewer's own busy time must ALWAYS be part of this computation, in
  // addition to whichever friends were explicitly chosen via
  // friendUserIds. A "free" slot that ignores the viewer's own calendar
  // isn't actually free for them — this is the exact gap that was fixed for
  // the merged view in lib/merged-view.ts's getRelevantCalendarsForViewer
  // (Task 14/15), and this function follows the same pattern: fetch the
  // viewer's own google_calendars rows directly (not through
  // getVisibleCalendars, which only returns FRIENDS' calendars), and do so
  // unfiltered by isShared — that flag only gates what friends can see of
  // this user's calendars, not what the viewer sees of their own data.
  //
  // friendUserIds can never contain the viewer's own id (friend requests
  // reject self-friending — see lib/friendships.ts), so there's no risk of
  // double-counting the viewer even if they were somehow also passed in.
  const ownCalendars = await db
    .select()
    .from(googleCalendars)
    .where(eq(googleCalendars.userId, viewerId));

  const visibleCalendars = await getVisibleCalendars(viewerId);
  const friendCalendars = visibleCalendars.filter((c) =>
    options.friendUserIds.includes(c.userId),
  );

  const relevantCalendars = [...ownCalendars, ...friendCalendars];

  const busyByPerson = new Map<string, Interval[]>();
  // Seed the viewer's own entry unconditionally, even if they have no
  // calendars of their own — findFreeSlots treats an empty interval list as
  // simply contributing no busy time, so this is safe either way and keeps
  // the "viewer is always considered" intent explicit.
  busyByPerson.set(viewerId, []);
  for (const cal of relevantCalendars) {
    if (!busyByPerson.has(cal.userId)) busyByPerson.set(cal.userId, []);
  }

  if (relevantCalendars.length > 0) {
    const rows = await db
      .select()
      .from(events)
      .where(
        inArray(
          events.googleCalendarRowId,
          relevantCalendars.map((c) => c.id),
        ),
      );

    const calendarRowIdToUserId = new Map(
      relevantCalendars.map((c) => [c.id, c.userId]),
    );

    for (const row of rows) {
      const userId = calendarRowIdToUserId.get(row.googleCalendarRowId);
      if (!userId || !row.startAt || !row.endAt) continue;
      busyByPerson.get(userId)!.push({ start: row.startAt, end: row.endAt });
    }
  }

  return findFreeSlots(
    Array.from(busyByPerson.values()),
    { start: options.start, end: options.end },
    options.durationMinutes,
    // Spec default: 8am-10pm in the VIEWER'S local time.
    { startHour: 8, endHour: 22 },
    options.timezoneOffsetMinutes ?? 0,
  );
}

export async function resolveUsernamesToUserIds(usernames: string[]): Promise<string[]> {
  if (usernames.length === 0) return [];
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.username, usernames));
  return rows.map((r) => r.id);
}

export async function findMutualFreeSlotsByUsername(
  viewerId: string,
  options: {
    friendUsernames: string[];
    start: Date;
    end: Date;
    durationMinutes: number;
    timezoneOffsetMinutes?: number;
  },
): Promise<Interval[]> {
  const friendUserIds = await resolveUsernamesToUserIds(options.friendUsernames);
  return findMutualFreeSlots(viewerId, { ...options, friendUserIds });
}
