import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { kubernetesOAuth } from "./plugins/kubernetes-oauth";

interface CreateAuthOptions {
  postgresUrl: string;
  discordClientId: string;
  discordClientSecret: string;
  kubernetesAudience: string;
  baseUrl: string;
}

// Infer the Auth type from betterAuth return type
type BetterAuthInstance = ReturnType<typeof betterAuth>;

export type Auth = BetterAuthInstance;

export interface AuthWithCleanup extends Auth {
  close: () => Promise<void>;
}

export function authConfig({
  postgresUrl,
  discordClientId,
  discordClientSecret,
  kubernetesAudience,
  baseUrl,
}: CreateAuthOptions): AuthWithCleanup {
  const pgClient = postgres(postgresUrl);
  const db = drizzle(pgClient);

  const auth = betterAuth({
    baseURL: baseUrl,
    database: drizzleAdapter(db, { provider: "pg" }),
    socialProviders: {
      discord: {
        clientId: discordClientId,
        clientSecret: discordClientSecret,
        scope: ["identify", "guilds"],
      },
    },
    plugins: [
      jwt({
        disableSettingJwtHeader: true,
        jwks: {
          jwksPath: "/.well-known/jwks.json",
        },
        // Use standard JWT payload (sub, email, name) - no custom claims
      }),
      oauthProvider({
        loginPage: "/sign-in",
        consentPage: "/consent",
      }),
      kubernetesOAuth({
        audience: kubernetesAudience,
      }),
    ],
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    advanced: {
      crossSubDomainCookies: {
        enabled: false,
      },
    },
  });

  return Object.assign(auth, {
    close: () => pgClient.end(),
  });
}
