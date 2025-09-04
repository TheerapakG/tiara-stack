import { DB } from "@/db";
import { bindObject } from "@/utils";
import { and, eq, isNull } from "drizzle-orm";
import { Array, Data, DateTime, Effect, Option, pipe } from "effect";
import {
  configGuild,
  configGuildChannel,
  configGuildManagerRole,
} from "sheet-db-schema";
import { Computed } from "typhoon-core/signal";
import { DBSubscriptionContext } from "typhoon-server/db";
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
        db: DB,
        dbSubscriptionContext: DBSubscriptionContext,
        guildService: GuildService,
      }),
      Effect.map(({ db, dbSubscriptionContext, guildService }) => ({
        getConfig: () =>
          pipe(
            guildService.getId(),
            Effect.flatMap((guildId) =>
              dbSubscriptionContext.subscribeQuery(
                db
                  .select()
                  .from(configGuild)
                  .where(
                    and(
                      eq(configGuild.guildId, guildId),
                      isNull(configGuild.deletedAt),
                    ),
                  ),
              ),
            ),
            Computed.map(Array.head),
            Computed.map(Option.map(GuildConfig.fromDbSelect)),
            Effect.withSpan("GuildConfigService.getConfig", {
              captureStackTrace: true,
            }),
          ),
        upsertConfig: (
          config: Omit<
            Partial<GuildConfigInsert>,
            "id" | "createdAt" | "updatedAt" | "deletedAt" | "guildId"
          >,
        ) =>
          pipe(
            guildService.getId(),
            Effect.flatMap((guildId) =>
              dbSubscriptionContext.mutateQuery(
                db
                  .insert(configGuild)
                  .values({
                    guildId,
                    ...config,
                  })
                  .onConflictDoUpdate({
                    target: [configGuild.guildId],
                    set: {
                      ...config,
                    },
                  }),
              ),
            ),
            Effect.withSpan("GuildConfigService.upsertConfig", {
              captureStackTrace: true,
            }),
          ),
        getManagerRoles: () =>
          pipe(
            guildService.getId(),
            Effect.flatMap((guildId) =>
              dbSubscriptionContext.subscribeQuery(
                db
                  .select()
                  .from(configGuildManagerRole)
                  .where(
                    and(
                      eq(configGuildManagerRole.guildId, guildId),
                      isNull(configGuildManagerRole.deletedAt),
                    ),
                  ),
              ),
            ),
            Computed.map(Array.map(GuildConfigManagerRole.fromDbSelect)),
            Effect.withSpan("GuildConfigService.getManagerRoles", {
              captureStackTrace: true,
            }),
          ),
        addManagerRole: (roleId: string) =>
          pipe(
            guildService.getId(),
            Effect.flatMap((guildId) =>
              dbSubscriptionContext.mutateQuery(
                db
                  .insert(configGuildManagerRole)
                  .values({ guildId, roleId })
                  .onConflictDoUpdate({
                    target: [
                      configGuildManagerRole.guildId,
                      configGuildManagerRole.roleId,
                    ],
                    set: { deletedAt: null },
                  }),
              ),
            ),
            Effect.withSpan("GuildConfigService.addManagerRole", {
              captureStackTrace: true,
            }),
          ),
        removeManagerRole: (roleId: string) =>
          pipe(
            Effect.Do,
            bindObject({
              guildId: guildService.getId(),
              now: DateTime.now,
            }),
            Effect.flatMap(({ guildId, now }) =>
              dbSubscriptionContext.mutateQuery(
                db
                  .update(configGuildManagerRole)
                  .set({ deletedAt: DateTime.toDate(now) })
                  .where(
                    and(
                      eq(configGuildManagerRole.guildId, guildId),
                      eq(configGuildManagerRole.roleId, roleId),
                    ),
                  )
                  .returning(),
              ),
            ),
            Effect.withSpan("GuildConfigService.removeManagerRole", {
              captureStackTrace: true,
            }),
          ),
        setChannelConfig: (
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
              dbSubscriptionContext.mutateQuery(
                db
                  .insert(configGuildChannel)
                  .values({ guildId, channelId, ...config })
                  .onConflictDoUpdate({
                    target: [
                      configGuildChannel.guildId,
                      configGuildChannel.channelId,
                    ],
                    set: { ...config, deletedAt: null },
                  })
                  .returning(),
                // TODO: handle channel conflict
              ),
            ),
            Effect.map(Array.head),
            Effect.map(Option.map(GuildChannelConfig.fromDbSelect)),
            Effect.withSpan("GuildConfigService.setChannelConfig", {
              captureStackTrace: true,
            }),
          ),
        getRunningChannelById: (id: string) =>
          pipe(
            guildService.getId(),
            Effect.flatMap((guildId) =>
              dbSubscriptionContext.subscribeQuery(
                db
                  .select()
                  .from(configGuildChannel)
                  .where(
                    and(
                      eq(configGuildChannel.guildId, guildId),
                      eq(configGuildChannel.channelId, id),
                      isNull(configGuildChannel.deletedAt),
                    ),
                  ),
              ),
            ),
            Computed.map(Array.head),
            Computed.map(Option.map(GuildChannelConfig.fromDbSelect)),
            Effect.withSpan("GuildConfigService.getRunningChannelById", {
              captureStackTrace: true,
            }),
          ),
        getRunningChannelByName: (name: string) =>
          pipe(
            guildService.getId(),
            Effect.flatMap((guildId) =>
              dbSubscriptionContext.subscribeQuery(
                db
                  .select()
                  .from(configGuildChannel)
                  .where(
                    and(
                      eq(configGuildChannel.guildId, guildId),
                      eq(configGuildChannel.name, name),
                      isNull(configGuildChannel.deletedAt),
                    ),
                  ),
              ),
            ),
            Computed.map(Array.head),
            Computed.map(Option.map(GuildChannelConfig.fromDbSelect)),
            Effect.withSpan("GuildConfigService.getRunningChannelByName", {
              captureStackTrace: true,
            }),
          ),
      })),
    ),
    dependencies: [DB.Default, DBSubscriptionContext.Default],
    accessors: true,
  },
) {}
