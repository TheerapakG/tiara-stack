import { Effect, Layer, ServiceMap } from "effect";
import {
  membersApiCacheViewWithReverseLookup,
  membersCacheViewWithReverseLookup,
  membersWithReverseLookup,
  unstorageWithReverseLookupDriver,
} from "@/cache";
import { discordGatewayLayer } from "../gateway";
import { Unstorage } from "./shared";

export class MembersCache extends ServiceMap.Service<MembersCache>()("MembersCache", {
  make: Effect.gen(function* () {
    const storage = yield* Unstorage.prefixed("members:");
    return yield* membersWithReverseLookup(unstorageWithReverseLookupDriver({ storage }));
  }),
}) {
  static layer = Layer.effect(MembersCache, this.make).pipe(Layer.provide(discordGatewayLayer));
}

export class MembersCacheView extends ServiceMap.Service<MembersCacheView>()("MembersCacheView", {
  make: Effect.gen(function* () {
    const storage = yield* Unstorage.prefixed("members:");
    return yield* membersCacheViewWithReverseLookup(unstorageWithReverseLookupDriver({ storage }));
  }),
}) {
  static layer = Layer.effect(MembersCacheView, this.make);
}

export class MembersApiCacheView extends ServiceMap.Service<MembersApiCacheView>()(
  "MembersApiCacheView",
  {
    make: Effect.gen(function* () {
      const storage = yield* Unstorage.prefixed("members:");
      return yield* membersApiCacheViewWithReverseLookup(
        unstorageWithReverseLookupDriver({ storage }),
      );
    }),
  },
) {
  static layer = Layer.effect(MembersApiCacheView, this.make);
}
