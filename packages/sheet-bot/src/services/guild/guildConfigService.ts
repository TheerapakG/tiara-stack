import { bindObject } from "@/utils";
import { Data, Effect, Option, pipe } from "effect";
import {
  configGuild,
  configGuildChannel,
  configGuildManagerRole,
} from "sheet-db-schema";
import { WebSocketClient } from "typhoon-client-ws/client";
import { SheetApisClient } from "~~/src/client/sheetApis";
import { GuildService } from "./guildService";

type GuildConfigInsert = typeof configGuild.$inferInsert;
type GuildConfigSelect = typeof configGuild.$inferSelect;
type GuildConfigManagerRoleSelect = typeof configGuildManagerRole.$inferSelect;
type GuildChannelConfigInsert = typeof configGuildChannel.$inferInsert;
type GuildChannelConfigSelect = typeof configGuildChannel.$inferSelect;

export class GuildConfig extends Data.TaggedClass("GuildConfig")<{
  id: number;
  guildId: string;
  scriptId: Option.Option<string>;
  sheetId: Option.Option<string>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Option.Option<Date>;
}> {
  static fromDbSelect = (select: GuildConfigSelect) =>
    new GuildConfig({
      id: select.id,
      guildId: select.guildId,
      scriptId: Option.fromNullable(select.scriptId),
      sheetId: Option.fromNullable(select.sheetId),
      createdAt: select.createdAt,
      updatedAt: select.updatedAt,
      deletedAt: Option.fromNullable(select.deletedAt),
    });
}

export class GuildConfigManagerRole extends Data.TaggedClass(
  "GuildConfigManagerRole",
)<{
  id: number;
  guildId: string;
  roleId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Option.Option<Date>;
}> {
  static fromDbSelect = (select: GuildConfigManagerRoleSelect) =>
    new GuildConfigManagerRole({
      id: select.id,
      guildId: select.guildId,
      roleId: select.roleId,
      createdAt: select.createdAt,
      updatedAt: select.updatedAt,
      deletedAt: Option.fromNullable(select.deletedAt),
    });
}

export class GuildChannelConfig extends Data.TaggedClass("GuildChannelConfig")<{
  id: number;
  guildId: string;
  channelId: string;
  name: Option.Option<string>;
  running: boolean;
  roleId: Option.Option<string>;
  checkinChannelId: Option.Option<string>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Option.Option<Date>;
}> {
  static fromDbSelect = (select: GuildChannelConfigSelect) =>
    new GuildChannelConfig({
      id: select.id,
      guildId: select.guildId,
      channelId: select.channelId,
      name: Option.fromNullable(select.name),
      running: select.running,
      roleId: Option.fromNullable(select.roleId),
      checkinChannelId: Option.fromNullable(select.checkinChannelId),
      createdAt: select.createdAt,
      updatedAt: select.updatedAt,
      deletedAt: Option.fromNullable(select.deletedAt),
    });
}

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
        getGuildConfigByGuildId: () =>
          pipe(
            guildService.getId(),
            Effect.flatMap((guildId) =>
              WebSocketClient.once(
                sheetApisClient.get(),
                "guildConfig.getGuildConfigByGuildId",
                guildId,
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
              WebSocketClient.once(
                sheetApisClient.get(),
                "guildConfig.getGuildManagerRoles",
                guildId,
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
        getGuildRunningChannelById: (channelId: string) =>
          pipe(
            guildService.getId(),
            Effect.flatMap((guildId) =>
              WebSocketClient.once(
                sheetApisClient.get(),
                "guildConfig.getGuildRunningChannelById",
                { guildId, channelId },
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
              WebSocketClient.once(
                sheetApisClient.get(),
                "guildConfig.getGuildRunningChannelByName",
                { guildId, channelName },
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
