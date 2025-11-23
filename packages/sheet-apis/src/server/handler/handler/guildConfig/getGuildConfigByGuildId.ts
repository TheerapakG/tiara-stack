import { getGuildConfigByGuildIdHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, Either, Scope, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { Result } from "typhoon-core/schema";

const builders = Context.Subscription.Builder.builders();
export const getGuildConfigByGuildIdHandler = pipe(
  builders.empty(),
  builders.data(getGuildConfigByGuildIdHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.someToken()),
      Computed.flatMap(AuthService.verify),
      Computed.flatMapComputed(() =>
        Event.request.parsedWithScope(getGuildConfigByGuildIdHandlerConfig),
      ),
      Computed.flatMapComputed(({ parsed, scope }) =>
        pipe(
          GuildConfigService.getGuildConfigByGuildId(parsed),
          Scope.extend(scope),
        ),
      ),
      Computed.map(
        Result.map(
          Either.fromOption(() =>
            Error.Core.makeArgumentError(
              "Cannot get guild config by guild id, the guild might not be registered",
            ),
          ),
        ),
      ),
      Computed.mapEffect(Error.Core.catchParseErrorAsValidationError),
      Computed.mapEffect(
        Handler.Config.encodeResponseEffect(
          getGuildConfigByGuildIdHandlerConfig,
        ),
      ),
      Effect.withSpan("getGuildConfigByGuildIdHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
