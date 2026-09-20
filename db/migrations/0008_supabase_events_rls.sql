-- Supabase Row Level Security for the merged view's Realtime subscription.
--
-- HAND-WRITTEN, not drizzle-kit generated: RLS, security-definer functions
-- and policies aren't expressible in the Drizzle schema DSL, so
-- `drizzle-kit generate` can neither produce nor detect them. Everything
-- here already exists in the production Supabase project (it was applied
-- there directly during Task 20) — this file exists so a fresh project or
-- branch built from this repo gets it too.
--
-- Why it matters: `events` is in the `supabase_realtime` publication, and
-- lib/supabase-realtime-token.ts mints a browser-visible token with
-- `role: "authenticated"` so each viewer can subscribe to their own
-- merged-view changes. A rebuild that had RLS enabled but NO policy would
-- either broadcast every row change to every authenticated subscriber, or
-- (with RLS enabled and no policy) silently show nobody anything. Both are
-- wrong, and the first is a cross-user data leak.
--
-- Written to be re-runnable so applying it against an environment that
-- already has it is a no-op rather than an error.

ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "google_calendars" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "friendships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- SECURITY DEFINER so the check can read `google_calendars` and
-- `friendships` — which are themselves RLS-enabled with no policies, i.e.
-- deny-all to `authenticated` — without granting the caller any access to
-- those tables. `search_path` is pinned so the function body can't be
-- redirected at a schema a caller controls.
CREATE OR REPLACE FUNCTION public.can_view_calendar(cal_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from google_calendars gc
    where gc.id = cal_id
      and ( gc.user_id = auth.uid()
            or ( gc.is_shared and exists (
                   select 1 from friendships f
                   where f.status = 'accepted'
                     and ( (f.requester_id = auth.uid() and f.recipient_id = gc.user_id)
                        or (f.recipient_id = auth.uid() and f.requester_id = gc.user_id) ) ) ) )
  );
$function$;--> statement-breakpoint

DROP POLICY IF EXISTS "events visible to owner or accepted friend of shared calendar" ON "events";--> statement-breakpoint
CREATE POLICY "events visible to owner or accepted friend of shared calendar"
  ON "events"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (can_view_calendar(google_calendar_row_id));--> statement-breakpoint

GRANT SELECT ON TABLE "events" TO authenticated;--> statement-breakpoint

-- Realtime only streams changes for tables in this publication. Guarded so
-- re-running (or running where `events` is already a member) doesn't error.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE events;
  END IF;
END
$$;
