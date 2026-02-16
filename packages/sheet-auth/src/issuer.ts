import { issuer as createIssuer } from "@openauthjs/openauth";
import { AuthorizationState } from "@openauthjs/openauth/issuer";
import { DiscordProvider } from "@openauthjs/openauth/provider/discord";
import { Hono } from "hono";
import { BlankSchema } from "hono/types";

import { createRedisStorage } from "./storage";
import { subjects } from "./subjects";
import { KubernetesProvider } from "./provider/kubernetes";

interface CreateIssuerOptions {
  discordClientId: string;
  discordClientSecret: string;
  redisUrl: string;
  kubernetesAudience: string;
  kubernetesApiServerUrl: string;
}

async function fetchDiscordUser(accessToken: string) {
  const response = await fetch("https://discord.com/api/v10/users/@me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Discord user: ${response.statusText}`);
  }

  return response.json() as Promise<{
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
    bot?: boolean;
    system?: boolean;
    mfa_enabled?: boolean;
    banner?: string | null;
    accent_color?: number | null;
    locale?: string;
    verified?: boolean;
    email?: string | null;
    flags?: number;
    premium_type?: number;
    public_flags?: number;
  }>;
}

async function fetchDiscordGuilds(accessToken: string) {
  const response = await fetch("https://discord.com/api/v10/users/@me/guilds", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Discord guilds: ${response.statusText}`);
  }

  return response.json() as Promise<
    Array<{
      id: string;
      name: string;
      icon: string | null;
      owner: boolean;
      permissions: string;
      features: string[];
    }>
  >;
}

export function createAuthIssuer({
  discordClientId,
  discordClientSecret,
  redisUrl,
  kubernetesAudience,
  kubernetesApiServerUrl,
}: CreateIssuerOptions): Hono<
  {
    Variables: {
      authorization: AuthorizationState;
    };
  },
  BlankSchema,
  "/"
> {
  const storage = createRedisStorage(redisUrl);

  return createIssuer({
    storage,
    subjects,
    providers: {
      discord: DiscordProvider({
        clientID: discordClientId,
        clientSecret: discordClientSecret,
        scopes: ["identify", "guilds"],
      }),
      kubernetes: KubernetesProvider({
        audience: kubernetesAudience,
        apiServerUrl: kubernetesApiServerUrl,
      }),
    },
    async success(ctx, value) {
      if (value.provider === "discord") {
        const [discordUser, discordGuilds] = await Promise.all([
          fetchDiscordUser(value.tokenset.access),
          fetchDiscordGuilds(value.tokenset.access),
        ]);

        return ctx.subject("user", {
          discordUserId: discordUser.id,
          discordGuilds,
        });
      }

      if (value.provider === "kubernetes") {
        return ctx.subject("user", {
          discordUserId: value.discordUserId,
          discordGuilds: null,
        });
      }

      throw new Error("Unknown provider");
    },
  });
}
