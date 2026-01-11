import {
  boolean,
  index,
  integer,
  pgTable,
  real,
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
    scriptId: varchar("script_id"),
    sheetId: varchar("sheet_id"),
    autoCheckin: boolean("auto_checkin").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    uniqueIndex("config_guild_guild_id_idx").on(table.guildId),
    index("config_guild_script_id_idx").on(table.scriptId),
    index("config_guild_sheet_id_idx").on(table.sheetId),
  ],
);

export const configGuildManagerRole = pgTable(
  "config_guild_manager_role",
  {
    id: serial("id").primaryKey(),
    guildId: varchar("guild_id").notNull(),
    roleId: varchar("role_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    uniqueIndex("config_guild_manager_role_guild_id_role_id_idx").on(table.guildId, table.roleId),
  ],
);

export const configGuildChannel = pgTable(
  "config_guild_channel",
  {
    id: serial("id").primaryKey(),
    guildId: varchar("guild_id").notNull(),
    channelId: varchar("channel_id").notNull(),
    name: varchar("name"),
    running: boolean("running").notNull(),
    roleId: varchar("role_id"),
    checkinChannelId: varchar("checkin_channel_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    uniqueIndex("config_guild_channel_guild_id_channel_id_idx").on(table.guildId, table.channelId),
    uniqueIndex("config_guild_channel_guild_id_name_idx").on(table.guildId, table.name),
  ],
);

export const messageSlot = pgTable(
  "message_slot",
  {
    id: serial("id").primaryKey(),
    messageId: varchar("message_id").notNull(),
    day: integer("day").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
  },
  (table) => [uniqueIndex("message_slot_message_id_idx").on(table.messageId)],
);

export const messageCheckin = pgTable(
  "message_checkin",
  {
    id: serial("id").primaryKey(),
    messageId: varchar("message_id").notNull(),
    initialMessage: varchar("initial_message").notNull(),
    hour: integer("hour").notNull(),
    channelId: varchar("channel_id").notNull(),
    roleId: varchar("role_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
  },
  (table) => [uniqueIndex("message_checkin_message_id_idx").on(table.messageId)],
);

export const messageCheckinMember = pgTable(
  "message_checkin_member",
  {
    id: serial("id").primaryKey(),
    messageId: varchar("message_id").notNull(),
    memberId: varchar("member_id").notNull(),
    checkinAt: timestamp("checkin_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    uniqueIndex("message_checkin_member_message_id_member_id_idx").on(
      table.messageId,
      table.memberId,
    ),
  ],
);

export const messageRoomOrder = pgTable(
  "message_room_order",
  {
    id: serial("id").primaryKey(),
    messageId: varchar("message_id").notNull(),
    previousFills: varchar("previous_fills").array().notNull(),
    fills: varchar("fills").array().notNull(),
    hour: integer("hour").notNull(),
    rank: integer("rank").notNull(),
    monitor: varchar("monitor"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
  },
  (table) => [uniqueIndex("message_room_order_message_id_idx").on(table.messageId)],
);

export const messageRoomOrderEntry = pgTable(
  "message_room_order_entry",
  {
    id: serial("id").primaryKey(),
    messageId: varchar("message_id").notNull(),
    hour: integer("hour").notNull(),
    rank: integer("rank").notNull(),
    position: integer("position").notNull(),
    team: varchar("team").notNull(),
    tags: varchar("tags").array().notNull(),
    effectValue: real("effect_value").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    uniqueIndex("message_room_order_entry_message_id_rank_position_idx").on(
      table.messageId,
      table.rank,
      table.position,
    ),
    index("message_room_order_entry_message_id_rank_idx").on(table.messageId, table.rank),
  ],
);
