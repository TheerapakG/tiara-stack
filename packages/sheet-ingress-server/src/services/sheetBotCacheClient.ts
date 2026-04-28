import { Context, Effect, Layer, Option } from "effect";
import { SheetBotForwardingClient } from "./sheetBotForwardingClient";

export interface CachedGuildMember {
  readonly roles: ReadonlyArray<string>;
}

export interface CachedGuildRole {
  readonly id: string;
  readonly permissions: string;
}

export class SheetBotCacheClient extends Context.Service<SheetBotCacheClient>()(
  "SheetBotCacheClient",
  {
    make: Effect.gen(function* () {
      const sheetBotForwardingClient = yield* SheetBotForwardingClient;

      return {
        getMember: Effect.fn("SheetBotCacheClient.getMember")(function* (
          guildId: string,
          accountId: string,
        ) {
          return yield* sheetBotForwardingClient.cache
            .getMember({ params: { parentId: guildId, resourceId: accountId } })
            .pipe(
              Effect.map(({ value }) => Option.some({ roles: value.roles })),
              Effect.catchTag("CacheNotFoundError", () => Effect.succeed(Option.none())),
            );
        }),
        getRolesForGuild: Effect.fn("SheetBotCacheClient.getRolesForGuild")(function* (
          guildId: string,
        ) {
          const roles = yield* sheetBotForwardingClient.cache.getRolesForParent({
            params: { parentId: guildId },
          });

          return new Map<string, CachedGuildRole>(
            roles.map(({ value }) => [
              value.id,
              {
                id: value.id,
                permissions: value.permissions,
              } satisfies CachedGuildRole,
            ]),
          );
        }),
      };
    }),
  },
) {
  static layer = Layer.effect(SheetBotCacheClient, this.make).pipe(
    Layer.provide(SheetBotForwardingClient.layer),
  );
}
