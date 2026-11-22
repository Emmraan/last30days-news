CREATE TABLE `category` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`builtin` integer DEFAULT false NOT NULL,
	`match_mode` text DEFAULT 'keywords' NOT NULL,
	`keywords` text DEFAULT '[]' NOT NULL,
	`prompt` text,
	`ai_threshold` real DEFAULT 0.6 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `category_item` (
	`category_id` text NOT NULL,
	`item_id` text NOT NULL,
	`prompt_hash` text NOT NULL,
	`score` real NOT NULL,
	`reason` text,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`category_id`, `item_id`, `prompt_hash`),
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `category_item_rank_idx` ON `category_item` (`category_id`,`prompt_hash`,`score`);--> statement-breakpoint
CREATE INDEX `category_item_item_idx` ON `category_item` (`item_id`);--> statement-breakpoint
CREATE TABLE `category_source` (
	`category_id` text NOT NULL,
	`source_id` text NOT NULL,
	PRIMARY KEY(`category_id`, `source_id`),
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `source`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `item` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`author` text,
	`published_at` integer NOT NULL,
	`published_estimated` integer DEFAULT false NOT NULL,
	`fetched_at` integer NOT NULL,
	`excerpt` text,
	`language` text,
	`category` text NOT NULL,
	`source_count` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`category`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `item_published_at_idx` ON `item` (`published_at`);--> statement-breakpoint
CREATE INDEX `item_category_published_at_idx` ON `item` (`category`,`published_at`);--> statement-breakpoint
CREATE INDEX `item_fetched_at_idx` ON `item` (`fetched_at`);--> statement-breakpoint
CREATE TABLE `item_source` (
	`item_id` text NOT NULL,
	`source_id` text NOT NULL,
	`url` text NOT NULL,
	`raw_title` text,
	PRIMARY KEY(`item_id`, `source_id`),
	FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `source`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `login_attempt` (
	`ip` text NOT NULL,
	`ts` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `login_attempt_ip_ts_idx` ON `login_attempt` (`ip`,`ts`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `setting` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
--> statement-breakpoint
CREATE TABLE `source` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`url` text NOT NULL,
	`category` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`fetch_interval_min` integer DEFAULT 30 NOT NULL,
	`last_fetched_at` integer,
	`last_status` text,
	`last_error` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`category`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `summary` (
	`item_id` text NOT NULL,
	`model` text NOT NULL,
	`body` text NOT NULL,
	`citations` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`tokens_in` integer,
	`tokens_out` integer,
	PRIMARY KEY(`item_id`, `model`),
	FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE cascade
);
