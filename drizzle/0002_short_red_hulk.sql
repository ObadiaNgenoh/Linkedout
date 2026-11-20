CREATE TABLE `follows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`followerId` int NOT NULL,
	`followingId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `follows_id` PRIMARY KEY(`id`),
	CONSTRAINT `follow_unique` UNIQUE(`followerId`,`followingId`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipientId` int NOT NULL,
	`actorId` int NOT NULL,
	`type` enum('link','reaction','comment','repost','message') NOT NULL,
	`postId` int,
	`message` varchar(240) NOT NULL,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `postViews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `postViews_id` PRIMARY KEY(`id`),
	CONSTRAINT `post_view_unique` UNIQUE(`postId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `reposts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reposts_id` PRIMARY KEY(`id`),
	CONSTRAINT `repost_unique` UNIQUE(`postId`,`userId`)
);
--> statement-breakpoint
ALTER TABLE `posts` ADD `content` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `postType` enum('exit','text','photo','video','repost') DEFAULT 'exit' NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `mediaUrl` varchar(1024);--> statement-breakpoint
ALTER TABLE `posts` ADD `mediaType` varchar(80);--> statement-breakpoint
ALTER TABLE `posts` ADD `viewCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `repostCount` int DEFAULT 0 NOT NULL;