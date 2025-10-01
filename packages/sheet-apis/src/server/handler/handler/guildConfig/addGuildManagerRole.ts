import { addGuildManagerRoleHandlerConfig } from "@/server/handler/config";
import { GuildConfigManagerRole } from "@/server/schema";
import { AuthService, GuildConfigService } from "@/server/services";
import { Effect, pipe, Schema } from "effect";
import { OnceObserver } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const responseSchema = Schema.OptionFromNullishOr(
  GuildConfigManagerRole,
  undefined,
);

const builders = Context.Mutation.Builder.builders();
export const addGuildManagerRoleHandler = pipe(
  builders.empty(),
  builders.data(addGuildManagerRoleHandlerConfig),
  builders.handler(
    pipe(
      Event.token(),
      Effect.flatMap(Effect.flatMap(AuthService.verify)),
      Effect.flatMap(() =>
        pipe(
          Event.request.parsed(addGuildManagerRoleHandlerConfig),
          Effect.flatMap(OnceObserver.observeOnce),
        ),
      ),
      Effect.flatMap((parsed) =>
        GuildConfigService.addGuildManagerRole(parsed.guildId, parsed.roleId),
      ),
      Effect.flatMap(Schema.encodeEither(responseSchema)),
      Effect.withSpan("addGuildManagerRoleHandler", {
        captureStackTrace: true,
      }),
    ),
  ),
);
