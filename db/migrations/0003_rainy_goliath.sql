CREATE TABLE "watch_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"google_calendar_row_id" uuid NOT NULL,
	"channel_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "watch_channels" ADD CONSTRAINT "watch_channels_google_calendar_row_id_google_calendars_id_fk" FOREIGN KEY ("google_calendar_row_id") REFERENCES "public"."google_calendars"("id") ON DELETE cascade ON UPDATE no action;