import {
  BaseGuildMemberT,
  GuildMemberContext,
  GuildMemberKind,
  GuildMemberT,
} from "@/services/guildMember";
import { CachedInteractionContext } from "@/services/interaction";
import { Effect, Layer, pipe } from "effect";

export const guildMemberServices = <M extends BaseGuildMemberT = GuildMemberT>(
  member: GuildMemberKind<M>,
) =>
  pipe(
    Layer.succeedContext(GuildMemberContext.make<M>(member)),
    Effect.succeed,
    Effect.withSpan("guildMemberServices", {
      captureStackTrace: true,
      attributes: {
        guildMemberId: member.id,
      },
    }),
    Layer.unwrapEffect,
  );

export const guildMemberServicesFromInteraction = () =>
  pipe(
    CachedInteractionContext.member().sync(),
    Effect.map((member) => guildMemberServices<GuildMemberT>(member)),
    Effect.withSpan("guildMemberServicesFromInteraction", {
      captureStackTrace: true,
    }),
    Layer.unwrapEffect,
  );
