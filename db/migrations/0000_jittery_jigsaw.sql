CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"display_name" varchar(100),
	"avatar_url" text,
	"tier" varchar(20) DEFAULT 'free' NOT NULL,
	"preferred_currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"timezone" varchar(50) DEFAULT 'UTC' NOT NULL,
	"stripe_customer_id" varchar(60),
	"onboarding_complete" boolean DEFAULT false NOT NULL,
	"markets_traded" text[],
	"broker" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"direction" varchar(5) NOT NULL,
	"entry_price" numeric(18, 8),
	"exit_price" numeric(18, 8),
	"size_lots" numeric(14, 4),
	"pnl_usd" numeric(14, 2),
	"commission" numeric(10, 4),
	"swap" numeric(10, 4),
	"stop_loss" numeric(18, 8),
	"take_profit" numeric(18, 8),
	"session" varchar(20),
	"setup_tag" varchar(80),
	"signal_source" varchar(100),
	"source" varchar(20) NOT NULL,
	"broker_trade_id" varchar(60),
	"is_paper_trade" boolean DEFAULT false NOT NULL,
	"entry_at" timestamp with time zone NOT NULL,
	"exit_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_trade_user_broker" UNIQUE("user_id","broker_trade_id")
);
--> statement-breakpoint
CREATE TABLE "trade_screenshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"r2_key" text NOT NULL,
	"r2_url" text NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emotion_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"pre_mood" integer,
	"post_mood" integer,
	"pre_note" text,
	"post_note" text,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_emotion_log_trade" UNIQUE("trade_id")
);
--> statement-breakpoint
CREATE TABLE "rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_violations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid NOT NULL,
	"rule_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"violated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_violation_trade_rule" UNIQUE("trade_id","rule_id")
);
--> statement-breakpoint
CREATE TABLE "setup_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_setup_tag_user_name" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "stats_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"win_rate" numeric(5, 2),
	"total_pnl" numeric(14, 2),
	"avg_rr" numeric(6, 3),
	"total_trades" integer DEFAULT 0 NOT NULL,
	"closed_trades" integer DEFAULT 0 NOT NULL,
	"open_trades" integer DEFAULT 0 NOT NULL,
	"rule_compliance_pct" numeric(5, 2),
	"phantom_pnl" numeric(14, 2),
	"behavioral_gap" numeric(14, 2),
	"best_setup" varchar(80),
	"worst_session" varchar(20),
	"best_session" varchar(20),
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_stats_cache_user" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"milestone_key" varchar(60) NOT NULL,
	"achieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_milestone_user_key" UNIQUE("user_id","milestone_key")
);
--> statement-breakpoint
CREATE TABLE "weekly_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"total_pnl" numeric(14, 2),
	"win_rate" numeric(5, 2),
	"total_trades" integer DEFAULT 0 NOT NULL,
	"rule_compliance_pct" numeric(5, 2),
	"best_trade_id" uuid,
	"worst_trade_id" uuid,
	"ai_narrative" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_weekly_summary_user_week" UNIQUE("user_id","week_start")
);
--> statement-breakpoint
CREATE TABLE "ai_context_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tilt_summary" text,
	"behavioral_notes" text,
	"context_hash" varchar(64),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_ai_context_user" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_screenshots" ADD CONSTRAINT "trade_screenshots_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_screenshots" ADD CONSTRAINT "trade_screenshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotion_logs" ADD CONSTRAINT "emotion_logs_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotion_logs" ADD CONSTRAINT "emotion_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_violations" ADD CONSTRAINT "rule_violations_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_violations" ADD CONSTRAINT "rule_violations_rule_id_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_violations" ADD CONSTRAINT "rule_violations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setup_tags" ADD CONSTRAINT "setup_tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stats_cache" ADD CONSTRAINT "stats_cache_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_milestones" ADD CONSTRAINT "user_milestones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_summaries" ADD CONSTRAINT "weekly_summaries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_summaries" ADD CONSTRAINT "weekly_summaries_best_trade_id_trades_id_fk" FOREIGN KEY ("best_trade_id") REFERENCES "public"."trades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_summaries" ADD CONSTRAINT "weekly_summaries_worst_trade_id_trades_id_fk" FOREIGN KEY ("worst_trade_id") REFERENCES "public"."trades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_context_cache" ADD CONSTRAINT "ai_context_cache_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;