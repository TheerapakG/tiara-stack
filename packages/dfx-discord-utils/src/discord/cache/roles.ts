import { Effect, Layer, Context } from "effect";
import {
  rolesApiCacheViewWithReverseLookup,
  rolesCacheViewWithReverseLookup,
  rolesWithReverseLookup,
  unstorageWithReverseLookupDriver,
} from "@/cache";
import { discordGatewayLayer } from "../gateway";
import { Unstorage } from "./shared";

export class RolesCache extends Context.Service<RolesCache>()("RolesCache", {
  make: Effect.gen(function* () {
    const storage = yield* Unstorage.prefixed("roles:");
    return yield* rolesWithReverseLookup(unstorageWithReverseLookupDriver({ storage }));
  }),
}) {
  static layer = Layer.effect(RolesCache, this.make).pipe(Layer.provide(discordGatewayLayer));
}

export class RolesCacheView extends Context.Service<RolesCacheView>()("RolesCacheView", {
  make: Effect.gen(function* () {
    const storage = yield* Unstorage.prefixed("roles:");
    return yield* rolesCacheViewWithReverseLookup(unstorageWithReverseLookupDriver({ storage }));
  }),
}) {
  static layer = Layer.effect(RolesCacheView, this.make);
}

export class RolesApiCacheView extends Context.Service<RolesApiCacheView>()("RolesApiCacheView", {
  make: Effect.gen(function* () {
    const storage = yield* Unstorage.prefixed("roles:");
    return yield* rolesApiCacheViewWithReverseLookup(unstorageWithReverseLookupDriver({ storage }));
  }),
}) {
  static layer = Layer.effect(RolesApiCacheView, this.make);
}
