CREATE TABLE "merged_view_prefs" (
	"viewer_id" uuid NOT NULL,
	"friend_id" uuid NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "merged_view_prefs_viewer_id_friend_id_pk" PRIMARY KEY("viewer_id","friend_id")
);
--> statement-breakpoint
ALTER TABLE "merged_view_prefs" ADD CONSTRAINT "merged_view_prefs_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merged_view_prefs" ADD CONSTRAINT "merged_view_prefs_friend_id_users_id_fk" FOREIGN KEY ("friend_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;