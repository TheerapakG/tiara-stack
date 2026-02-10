import { bindObject } from "@/utils";
import { Effect, pipe } from "effect";
import { SheetApisClient } from "@/client/sheetApis";
import { GuildService } from "./guildService";

export class GuildConfigService extends Effect.Service<GuildConfigService>()("GuildConfigService", {
  effect: pipe(
    Effect.Do,
    bindObject({
      guildService: GuildService,
      sheetApisClient: SheetApisClient,
    }),
    Effect.map(({ guildService, sheetApisClient }) => ({
      getGuildConfigByGuildId: () =>
        pipe(
          guildService.getId(),
          Effect.flatMap((guildId) =>
            sheetApisClient.get().guildConfig.getGuildConfigByGuildId({ urlParams: { guildId } }),
          ),
          Effect.withSpan("GuildConfigService.getGuildConfigByGuildId", {
            captureStackTrace: true,
          }),
        ),
      upsertGuildConfig: (config: {
        scriptId?: string | null | undefined;
        sheetId?: string | null | undefined;
        autoCheckin?: boolean | null | undefined;
      }) =>
        pipe(
          guildService.getId(),
          Effect.flatMap((guildId) =>
            sheetApisClient.get().guildConfig.upsertGuildConfig({
              payload: {
                guildId,
                config,
              },
            }),
          ),
          Effect.withSpan("GuildConfigService.upsertGuildConfig", {
            captureStackTrace: true,
          }),
        ),
      getGuildManagerRoles: () =>
        pipe(
          guildService.getId(),
          Effect.flatMap((guildId) =>
            sheetApisClient.get().guildConfig.getGuildManagerRoles({ urlParams: { guildId } }),
          ),
          Effect.withSpan("GuildConfigService.getGuildManagerRoles", {
            captureStackTrace: true,
          }),
        ),
      addGuildManagerRole: (roleId: string) =>
        pipe(
          guildService.getId(),
          Effect.flatMap((guildId) =>
            sheetApisClient.get().guildConfig.addGuildManagerRole({ payload: { guildId, roleId } }),
          ),
          Effect.withSpan("GuildConfigService.addGuildManagerRole", {
            captureStackTrace: true,
          }),
        ),
      removeGuildManagerRole: (roleId: string) =>
        pipe(
          guildService.getId(),
          Effect.flatMap((guildId) =>
            sheetApisClient
              .get()
              .guildConfig.removeGuildManagerRole({ payload: { guildId, roleId } }),
          ),
          Effect.withSpan("GuildConfigService.removeGuildManagerRole", {
            captureStackTrace: true,
          }),
        ),
      upsertGuildChannelConfig: (
        channelId: string,
        config: {
          name?: string | null | undefined;
          running?: boolean | null | undefined;
          roleId?: string | null | undefined;
          checkinChannelId?: string | null | undefined;
        },
      ) =>
        pipe(
          guildService.getId(),
          Effect.flatMap((guildId) =>
            sheetApisClient.get().guildConfig.upsertGuildChannelConfig({
              payload: {
                guildId,
                channelId,
                config,
              },
            }),
          ),
          Effect.withSpan("GuildConfigService.upsertGuildChannelConfig", {
            captureStackTrace: true,
          }),
        ),
      getGuildConfigByScriptId: (scriptId: string) =>
        pipe(
          sheetApisClient.get().guildConfig.getGuildConfigByScriptId({ urlParams: { scriptId } }),
          Effect.withSpan("GuildConfigService.getGuildConfigByScriptId", {
            captureStackTrace: true,
          }),
        ),
      getGuildRunningChannelById: (channelId: string) =>
        pipe(
          guildService.getId(),
          Effect.flatMap((guildId) =>
            sheetApisClient
              .get()
              .guildConfig.getGuildRunningChannelById({ urlParams: { guildId, channelId } }),
          ),
          Effect.withSpan("GuildConfigService.getGuildRunningChannelById", {
            captureStackTrace: true,
          }),
        ),
      getGuildRunningChannelByName: (channelName: string) =>
        pipe(
          guildService.getId(),
          Effect.flatMap((guildId) =>
            sheetApisClient.get().guildConfig.getGuildRunningChannelByName({
              urlParams: { guildId, channelName },
            }),
          ),
          Effect.withSpan("GuildConfigService.getGuildRunningChannelByName", {
            captureStackTrace: true,
          }),
        ),
    })),
  ),
  dependencies: [SheetApisClient.Default],
  accessors: true,
}) {}
