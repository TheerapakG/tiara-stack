import { Data, Effect, HashSet, Layer, Option, Context } from "effect";
import { Interaction } from "dfx-discord-utils/utils";
import { discordGatewayLayer } from "../discord/gateway";
import { SheetApisClient } from "./sheetApis";

export class PermissionError extends Data.TaggedError("PermissionError")<{
  readonly message: string;
}> {
  constructor(reason: string) {
    super({
      message: `You do not have permission. ${reason}`,
    });
  }
}

const getInteractionGuildId = Effect.gen(function* () {
  const interactionGuild = yield* Interaction.guild();
  return interactionGuild.pipe(Option.map((guild) => (guild as { id: string }).id));
});

const getInteractionUserId = Effect.gen(function* () {
  const interactionUser = yield* Interaction.user();
  return (interactionUser as { id: string }).id;
});

const resolveGuildId = Effect.fn("resolveGuildId")(function* (guildId?: string) {
  const resolvedInteractionGuildId: Option.Option<string> = yield* getInteractionGuildId;
  const resolvedGuildId: Option.Option<string> =
    typeof guildId === "undefined" ? resolvedInteractionGuildId : Option.some(guildId);

  if (Option.isSome(resolvedGuildId)) {
    return resolvedGuildId.value;
  }

  return yield* Effect.fail(new PermissionError("Interaction guild or provided guild not found"));
});

export class PermissionService extends Context.Service<PermissionService>()("PermissionService", {
  make: Effect.gen(function* () {
    const sheetApisClient = yield* SheetApisClient;

    const getCurrentUserPermissions = Effect.fn("PermissionService.getCurrentUserPermissions")(
      (guildId?: string) =>
        sheetApisClient
          .get()
          .permissions.getCurrentUserPermissions({
            query: typeof guildId === "undefined" ? {} : { guildId },
          })
          // The generated client still exposes the decoded payload as an array here.
          .pipe(Effect.map(({ permissions }) => HashSet.fromIterable(permissions))),
    );

    return {
      checkInteractionInGuild: Effect.fn("PermissionService.checkInteractionUserInGuild")(
        function* (guildId?: string) {
          const resolvedInteractionGuildId: Option.Option<string> = yield* getInteractionGuildId;
          const resolvedGuildId: Option.Option<string> =
            typeof guildId === "undefined" ? resolvedInteractionGuildId : Option.some(guildId);

          return Option.isSome(resolvedInteractionGuildId) && Option.isSome(resolvedGuildId)
            ? resolvedInteractionGuildId.value === resolvedGuildId.value
              ? yield* Effect.succeed(resolvedGuildId.value)
              : yield* Effect.fail(
                  new PermissionError("Interaction guild is not the same as the provided guild"),
                )
            : yield* Effect.fail(
                new PermissionError("Interaction guild or provided guild not found"),
              );
        },
      ),
      checkInteractionUserApplicationOwner: Effect.fn(
        "PermissionService.checkInteractionUserApplicationOwner",
      )(function* () {
        const resolvedAccountId = yield* getInteractionUserId;
        const permissions = yield* getCurrentUserPermissions();

        return HashSet.has(permissions, "app_owner")
          ? yield* Effect.succeed({
              accountId: resolvedAccountId,
            })
          : yield* Effect.fail(new PermissionError("User is not the owner of the application"));
      }),
      checkInteractionUserMonitorGuild: Effect.fn(
        "PermissionService.checkInteractionUserMonitorGuild",
      )(function* (guildId?: string) {
        const resolvedAccountId = yield* getInteractionUserId;
        const resolvedGuildId = yield* resolveGuildId(guildId);
        const permissions = yield* getCurrentUserPermissions(resolvedGuildId);

        return HashSet.has(permissions, `monitor_guild:${resolvedGuildId}`)
          ? yield* Effect.succeed({ accountId: resolvedAccountId, guildId: resolvedGuildId })
          : yield* Effect.fail(new PermissionError("User does not have monitor guild permission"));
      }),
    };
  }),
}) {
  static layer = Layer.effect(PermissionService, this.make).pipe(
    Layer.provide(SheetApisClient.layer),
    Layer.provide(discordGatewayLayer),
  );
}
