CREATE TABLE `live_wishlists` (
	`owner` text NOT NULL,
	`product_id` text NOT NULL,
	PRIMARY KEY(`owner`, `product_id`)
);
--> statement-breakpoint
CREATE TABLE `provider_carts` (
	`owner` text PRIMARY KEY NOT NULL,
	`cart_id` text NOT NULL
);
