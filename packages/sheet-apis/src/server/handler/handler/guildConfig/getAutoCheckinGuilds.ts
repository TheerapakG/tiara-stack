import { getAutoCheckinGuildsHandlerConfig } from "@/server/handler/config";
import { Error } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();

export const getAutoCheckinGuildsHandler = pipe(
  builders.empty(),
  builders.data(getAutoCheckinGuildsHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.someToken()),
      Computed.flatMap(AuthService.verify),
      Computed.flatMapComputed(() =>
        Event.request.parsed(getAutoCheckinGuildsHandlerConfig),
      ),
      // ignore the literal request value, just fetch all matching guilds
      Computed.flatMapComputed(() => GuildConfigService.getAutoCheckinGuilds()),
      Computed.mapEffect(Error.Core.catchParseErrorAsValidationError),
      Computed.mapEffect(
        Handler.Config.encodeResponseEffect(getAutoCheckinGuildsHandlerConfig),
      ),
      Effect.withSpan("getAutoCheckinGuildsHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
