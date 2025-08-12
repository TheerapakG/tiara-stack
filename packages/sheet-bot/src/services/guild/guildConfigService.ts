import { and, eq, isNull } from "drizzle-orm";
import { Array, Effect, pipe } from "effect";
import {
  configGuild,
  configGuildChannel,
  configGuildManagerRole,
} from "sheet-db-schema";
import { DBSubscriptionContext } from "typhoon-server/db";
import { DB } from "../../db";
import { GuildService } from "./guildService";

export class GuildConfigService extends Effect.Service<GuildConfigService>()(
  "GuildConfigService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bindAll(
        () => ({
          db: DB,
          dbSubscriptionContext: DBSubscriptionContext,
          guildService: GuildService,
        }),
        { concurrency: "unbounded" },
      ),
      Effect.map(({ db, dbSubscriptionContext, guildService }) => ({
        getConfig: () =>
          pipe(
            guildService.getGuild(),
            Effect.flatMap((guild) =>
              dbSubscriptionContext.subscribeQuery(
                db
                  .select()
                  .from(configGuild)
                  .where(
                    and(
                      eq(configGuild.guildId, guild.id),
                      isNull(configGuild.deletedAt),
                    ),
                  ),
              ),
            ),
            Effect.withSpan("GuildConfigService.getConfig", {
              captureStackTrace: true,
            }),
          ),
        updateConfig: (
          config: Omit<Partial<typeof configGuild.$inferInsert>, "guildId">,
        ) =>
          pipe(
            guildService.getGuild(),
            Effect.flatMap((guild) =>
              dbSubscriptionContext.mutateQuery(
                db
                  .insert(configGuild)
                  .values({
                    guildId: guild.id,
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
            Effect.withSpan("GuildConfigService.updateConfig", {
              captureStackTrace: true,
            }),
          ),
        getManagerRoles: () =>
          pipe(
            guildService.getGuild(),
            Effect.flatMap((guild) =>
              dbSubscriptionContext.subscribeQuery(
                db
                  .select()
                  .from(configGuildManagerRole)
                  .where(
                    and(
                      eq(configGuildManagerRole.guildId, guild.id),
                      isNull(configGuildManagerRole.deletedAt),
                    ),
                  ),
              ),
            ),
            Effect.withSpan("GuildConfigService.getManagerRoles", {
              captureStackTrace: true,
            }),
          ),
        addManagerRole: (roleId: string) =>
          pipe(
            guildService.getGuild(),
            Effect.flatMap((guild) =>
              dbSubscriptionContext.mutateQuery(
                db
                  .insert(configGuildManagerRole)
                  .values({ guildId: guild.id, roleId })
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
            guildService.getGuild(),
            Effect.flatMap((guild) =>
              dbSubscriptionContext.mutateQuery(
                db
                  .update(configGuildManagerRole)
                  .set({ deletedAt: new Date() })
                  .where(
                    and(
                      eq(configGuildManagerRole.guildId, guild.id),
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
          config: Pick<
            typeof configGuildChannel.$inferInsert,
            "running" | "name" | "roleId"
          >,
        ) =>
          pipe(
            guildService.getGuild(),
            Effect.flatMap((guild) =>
              dbSubscriptionContext.mutateQuery(
                db
                  .insert(configGuildChannel)
                  .values({ guildId: guild.id, channelId, ...config })
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
            Effect.flatMap(Array.head),
            Effect.withSpan("GuildConfigService.setChannelConfig", {
              captureStackTrace: true,
            }),
          ),
        getRunningChannelById: (id: string) =>
          pipe(
            guildService.getGuild(),
            Effect.flatMap((guild) =>
              dbSubscriptionContext.subscribeQuery(
                db
                  .select()
                  .from(configGuildChannel)
                  .where(
                    and(
                      eq(configGuildChannel.guildId, guild.id),
                      eq(configGuildChannel.channelId, id),
                      isNull(configGuildChannel.deletedAt),
                    ),
                  ),
              ),
            ),
            Effect.withSpan("GuildConfigService.getRunningChannelById", {
              captureStackTrace: true,
            }),
          ),
        getRunningChannelByName: (name: string) =>
          pipe(
            guildService.getGuild(),
            Effect.flatMap((guild) =>
              dbSubscriptionContext.subscribeQuery(
                db
                  .select()
                  .from(configGuildChannel)
                  .where(
                    and(
                      eq(configGuildChannel.guildId, guild.id),
                      eq(configGuildChannel.name, name),
                      isNull(configGuildChannel.deletedAt),
                    ),
                  ),
              ),
            ),
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
