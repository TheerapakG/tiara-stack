import { Context, Effect, Layer, Option } from "effect";
import { SheetBotClient } from "./sheetBotClient";

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
      const sheetBotClient = yield* SheetBotClient;

      return {
        getMember: Effect.fn("SheetBotCacheClient.getMember")(function* (
          guildId: string,
          accountId: string,
        ) {
          return yield* sheetBotClient.cache
            .getMember({ params: { parentId: guildId, resourceId: accountId } })
            .pipe(
              Effect.map(({ value }) => Option.some({ roles: value.roles })),
              Effect.catchTag("CacheNotFoundError", () => Effect.succeed(Option.none())),
            );
        }),
        getRolesForGuild: Effect.fn("SheetBotCacheClient.getRolesForGuild")(function* (
          guildId: string,
        ) {
          const roles = yield* sheetBotClient.cache.getRolesForParent({
            params: { parentId: guildId },
          });

          return new Map(
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
    Layer.provide(SheetBotClient.layer),
  );
}
