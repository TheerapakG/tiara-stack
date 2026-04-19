import { betterAuth, type Auth as BetterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, jwt } from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createSecondaryStorage } from "./storage";
import type { Driver } from "unstorage";
import { kubernetesOAuth } from "./plugins/kubernetes-oauth";
import * as schema from "./schema";
import { sessionToken } from "./plugins/session-token";

interface CreateAuthOptions {
  postgresUrl: string;
  discordClientId: string;
  discordClientSecret: string;
  kubernetesAudience: string;
  baseUrl: string;
  trustedOrigins?: string[];
  cookieDomain?: string;
  secondaryStorageDriver: Driver;
}

export type Auth = BetterAuth<BetterAuthOptions>;

type BaseAuthOptions = Omit<CreateAuthOptions, "postgresUrl" | "secondaryStorageDriver"> & {
  db: ReturnType<typeof drizzle>;
  secondaryStorage: ReturnType<typeof createSecondaryStorage>;
};

type CleanupMethods = {
  close: () => Promise<void>;
  closeStorage: () => Promise<void>;
};

function createBaseAuth({
  db,
  discordClientId,
  discordClientSecret,
  kubernetesAudience,
  baseUrl,
  trustedOrigins,
  cookieDomain,
  secondaryStorage,
}: BaseAuthOptions) {
  return betterAuth({
    baseURL: baseUrl,
    basePath: "/",
    database: drizzleAdapter(db, { provider: "pg", schema }),
    socialProviders: {
      discord: {
        clientId: discordClientId,
        clientSecret: discordClientSecret,
        scope: ["identify", "guilds"],
      },
    },
    plugins: [
      bearer(),
      sessionToken(),
      jwt(),
      oauthProvider({
        loginPage: "/sign-in",
        consentPage: "/consent",
      }),
      kubernetesOAuth({
        audience: kubernetesAudience,
      }),
    ],
    secondaryStorage,
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      // Required for @better-auth/oauth-provider when using secondaryStorage
      // The oauth-provider needs to query sessions by ID from the database
      storeSessionInDatabase: true,
    },
    advanced: {
      cookiePrefix: "sheet_auth",
      crossSubDomainCookies: {
        enabled: true,
        domain: cookieDomain,
      },
    },
    trustedOrigins: trustedOrigins ?? [baseUrl],
  });
}

export type AuthWithCleanup = ReturnType<typeof createBaseAuth> & CleanupMethods;

export function authConfig({
  postgresUrl,
  discordClientId,
  discordClientSecret,
  kubernetesAudience,
  baseUrl,
  trustedOrigins,
  cookieDomain,
  secondaryStorageDriver,
}: CreateAuthOptions): AuthWithCleanup {
  const pgClient = postgres(postgresUrl);
  const db = drizzle(pgClient);

  // Create secondary storage from driver
  const secondaryStorage = createSecondaryStorage(secondaryStorageDriver);

  const auth = createBaseAuth({
    db,
    discordClientId,
    discordClientSecret,
    kubernetesAudience,
    baseUrl,
    trustedOrigins,
    cookieDomain,
    secondaryStorage,
  });

  return Object.assign(auth, {
    close: () => pgClient.end(),
    closeStorage: () => secondaryStorage.close(),
  });
}
