import { pgTable, text, timestamp, boolean, varchar } from "drizzle-orm/pg-core";

// Better Auth schema tables
// These are managed by Better Auth's Drizzle adapter

/**
 * User table - contains user authentication data
 *
 * Note: Discord OAuth tokens and Discord user ID are stored in the `account` table
 * by Better Auth's Discord provider. The account table acts as a junction table
 * to link internal users with external OAuth providers.
 */
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  name: text("name"),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Account table - stores OAuth provider data
 *
 * Better Auth automatically stores Discord OAuth data here:
 * - accountId: The Discord user ID (used for lookups)
 * - providerId: "discord"
 * - accessToken: Discord API access token
 * - refreshToken: For refreshing expired tokens
 * - accessTokenExpiresAt: Token expiration time
 *
 * This table acts as a junction table to find the internal user ID from
 * a Discord user ID (for K8s M2M auth) or vice versa.
 */
export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// OAuth 2.1 Provider tables
export const oauthClient = pgTable("oauth_client", {
  id: text("id").primaryKey(),
  name: text("name"),
  secret: text("secret"),
  redirectUris: text("redirect_uris").array(),
  type: varchar("type", { length: 20 }).notNull(), // "public" | "confidential"
  scopes: text("scopes").array(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const oauthAccessToken = pgTable("oauth_access_token", {
  id: text("id").primaryKey(),
  clientId: text("client_id")
    .notNull()
    .references(() => oauthClient.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  scopes: text("scopes").array(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const oauthRefreshToken = pgTable("oauth_refresh_token", {
  id: text("id").primaryKey(),
  accessTokenId: text("access_token_id")
    .notNull()
    .references(() => oauthAccessToken.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
