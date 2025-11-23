import {
  ButtonInteractionT,
  CachedInteractionContext,
  channelServicesFromGuildChannelId,
  GuildMemberContext,
  guildMemberServicesFromInteraction,
  guildServicesFromInteraction,
  InGuildMessageContext,
  InteractionContext,
  MessageCheckinService,
  messageServices,
  SendableChannelContext,
} from "@/services";
import { ButtonHandlerVariantT, handlerVariantContextBuilder } from "@/types";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  InteractionButtonComponentData,
  MessageActionRowComponentBuilder,
  MessageFlags,
  userMention,
} from "discord.js";
import {
  Array,
  Effect,
  Either,
  Function,
  Number,
  Option,
  Order,
  pipe,
} from "effect";
import { Schema } from "sheet-apis";
import { Result, RpcResult } from "typhoon-core/schema";
import { Computed, DependencySignal, UntilObserver } from "typhoon-core/signal";

type MessageCheckinSignal = DependencySignal.DependencySignal<
  RpcResult.RpcResult<
    Result.Result<
      Either.Either<Schema.MessageCheckin, Schema.Error.Core.ArgumentError>,
      Either.Either<Schema.MessageCheckin, Schema.Error.Core.ArgumentError>
    >,
    unknown
  >,
  never,
  never
>;

type MessageCheckinMembersSignal = DependencySignal.DependencySignal<
  RpcResult.RpcResult<
    Result.Result<
      ReadonlyArray<Schema.MessageCheckinMember>,
      ReadonlyArray<Schema.MessageCheckinMember>
    >,
    unknown
  >,
  never,
  never
>;

const buttonData = {
  type: ComponentType.Button,
  customId: "interaction:checkin",
  label: "Check in",
  style: ButtonStyle.Primary,
  emoji: "907705464215711834",
} as const satisfies InteractionButtonComponentData;

export const button = handlerVariantContextBuilder<ButtonHandlerVariantT>()
  .data(buttonData)
  .handler(
    Effect.provide(guildServicesFromInteraction())(
      pipe(
        Effect.Do,
        InteractionContext.deferReply.tap(() => ({
          flags: MessageFlags.Ephemeral,
        })),
        InteractionContext.user.bind("user"),
        CachedInteractionContext.message<ButtonInteractionT>().bind("message"),
        Effect.bind("messageCheckinData", ({ message }) =>
          pipe(
            MessageCheckinService.getMessageCheckinData(message.id),
            Effect.flatMap((signal) =>
              pipe(
                Effect.succeed(signal as MessageCheckinSignal),
                Computed.map(
                  Result.fromRpcReturningResult<
                    Either.Either<
                      Schema.MessageCheckin,
                      Schema.Error.Core.ArgumentError
                    >
                  >(
                    Either.left(
                      Schema.Error.Core.makeArgumentError(
                        "Loading message checkin",
                      ),
                    ),
                  ),
                ),
                UntilObserver.observeUntilScoped(Result.isComplete),
                Effect.flatMap((result) =>
                  pipe(
                    result.value,
                    Either.flatMap(Function.identity),
                    Either.match({
                      onLeft: (error) => Effect.fail(error),
                      onRight: (value) => Effect.succeed(value),
                    }),
                  ),
                ),
              ),
            ),
          ),
        ),
        Effect.tap(({ message, user }) =>
          MessageCheckinService.setMessageCheckinMemberCheckinAt(
            message.id,
            user.id,
          ),
        ),
        InteractionContext.editReply.tap(() => ({
          content: "You have been checked in!",
        })),
        Effect.bind("checkedInMentions", ({ message }) =>
          pipe(
            MessageCheckinService.getMessageCheckinMembers(message.id),
            Effect.flatMap((signal) =>
              pipe(
                Effect.succeed(signal as MessageCheckinMembersSignal),
                Computed.map(
                  Result.fromRpcReturningResult<
                    ReadonlyArray<Schema.MessageCheckinMember>
                  >([] as ReadonlyArray<Schema.MessageCheckinMember>),
                ),
                UntilObserver.observeUntilScoped(Result.isComplete),
                Effect.flatMap((result) => {
                  const either = result.value as Either.Either<
                    ReadonlyArray<Schema.MessageCheckinMember>,
                    unknown
                  >;
                  return Either.isRight(either)
                    ? Effect.succeed<
                        ReadonlyArray<Schema.MessageCheckinMember>
                      >(either.right)
                    : Effect.fail(either.left);
                }),
              ),
            ),
            Effect.map((members) =>
              pipe(
                members,
                Array.filter((m) => Option.isSome(m.checkinAt)),
              ),
            ),
            Effect.flatMap((members) =>
              pipe(
                members,
                Array.map((m) => userMention(m.memberId)),
                Array.join(" "),
                Effect.succeed,
                Effect.when(() =>
                  pipe(
                    members,
                    Array.length,
                    Order.greaterThan(Number.Order)(0),
                  ),
                ),
              ),
            ),
          ),
        ),
        Effect.tap(({ messageCheckinData }) =>
          pipe(
            messageCheckinData.roleId,
            Effect.transposeMapOption((roleId) =>
              Effect.provide(guildMemberServicesFromInteraction())(
                GuildMemberContext.addRoles.sync(roleId),
              ),
            ),
          ),
        ),
        Effect.tap(({ message, user, messageCheckinData, checkedInMentions }) =>
          Effect.all([
            Effect.provide(messageServices(message))(
              InGuildMessageContext.edit.sync({
                content: pipe(
                  checkedInMentions,
                  Option.match({
                    onSome: (checkedInMentions) =>
                      `${messageCheckinData.initialMessage}\n\nChecked in: ${checkedInMentions}`,
                    onNone: () => messageCheckinData.initialMessage,
                  }),
                ),
                components: messageCheckinData.roleId
                  ? [
                      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
                        new ButtonBuilder(buttonData),
                      ),
                    ]
                  : [],
              }),
            ),
            pipe(
              SendableChannelContext.send().sync({
                content: `${userMention(user.id)} has checked in!`,
              }),
              Effect.provide(
                channelServicesFromGuildChannelId(messageCheckinData.channelId),
              ),
            ),
          ]),
        ),
        Effect.asVoid,
        Effect.withSpan("handleInteractionCheckin", {
          captureStackTrace: true,
        }),
      ),
    ),
  )
  .build();
