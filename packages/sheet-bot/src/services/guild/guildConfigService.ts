import { bindObject } from "@/utils";
import { Effect, Either, pipe } from "effect";
import { configGuild, configGuildChannel } from "sheet-db-schema";
import { WebSocketClient } from "typhoon-client-ws/client";
import { Result } from "typhoon-core/schema";
import { UntilObserver } from "typhoon-core/signal";
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
      Effect.map(({ guildService, sheetApisClient }) => {
        const waitForComplete = <Req, A>(
          name: string,
          request: Req,
        ): Effect.Effect<A> =>
          pipe(
            WebSocketClient.subscribeScoped(
              sheetApisClient.get(),
              name as any,
              request,
            ),
            UntilObserver.observeUntilScoped(Result.isComplete),
            Effect.map((result) => result.value as A),
          );

        const fetchEither = <Req, A>(
          name: string,
          request: Req,
        ): Effect.Effect<A> =>
          pipe(
            waitForComplete<Req, Either.Either<A, unknown>>(name, request),
            Effect.flatMap(
              Either.match({
                onLeft: Effect.fail,
                onRight: Effect.succeed,
              }),
            ),
          );

        const withGuildId = <A>(
          f: (guildId: string) => Effect.Effect<A>,
        ): Effect.Effect<A> => pipe(guildService.getId(), Effect.flatMap(f));

        return {
          getAutoCheckinGuilds: () =>
            pipe(
              waitForComplete("guildConfig.getAutoCheckinGuilds", {}),
              Effect.withSpan("GuildConfigService.getAutoCheckinGuilds", {
                captureStackTrace: true,
              }),
            ),
          getGuildConfigByGuildId: () =>
            pipe(
              withGuildId((guildId) =>
                fetchEither("guildConfig.getGuildConfigByGuildId", guildId),
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
              withGuildId((guildId) =>
                waitForComplete("guildConfig.getGuildManagerRoles", guildId),
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
              withGuildId((guildId) =>
                fetchEither("guildConfig.getGuildRunningChannelById", {
                  guildId,
                  channelId,
                }),
              ),
              Effect.withSpan("GuildConfigService.getGuildRunningChannelById", {
                captureStackTrace: true,
              }),
            ),
          observeGuildRunningChannelById: (channelId: string) =>
            pipe(
              guildService.getId(),
              Effect.flatMap((guildId) =>
                WebSocketClient.subscribeScoped(
                  sheetApisClient.get(),
                  "guildConfig.getGuildRunningChannelById",
                  { guildId, channelId },
                ),
              ),
              Effect.withSpan(
                "GuildConfigService.observeGuildRunningChannelById",
                {
                  captureStackTrace: true,
                },
              ),
            ),
          getGuildRunningChannelByName: (channelName: string) =>
            pipe(
              withGuildId((guildId) =>
                fetchEither("guildConfig.getGuildRunningChannelByName", {
                  guildId,
                  channelName,
                }),
              ),
              Effect.withSpan(
                "GuildConfigService.getGuildRunningChannelByName",
                {
                  captureStackTrace: true,
                },
              ),
            ),
          observeGuildRunningChannelByName: (channelName: string) =>
            pipe(
              guildService.getId(),
              Effect.flatMap((guildId) =>
                WebSocketClient.subscribeScoped(
                  sheetApisClient.get(),
                  "guildConfig.getGuildRunningChannelByName",
                  { guildId, channelName },
                ),
              ),
              Effect.withSpan(
                "GuildConfigService.observeGuildRunningChannelByName",
                {
                  captureStackTrace: true,
                },
              ),
            ),
        };
      }),
    ),
    dependencies: [SheetApisClient.Default],
    accessors: true,
  },
) {}
