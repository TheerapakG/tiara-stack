import { getGuildConfigByGuildIdHandlerConfig } from "@/server/handler/config";
import { GuildConfig } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, Function, pipe, Schema } from "effect";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const responseSchema = Schema.OptionFromNullishOr(GuildConfig, undefined);

const builders = Context.Subscription.Builder.builders();
export const getGuildConfigByGuildIdHandler = pipe(
  builders.empty(),
  builders.data(getGuildConfigByGuildIdHandlerConfig),
  builders.handler(
    pipe(
      Computed.make(Event.token()),
      Computed.flatMap(Effect.flatMap(AuthService.verify)),
      Computed.flatMapComputed(() =>
        Event.request.parsed(getGuildConfigByGuildIdHandlerConfig),
      ),
      Computed.flatMap((parsed) =>
        GuildConfigService.getGuildConfigByGuildId(parsed),
      ),
      Computed.flatMap(Function.identity),
      Computed.flatMap(Schema.encodeEither(responseSchema)),
      Effect.withSpan("getGuildConfigByGuildIdHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
