CREATE TABLE `emailChallenges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`codeHash` varchar(128) NOT NULL,
	`purpose` enum('signup','login') NOT NULL,
	`name` text,
	`username` varchar(32),
	`deviceId` varchar(128),
	`expiresAt` timestamp NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `emailChallenges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastUsedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessions_tokenHash_unique` UNIQUE(`tokenHash`)
);
