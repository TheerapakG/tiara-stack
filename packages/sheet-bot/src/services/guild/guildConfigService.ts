import { bindObject } from "@/utils";
import { Effect, pipe } from "effect";
import { configGuild, configGuildChannel } from "sheet-db-schema";
import { WebSocketClient } from "typhoon-client-ws/client";
import { SheetApisClient } from "~~/src/client/sheetApis";
import { GuildService } from "./guildService";

type GuildConfigInsert = typeof configGuild.$inferInsert;
type GuildChannelConfigInsert = typeof configGuildChannel.$inferInsert;

export class GuildConfigService extends Effect.Service<GuildConfigService>()(
  "GuildConfigService",
  {
    effect: pipe(
      Effect.Do,
      bindObject({
        guildService: GuildService,
        sheetApisClient: SheetApisClient,
      }),
      Effect.map(({ guildService, sheetApisClient }) => ({
        getAutoCheckinGuilds: () =>
          pipe(
            WebSocketClient.subscribeScoped(
              sheetApisClient.get(),
              "guildConfig.getAutoCheckinGuilds",
              {},
            ),
            Effect.map(
              Effect.withSpan(
                "GuildConfigService.getAutoCheckinGuilds subscription",
                {
                  captureStackTrace: true,
                },
              ),
            ),
            Effect.withSpan("GuildConfigService.getAutoCheckinGuilds", {
              captureStackTrace: true,
            }),
          ),
        getGuildConfigByGuildId: () =>
          pipe(
            guildService.getId(),
            Effect.flatMap((guildId) =>
              WebSocketClient.subscribeScoped(
                sheetApisClient.get(),
                "guildConfig.getGuildConfigByGuildId",
                guildId,
              ),
            ),
            Effect.map(
              Effect.withSpan(
                "GuildConfigService.getGuildConfigByGuildId subscription",
                {
                  captureStackTrace: true,
                },
              ),
            ),
            Effect.withSpan("GuildConfigService.getGuildConfigByGuildId", {
              captureStackTrace: true,
            }),
          ),
        upsertGuildConfig: (
          config: Omit<
            Partial<GuildConfigInsert>,
            "id" | "createdAt" | "updatedAt" | "deletedAt" | "guildId"
          >,
        ) =>
          pipe(
            guildService.getId(),
            Effect.flatMap((guildId) =>
              WebSocketClient.mutate(
                sheetApisClient.get(),
                "guildConfig.upsertGuildConfig",
                { guildId, ...config },
              ),
            ),
            Effect.withSpan("GuildConfigService.upsertGuildConfig", {
              captureStackTrace: true,
            }),
          ),
        getGuildManagerRoles: () =>
          pipe(
            guildService.getId(),
            Effect.flatMap((guildId) =>
              WebSocketClient.subscribeScoped(
                sheetApisClient.get(),
                "guildConfig.getGuildManagerRoles",
                guildId,
              ),
            ),
            Effect.map(
              Effect.withSpan(
                "GuildConfigService.getGuildManagerRoles subscription",
                {
                  captureStackTrace: true,
                },
              ),
            ),
            Effect.withSpan("GuildConfigService.getGuildManagerRoles", {
              captureStackTrace: true,
            }),
          ),
        addGuildManagerRole: (roleId: string) =>
          pipe(
            guildService.getId(),
            Effect.flatMap((guildId) =>
              WebSocketClient.mutate(
                sheetApisClient.get(),
                "guildConfig.addGuildManagerRole",
                { guildId, roleId },
              ),
            ),
            Effect.withSpan("GuildConfigService.addGuildManagerRole", {
              captureStackTrace: true,
            }),
          ),
        removeGuildManagerRole: (roleId: string) =>
          pipe(
            guildService.getId(),
            Effect.flatMap((guildId) =>
              WebSocketClient.mutate(
                sheetApisClient.get(),
                "guildConfig.removeGuildManagerRole",
                { guildId, roleId },
              ),
            ),
            Effect.withSpan("GuildConfigService.removeGuildManagerRole", {
              captureStackTrace: true,
            }),
          ),
        upsertGuildChannelConfig: (
          channelId: string,
          config: Omit<
            Partial<GuildChannelConfigInsert>,
            | "id"
            | "createdAt"
            | "updatedAt"
            | "deletedAt"
            | "guildId"
            | "channelId"
          >,
        ) =>
          pipe(
            guildService.getId(),
            Effect.flatMap((guildId) =>
              WebSocketClient.mutate(
                sheetApisClient.get(),
                "guildConfig.upsertGuildChannelConfig",
                { guildId, channelId, ...config },
              ),
            ),
            Effect.withSpan("GuildConfigService.upsertGuildChannelConfig", {
              captureStackTrace: true,
            }),
          ),
        getGuildConfigByScriptId: (scriptId: string) =>
          pipe(
            WebSocketClient.subscribeScoped(
              sheetApisClient.get(),
              "guildConfig.getGuildConfigByScriptId",
              scriptId,
            ),
            Effect.map(
              Effect.withSpan(
                "GuildConfigService.getGuildConfigByScriptId subscription",
                {
                  captureStackTrace: true,
                },
              ),
            ),
            Effect.withSpan("GuildConfigService.getGuildConfigByScriptId", {
              captureStackTrace: true,
            }),
          ),
        getGuildRunningChannelById: (channelId: string) =>
          pipe(
            guildService.getId(),
            Effect.flatMap((guildId) =>
              WebSocketClient.subscribeScoped(
                sheetApisClient.get(),
                "guildConfig.getGuildRunningChannelById",
                {
                  guildId,
                  channelId,
                },
              ),
            ),
            Effect.map(
              Effect.withSpan(
                "GuildConfigService.getGuildRunningChannelById subscription",
                {
                  captureStackTrace: true,
                },
              ),
            ),
            Effect.withSpan("GuildConfigService.getGuildRunningChannelById", {
              captureStackTrace: true,
            }),
          ),
        getGuildRunningChannelByName: (channelName: string) =>
          pipe(
            guildService.getId(),
            Effect.flatMap((guildId) =>
              WebSocketClient.subscribeScoped(
                sheetApisClient.get(),
                "guildConfig.getGuildRunningChannelByName",
                {
                  guildId,
                  channelName,
                },
              ),
            ),
            Effect.map(
              Effect.withSpan(
                "GuildConfigService.getGuildRunningChannelByName subscription",
                {
                  captureStackTrace: true,
                },
              ),
            ),
            Effect.withSpan("GuildConfigService.getGuildRunningChannelByName", {
              captureStackTrace: true,
            }),
          ),
      })),
    ),
    dependencies: [SheetApisClient.Default],
    accessors: true,
  },
) {}
