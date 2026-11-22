CREATE VIRTUAL TABLE `item_fts` USING fts5(
	`title`,
	`excerpt`,
	content='item',
	content_rowid='rowid',
	tokenize='unicode61 remove_diacritics 2'
);
--> statement-breakpoint
CREATE TRIGGER `item_fts_ai` AFTER INSERT ON `item` BEGIN
	INSERT INTO `item_fts`(`rowid`, `title`, `excerpt`)
	VALUES (new.`rowid`, new.`title`, coalesce(new.`excerpt`, ''));
END;
--> statement-breakpoint
CREATE TRIGGER `item_fts_ad` AFTER DELETE ON `item` BEGIN
	INSERT INTO `item_fts`(`item_fts`, `rowid`, `title`, `excerpt`)
	VALUES ('delete', old.`rowid`, old.`title`, coalesce(old.`excerpt`, ''));
END;
--> statement-breakpoint
CREATE TRIGGER `item_fts_au` AFTER UPDATE OF `title`, `excerpt` ON `item` BEGIN
	INSERT INTO `item_fts`(`item_fts`, `rowid`, `title`, `excerpt`)
	VALUES ('delete', old.`rowid`, old.`title`, coalesce(old.`excerpt`, ''));
	INSERT INTO `item_fts`(`rowid`, `title`, `excerpt`)
	VALUES (new.`rowid`, new.`title`, coalesce(new.`excerpt`, ''));
END;
