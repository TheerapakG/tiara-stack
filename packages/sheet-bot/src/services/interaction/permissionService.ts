import {
  PermissionResolvable,
  PermissionsBitField,
  RoleResolvable,
} from "discord.js";
import { Data, Effect, Equal, pipe } from "effect";
import { bindObject, tapify } from "../../utils";
import { GuildService } from "../guild";
import { ClientService } from "./clientService";
import {
  CachedInteractionContext,
  InteractionContext,
  InteractionT,
} from "./interactionContext";

export class OwnerError extends Data.TaggedError("OwnerError")<{
  readonly message: string;
}> {
  constructor() {
    super({
      message: "You cannot perm abuse like the owner of the bot.",
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
    effect: pipe(
      Effect.Do,
      bindObject({
        interaction: pipe(
          InteractionContext.interaction<InteractionT>(),
          Effect.either,
        ),
        cachedInteraction: pipe(
          CachedInteractionContext.interaction<InteractionT>(),
          Effect.either,
        ),
        client: ClientService.getClient(),
      }),
      Effect.map(({ interaction, cachedInteraction, client }) => ({
        checkOwner: ({ allowSameGuild }: { allowSameGuild?: boolean }) =>
          pipe(
            Effect.Do,
            bindObject({
              interactionGuildId: InteractionContext.guildId(),
              guiildGuildId: pipe(
                Effect.serviceOption(GuildService),
                Effect.flatMap(
                  Effect.transposeMapOption((guildService) =>
                    guildService.getId(),
                  ),
                ),
              ),
              interactionUser: InteractionContext.user(),
            }),
            Effect.flatMap(
              ({ interactionUser, interactionGuildId, guiildGuildId }) =>
                (allowSameGuild &&
                  Equal.equals(interactionGuildId, guiildGuildId)) ||
                interactionUser.id === client.application.owner?.id
                  ? Effect.void
                  : Effect.fail(new OwnerError()),
            ),
            Effect.withSpan("PermissionService.checkOwner", {
              captureStackTrace: true,
            }),
          ),
        checkPermissions: ({
          permissions,
          reason,
        }: {
          permissions: PermissionResolvable;
          reason?: string;
        }) =>
          pipe(
            interaction,
            Effect.flatMap((interaction) =>
              interaction.memberPermissions?.has(permissions)
                ? Effect.void
                : Effect.fail(
                    new PermissionError(
                      reason ??
                        `You do not have permission for ${new PermissionsBitField(permissions).toArray().join(", ")} to use this command`,
                    ),
                  ),
            ),
            Effect.withSpan("PermissionService.checkPermissions", {
              captureStackTrace: true,
            }),
          ),
        checkRoles: ({
          roles,
          reason,
        }: {
          roles: RoleResolvable[];
          reason?: string;
        }) =>
          pipe(
            interaction,
            Effect.flatMap((interaction) =>
              interaction.user.id === client.application.owner?.id
                ? Effect.void
                : pipe(
                    cachedInteraction,
                    Effect.flatMap((interaction) =>
                      interaction.member.roles.cache.some((role) =>
                        roles
                          .map((role) =>
                            interaction.guild.roles.resolveId(role),
                          )
                          .includes(role.id),
                      )
                        ? Effect.void
                        : Effect.fail(
                            new PermissionError(
                              reason ??
                                `You do not have necessary role to use this command`,
                            ),
                          ),
                    ),
                  ),
            ),
            Effect.withSpan("PermissionService.checkRoles", {
              captureStackTrace: true,
            }),
          ),
        addRole: (roleId: string) =>
          pipe(
            cachedInteraction,
            Effect.flatMap((interaction) =>
              Effect.tryPromise(() => interaction.member.roles.add(roleId)),
            ),
            Effect.withSpan("PermissionService.addRole", {
              captureStackTrace: true,
            }),
          ),
      })),
    ),
    accessors: true,
  },
) {
  static tapCheckOwner = tapify(PermissionService.checkOwner);
  static tapCheckPermissions = tapify(PermissionService.checkPermissions);

  static effectCheckRoles<E, R>({
    roles,
    reason,
  }: {
    roles: Effect.Effect<RoleResolvable[], E, R>;
    reason?: string;
  }) {
    return pipe(
      roles,
      Effect.tap((roles) => PermissionService.checkRoles({ roles, reason })),
    );
  }

  static tapCheckRoles<A, E1, R1>(
    f: (a: A) => {
      roles: Effect.Effect<RoleResolvable[], E1, R1>;
      reason?: string;
    },
  ) {
    return <E2, R2>(self: Effect.Effect<A, E2, R2>) =>
      pipe(
        self,
        Effect.tap((a) => PermissionService.effectCheckRoles(f(a))),
      );
  }

  static tapAddRole = tapify(PermissionService.addRole);
}
