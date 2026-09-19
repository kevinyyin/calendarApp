CREATE TABLE "google_calendars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"google_calendar_id" text NOT NULL,
	"display_name" text NOT NULL,
	"color" text NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"sync_token" text,
	"last_synced_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "google_calendars" ADD CONSTRAINT "google_calendars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;