import { HttpApiBuilder } from "effect/unstable/httpapi";

import { Effect, Layer, Option } from "effect";
import { Api } from "@/api";
import {
  withCurrentGuildAuthFromPayload,
  withCurrentGuildAuthFromQuery,
} from "@/handlers/shared/guildAuthorization";
import { makeArgumentError } from "typhoon-core/error";
import { GuildConfigService } from "@/services";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { AuthorizationService } from "@/services";

export const guildConfigLayer = HttpApiBuilder.group(
  Api,
  "guildConfig",
  Effect.fn(function* (handlers) {
    const authorizationService = yield* AuthorizationService;
    const guildConfigService = yield* GuildConfigService;
    const withQueryGuildAuth = withCurrentGuildAuthFromQuery(authorizationService);
    const withPayloadGuildAuth = withCurrentGuildAuthFromPayload(authorizationService);

    return handlers
      .handle(
        "getAutoCheckinGuilds",
        Effect.fnUntraced(function* () {
          yield* authorizationService.requireService();
          return yield* guildConfigService.getAutoCheckinGuilds();
        }),
      )
      .handle(
        "getGuildConfig",
        withQueryGuildAuth(
          Effect.fnUntraced(function* ({ query }) {
            yield* authorizationService.requireManageGuild(query.guildId);
            const config = yield* guildConfigService.getGuildConfig(query.guildId);

            if (Option.isNone(config)) {
              return yield* Effect.fail(
                makeArgumentError("Cannot get guild config, the guild might not be registered"),
              );
            }

            return config.value;
          }),
        ),
      )
      .handle(
        "upsertGuildConfig",
        withPayloadGuildAuth(
          Effect.fnUntraced(function* ({ payload }) {
            yield* authorizationService.requireManageGuild(payload.guildId);
            return yield* guildConfigService.upsertGuildConfig(payload.guildId, payload.config);
          }),
        ),
      )
      .handle("getGuildMonitorRoles", ({ query }) =>
        guildConfigService.getGuildMonitorRoles(query.guildId),
      )
      .handle("getGuildChannels", ({ query }) =>
        guildConfigService.getGuildChannels({
          guildId: query.guildId,
          ...(typeof query.running === "undefined" ? {} : { running: query.running }),
        }),
      )
      .handle(
        "addGuildMonitorRole",
        withPayloadGuildAuth(
          Effect.fnUntraced(function* ({ payload }) {
            yield* authorizationService.requireManageGuild(payload.guildId);
            return yield* guildConfigService.addGuildMonitorRole(payload.guildId, payload.roleId);
          }),
        ),
      )
      .handle(
        "removeGuildMonitorRole",
        withPayloadGuildAuth(
          Effect.fnUntraced(function* ({ payload }) {
            yield* authorizationService.requireManageGuild(payload.guildId);
            return yield* guildConfigService.removeGuildMonitorRole(
              payload.guildId,
              payload.roleId,
            );
          }),
        ),
      )
      .handle(
        "upsertGuildChannelConfig",
        withPayloadGuildAuth(
          Effect.fnUntraced(function* ({ payload }) {
            yield* authorizationService.requireManageGuild(payload.guildId);
            return yield* guildConfigService.upsertGuildChannelConfig(
              payload.guildId,
              payload.channelId,
              payload.config,
            );
          }),
        ),
      )
      .handle(
        "getGuildChannelById",
        Effect.fnUntraced(function* ({ query }) {
          const config = yield* guildConfigService.getGuildChannelById({
            guildId: query.guildId,
            channelId: query.channelId,
            running: query.running,
          });

          if (Option.isNone(config)) {
            return yield* Effect.fail(
              makeArgumentError(
                typeof query.running === "undefined"
                  ? "Cannot get channel by id, the guild or the channel id might not be registered"
                  : "Cannot get channel by id, the guild or the channel id might not be registered or does not match the specified running status",
              ),
            );
          }

          return config.value;
        }),
      )
      .handle(
        "getGuildChannelByName",
        Effect.fnUntraced(function* ({ query }) {
          const config = yield* guildConfigService.getGuildChannelByName({
            guildId: query.guildId,
            channelName: query.channelName,
            running: query.running,
          });

          if (Option.isNone(config)) {
            return yield* Effect.fail(
              makeArgumentError(
                typeof query.running === "undefined"
                  ? "Cannot get channel by name, the guild or the channel name might not be registered"
                  : "Cannot get channel by name, the guild or the channel name might not be registered or does not match the specified running status",
              ),
            );
          }

          return config.value;
        }),
      );
  }),
).pipe(
  Layer.provide([
    AuthorizationService.layer,
    GuildConfigService.layer,
    SheetAuthTokenAuthorizationLive,
  ]),
);
