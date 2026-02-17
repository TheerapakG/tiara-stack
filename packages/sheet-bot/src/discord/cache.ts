import { Effect, Layer, Redacted, pipe } from "effect";
import { Unstorage } from "dfx-discord-utils/discord";
import { config } from "@/config";

export const UnstorageLayer = pipe(
  Unstorage.PrefixedLive("discord:"),
  Layer.provide(
    Layer.unwrapEffect(
      Effect.gen(function* () {
        const redisUrl = yield* config.redisUrl;
        return Unstorage.RedisLive({ url: Redacted.value(redisUrl) });
      }),
    ),
  ),
);
