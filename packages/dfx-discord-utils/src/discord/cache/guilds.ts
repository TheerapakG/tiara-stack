import { CachePrelude } from "dfx/gateway";
import { Effect, Layer, Context } from "effect";
import { guildsApiCacheView, guildsCacheView, unstorageDriver } from "../../cache";
import { discordGatewayLayer } from "../gateway";
import { Unstorage } from "./shared";

export class GuildsCache extends Context.Service<GuildsCache>()("GuildsCache", {
  make: Effect.gen(function* () {
    const storage = yield* Unstorage.prefixed("guilds:");
    return yield* CachePrelude.guilds(unstorageDriver({ storage }));
  }),
}) {
  static layer = Layer.effect(GuildsCache, this.make).pipe(Layer.provide(discordGatewayLayer));
}

export class GuildsCacheView extends Context.Service<GuildsCacheView>()("GuildsCacheView", {
  make: Effect.gen(function* () {
    const storage = yield* Unstorage.prefixed("guilds:");
    return yield* guildsCacheView(unstorageDriver({ storage }));
  }),
}) {
  static layer = Layer.effect(GuildsCacheView, this.make);
}

export class GuildsApiCacheView extends Context.Service<GuildsApiCacheView>()(
  "GuildsApiCacheView",
  {
    make: Effect.gen(function* () {
      const storage = yield* Unstorage.prefixed("guilds:");
      return yield* guildsApiCacheView(unstorageDriver({ storage }));
    }),
  },
) {
  static layer = Layer.effect(GuildsApiCacheView, this.make);
}
