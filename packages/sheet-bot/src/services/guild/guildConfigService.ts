import { bindObject } from "@/utils";
import { Effect, Either, pipe } from "effect";
import { configGuild, configGuildChannel } from "sheet-db-schema";
import { Schema } from "sheet-apis";
import { WebSocketClient } from "typhoon-client-ws/client";
import { Result } from "typhoon-core/schema";
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
        const withGuildId = <A, E, R>(
          f: (guildId: string) => Effect.Effect<A, E, R>,
        ): Effect.Effect<A, E, R> =>
          pipe(guildService.getId(), Effect.flatMap(f));

        const decodeResult = <Req, A>(
          handler: string,
          request: Req,
        ): Effect.Effect<A> =>
          pipe(
            WebSocketClient.once(
              sheetApisClient.get(),
              handler as any,
              request,
            ) as Effect.Effect<Result.Result<A>, never, never>,
            Effect.orDie,
            Effect.flatMap((result) =>
              Result.match({
                onOptimistic: Effect.succeed,
                onComplete: Effect.succeed,
              })(result),
            ),
          );

        const decodeEither = <Req, A>(
          handler: string,
          request: Req,
        ): Effect.Effect<A> =>
          pipe(
            decodeResult<Req, Either.Either<A, unknown>>(handler, request),
            Effect.flatMap(
              Either.match({
                onLeft: Effect.die,
                onRight: Effect.succeed,
              }),
            ),
          );

        const subscribe = <Req>(handler: string, request: Req) =>
          pipe(
            WebSocketClient.subscribeScoped(
              sheetApisClient.get(),
              handler as any,
              request,
            ),
          );

        return {
          getAutoCheckinGuilds: () =>
            pipe(
              decodeResult<
                Record<string, never>,
                ReadonlyArray<Schema.GuildConfig>
              >("guildConfig.getAutoCheckinGuilds", {}),
              Effect.withSpan("GuildConfigService.getAutoCheckinGuilds", {
                captureStackTrace: true,
              }),
            ),
          getGuildConfigByGuildId: () =>
            pipe(
              withGuildId((guildId) =>
                decodeEither<string, Schema.GuildConfig>(
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
              withGuildId((guildId) =>
                decodeResult<
                  string,
                  ReadonlyArray<Schema.GuildConfigManagerRole>
                >("guildConfig.getGuildManagerRoles", guildId),
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
              decodeEither<string, Schema.GuildConfig>(
                "guildConfig.getGuildConfigByScriptId",
                scriptId,
              ),
              Effect.withSpan("GuildConfigService.getGuildConfigByScriptId", {
                captureStackTrace: true,
              }),
            ),
          getGuildRunningChannelById: (channelId: string) =>
            pipe(
              withGuildId((guildId) =>
                subscribe("guildConfig.getGuildRunningChannelById", {
                  guildId,
                  channelId,
                }),
              ),
              Effect.withSpan("GuildConfigService.getGuildRunningChannelById", {
                captureStackTrace: true,
              }),
            ),
          getGuildRunningChannelByName: (channelName: string) =>
            pipe(
              withGuildId((guildId) =>
                subscribe("guildConfig.getGuildRunningChannelByName", {
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
        };
      }),
    ),
    dependencies: [SheetApisClient.Default],
    accessors: true,
  },
) {}
