import { ChatInputCommandInteraction } from "discord.js";
import { Data, Effect, pipe } from "effect";

export class OwnerError extends Data.TaggedError("OwnerError")<{
  readonly message: string;
}> {
  constructor() {
    super({
      message: "You cannot perm abuse like the owner of the bot.",
    });
  }
}

export class NotInGuildError extends Data.TaggedError("NotInGuildError")<{
  readonly message: string;
}> {
  constructor() {
    super({
      message:
        "You are not using this command in a guild. Please use this command in a guild.",
    });
  }
}

export class UncachedGuildError extends Data.TaggedError("UncachedGuildError")<{
  readonly message: string;
}> {
  constructor() {
    super({
      message:
        "This guild is not cached for some reason... Maybe try again later?",
    });
  }
}

export class PermissionError extends Data.TaggedError("PermissionError")<{
  readonly message: string;
}> {
  constructor(reason: string) {
    super({
      message: `You do not have permission. ${reason}`,
    });
  }
}

export class PermissionService extends Effect.Service<PermissionService>()(
  "PermissionService",
  {
    sync: () => ({
      checkOwner: (
        interaction: ChatInputCommandInteraction,
      ): Effect.Effect<void, OwnerError> =>
        pipe(
          interaction.user.id === interaction.client.application.owner?.id
            ? Effect.void
            : Effect.fail(new OwnerError()),
          Effect.withSpan("PermissionService.checkOwner", {
            captureStackTrace: true,
          }),
        ),
      checkRoles: (
        interaction: ChatInputCommandInteraction,
        roleIds: string[],
        reason: string,
      ): Effect.Effect<
        void,
        NotInGuildError | UncachedGuildError | PermissionError
      > =>
        pipe(
          interaction.user.id === interaction.client.application.owner?.id
            ? Effect.void
            : !interaction.inGuild()
              ? Effect.fail<
                  NotInGuildError | UncachedGuildError | PermissionError
                >(new NotInGuildError())
              : !interaction.inCachedGuild()
                ? Effect.fail(new UncachedGuildError())
                : interaction.member?.roles.cache.some((role) =>
                      roleIds.includes(role.id),
                    )
                  ? Effect.void
                  : Effect.fail(new PermissionError(reason)),
          Effect.withSpan("PermissionService.checkRoles", {
            captureStackTrace: true,
          }),
        ),
    }),
    accessors: true,
  },
) {}
