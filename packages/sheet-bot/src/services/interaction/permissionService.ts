import { GuildService } from "@/services/guild";
import { bindObject, wrap } from "@/utils";
import {
  PermissionResolvable,
  PermissionsBitField,
  RoleResolvable,
} from "discord.js";
import { Data, Effect, Option, String, pipe } from "effect";
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
          InteractionContext.interaction<InteractionT>().sync(),
          Effect.either,
        ),
        cachedInteraction: pipe(
          CachedInteractionContext.interaction<InteractionT>().sync(),
          Effect.either,
        ),
        applicationOwner: ClientService.getApplicationOwner(),
      }),
      Effect.map(({ interaction, cachedInteraction, applicationOwner }) => ({
        privateCheckOwner: ({ allowSameGuild }: { allowSameGuild?: boolean }) =>
          pipe(
            Effect.fail(new OwnerError()),
            Effect.unlessEffect(
              pipe(
                Effect.Do,
                InteractionContext.guildId().bind("interactionGuildId"),
                InteractionContext.user.bind("interactionUser"),
                bindObject({
                  guildGuildId: pipe(
                    Effect.serviceOption(GuildService),
                    Effect.flatMap(
                      Effect.transposeMapOption((guildService) =>
                        guildService.getId(),
                      ),
                    ),
                  ),
                }),
                Effect.map(
                  ({ interactionUser, interactionGuildId, guildGuildId }) =>
                    (allowSameGuild &&
                      Option.getEquivalence(String.Equivalence)(
                        interactionGuildId,
                        guildGuildId,
                      )) ||
                    Option.getEquivalence(String.Equivalence)(
                      Option.some(interactionUser.id),
                      pipe(
                        applicationOwner,
                        Option.map((owner) => owner.id),
                      ),
                    ),
                ),
              ),
            ),
            Effect.asVoid,
            Effect.withSpan("PermissionService.checkOwner", {
              captureStackTrace: true,
            }),
          ),
        privateCheckPermissions: ({
          permissions,
          reason,
        }: {
          permissions: PermissionResolvable;
          reason?: string;
        }) =>
          pipe(
            Effect.fail(
              new PermissionError(
                reason ??
                  `You do not have permission for ${new PermissionsBitField(permissions).toArray().join(", ")} to use this command`,
              ),
            ),
            Effect.unlessEffect(
              pipe(
                interaction,
                Effect.map(
                  (interaction) =>
                    interaction.memberPermissions?.has(permissions) ?? false,
                ),
              ),
            ),
            Effect.asVoid,
            Effect.withSpan("PermissionService.checkPermissions", {
              captureStackTrace: true,
            }),
          ),
        privateCheckRoles: ({
          roles,
          reason,
        }: {
          roles: RoleResolvable[];
          reason?: string;
        }) =>
          pipe(
            Effect.fail(
              new PermissionError(
                reason ?? `You do not have necessary role to use this command`,
              ),
            ),
            Effect.unlessEffect(
              pipe(
                cachedInteraction,
                Effect.map((interaction) =>
                  interaction.member.roles.cache.some((role) =>
                    roles
                      .map((role) => interaction.guild.roles.resolveId(role))
                      .includes(role.id),
                  ),
                ),
              ),
            ),
            Effect.unlessEffect(
              pipe(
                interaction,
                Effect.map((interaction) =>
                  Option.getEquivalence(String.Equivalence)(
                    Option.some(interaction.user.id),
                    pipe(
                      applicationOwner,
                      Option.map((owner) => owner.id),
                    ),
                  ),
                ),
              ),
            ),
            Effect.asVoid,
            Effect.withSpan("PermissionService.checkRoles", {
              captureStackTrace: true,
            }),
          ),
      })),
    ),
    accessors: true,
  },
) {
  static checkOwner = wrap(PermissionService.privateCheckOwner);
  static checkPermissions = wrap(PermissionService.privateCheckPermissions);
  static checkRoles = wrap(PermissionService.privateCheckRoles);
}
