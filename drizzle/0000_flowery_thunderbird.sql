CREATE TABLE `quote_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_code` text NOT NULL,
	`drawing_name` text NOT NULL,
	`part_count` integer NOT NULL,
	`matched_count` integer NOT NULL,
	`pretax_total` real NOT NULL,
	`tax_amount` real NOT NULL,
	`grand_total` real NOT NULL,
	`status` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_quote_runs_project_created` ON `quote_runs` (`project_code`,`created_at`);