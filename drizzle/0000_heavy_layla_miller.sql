CREATE TABLE "logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"level" varchar(20) NOT NULL,
	"message" text NOT NULL,
	"context" jsonb,
	"request_id" varchar,
	"user_id" varchar,
	"endpoint" varchar,
	"status_code" integer,
	"error_stack" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" varchar NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"response_status" integer,
	"response_body" text,
	"response_headers" jsonb,
	"duration" integer,
	"success" integer NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"url" text NOT NULL,
	"secret" varchar(255),
	"events" jsonb NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"user_id" varchar,
	"description" text,
	"headers" jsonb,
	"retry_count" integer DEFAULT 3,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_logs_timestamp" ON "logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "IDX_logs_level" ON "logs" USING btree ("level");--> statement-breakpoint
CREATE INDEX "IDX_logs_request_id" ON "logs" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "IDX_logs_user_id" ON "logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "IDX_webhook_deliveries_webhook_id" ON "webhook_deliveries" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX "IDX_webhook_deliveries_event_type" ON "webhook_deliveries" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "IDX_webhook_deliveries_created_at" ON "webhook_deliveries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "IDX_webhook_deliveries_success" ON "webhook_deliveries" USING btree ("success");--> statement-breakpoint
CREATE INDEX "IDX_webhooks_user_id" ON "webhooks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_webhooks_active" ON "webhooks" USING btree ("active");