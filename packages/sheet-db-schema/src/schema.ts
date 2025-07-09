import {
  integer,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const configGuild = pgTable(
  "config_guild",
  {
    id: serial("id").primaryKey(),
    guildId: varchar("guild_id").notNull(),
    sheetId: varchar("sheet_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
  },
  (table) => [uniqueIndex("config_guild_guild_id_idx").on(table.guildId)],
);

export const configChannel = pgTable(
  "config_channel",
  {
    id: serial("id").primaryKey(),
    channelId: varchar("channel_id").notNull(),
    day: integer("day"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
  },
  (table) => [uniqueIndex("config_channel_channel_id_idx").on(table.channelId)],
);
