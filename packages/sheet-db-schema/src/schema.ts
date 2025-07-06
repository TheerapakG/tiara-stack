import {
  index,
  pgTable,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const configGuild = pgTable(
  "config_guild",
  {
    id: serial("id").primaryKey(),
    guildId: varchar("guild_id").notNull(),
    sheetId: varchar("sheet_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
  },
  (table) => [index("config_guild_guild_id_idx").on(table.guildId)],
);
