CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"google_calendar_row_id" uuid NOT NULL,
	"google_event_id" text NOT NULL,
	"title" text,
	"description" text,
	"location" text,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"is_all_day" boolean DEFAULT false NOT NULL,
	"status" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_google_calendar_row_id_google_calendars_id_fk" FOREIGN KEY ("google_calendar_row_id") REFERENCES "public"."google_calendars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "events_calendar_event_unique" ON "events" USING btree ("google_calendar_row_id","google_event_id");