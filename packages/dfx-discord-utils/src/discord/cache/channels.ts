import { Effect, Layer, Context } from "effect";
import {
  channelsApiCacheViewWithReverseLookup,
  channelsCacheViewWithReverseLookup,
  channelsWithReverseLookup,
  unstorageWithReverseLookupDriver,
} from "@/cache";
import { discordGatewayLayer } from "../gateway";
import { Unstorage } from "./shared";

export class ChannelsCache extends Context.Service<ChannelsCache>()("ChannelsCache", {
  make: Effect.gen(function* () {
    const storage = yield* Unstorage.prefixed("channels:");
    return yield* channelsWithReverseLookup(unstorageWithReverseLookupDriver({ storage }));
  }),
}) {
  static layer = Layer.effect(ChannelsCache, this.make).pipe(Layer.provide(discordGatewayLayer));
}

export class ChannelsCacheView extends Context.Service<ChannelsCacheView>()("ChannelsCacheView", {
  make: Effect.gen(function* () {
    const storage = yield* Unstorage.prefixed("channels:");
    return yield* channelsCacheViewWithReverseLookup(unstorageWithReverseLookupDriver({ storage }));
  }),
}) {
  static layer = Layer.effect(ChannelsCacheView, this.make);
}

export class ChannelsApiCacheView extends Context.Service<ChannelsApiCacheView>()(
  "ChannelsApiCacheView",
  {
    make: Effect.gen(function* () {
      const storage = yield* Unstorage.prefixed("channels:");
      return yield* channelsApiCacheViewWithReverseLookup(
        unstorageWithReverseLookupDriver({ storage }),
      );
    }),
  },
) {
  static layer = Layer.effect(ChannelsApiCacheView, this.make);
}
