"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-client";

type RawIncomingRow = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  googleCalendarRowId: string;
};

type CalendarMeta = {
  personUserId: string;
  personLabel: string;
  color: string;
};

type MergedEventWithId = {
  id: string;
  personUserId: string;
  personLabel: string;
  color: string;
  title: string;
  startAt: Date;
  endAt: Date;
};

// Shape of the raw Postgres row Supabase Realtime sends for the `events`
// table via `postgres_changes` (snake_case column names, as stored).
type RawPostgresEventRow = {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  google_calendar_row_id: string;
};

export function mergeIncomingEvent(
  existing: MergedEventWithId[],
  calendarMetaByRowId: Record<string, CalendarMeta>,
  incoming: RawIncomingRow,
): MergedEventWithId[] {
  const meta = calendarMetaByRowId[incoming.googleCalendarRowId];
  if (!meta) return existing;

  const withoutOld = existing.filter((e) => e.id !== incoming.id);
  return [
    ...withoutOld,
    {
      id: incoming.id,
      personUserId: meta.personUserId,
      personLabel: meta.personLabel,
      color: meta.color,
      title: incoming.title,
      startAt: new Date(incoming.startAt),
      endAt: new Date(incoming.endAt),
    },
  ];
}

export function RealtimeMergedView({
  initialEvents,
  calendarMetaByRowId,
  supabaseAccessToken,
  children,
}: {
  initialEvents: MergedEventWithId[];
  calendarMetaByRowId: Record<string, CalendarMeta>;
  supabaseAccessToken?: string;
  children: (events: MergedEventWithId[]) => React.ReactNode;
}) {
  const [rows, setRows] = useState(initialEvents);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient(supabaseAccessToken);
    const channel = supabase
      .channel("events-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        (payload) => {
          const row = (payload.new ?? payload.old) as RawPostgresEventRow;
          setRows((prev) =>
            mergeIncomingEvent(prev, calendarMetaByRowId, {
              id: row.id,
              title: row.title,
              startAt: row.start_at,
              endAt: row.end_at,
              googleCalendarRowId: row.google_calendar_row_id,
            }),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [calendarMetaByRowId, supabaseAccessToken]);

  return <>{children(rows)}</>;
}
