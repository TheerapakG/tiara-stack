import { Effect, Layer, ServiceMap } from "effect";
import {
  rolesApiCacheViewWithReverseLookup,
  rolesCacheViewWithReverseLookup,
  rolesWithReverseLookup,
  unstorageWithReverseLookupDriver,
} from "@/cache";
import { discordGatewayLayer } from "../gateway";
import { Unstorage } from "./shared";

export class RolesCache extends ServiceMap.Service<RolesCache>()("RolesCache", {
  make: Effect.gen(function* () {
    const storage = yield* Unstorage.prefixed("roles:");
    return yield* rolesWithReverseLookup(unstorageWithReverseLookupDriver({ storage }));
  }),
}) {
  static layer = Layer.effect(RolesCache, this.make).pipe(Layer.provide(discordGatewayLayer));
}

export class RolesCacheView extends ServiceMap.Service<RolesCacheView>()("RolesCacheView", {
  make: Effect.gen(function* () {
    const storage = yield* Unstorage.prefixed("roles:");
    return yield* rolesCacheViewWithReverseLookup(unstorageWithReverseLookupDriver({ storage }));
  }),
}) {
  static layer = Layer.effect(RolesCacheView, this.make);
}

export class RolesApiCacheView extends ServiceMap.Service<RolesApiCacheView>()(
  "RolesApiCacheView",
  {
    make: Effect.gen(function* () {
      const storage = yield* Unstorage.prefixed("roles:");
      return yield* rolesApiCacheViewWithReverseLookup(
        unstorageWithReverseLookupDriver({ storage }),
      );
    }),
  },
) {
  static layer = Layer.effect(RolesApiCacheView, this.make);
}
