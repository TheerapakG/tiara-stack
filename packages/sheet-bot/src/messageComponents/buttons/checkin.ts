import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  InteractionButtonComponentData,
  Message,
  MessageActionRowComponentBuilder,
  MessageFlags,
  userMention,
} from "discord.js";
import { Array, Cause, Data, Effect, Function, Option, pipe } from "effect";
import { observeOnce } from "typhoon-server/signal";
import {
  ButtonInteractionT,
  CachedInteractionContext,
  channelServicesFromGuildChannelId,
  guildServicesFromInteraction,
  InteractionContext,
  MessageCheckinService,
  PermissionService,
  RepliableInteractionT,
  SendableChannelContext,
} from "../../services";
import {
  ButtonHandlerVariantT,
  handlerVariantContextBuilder,
} from "../../types";
import { bindObject } from "../../utils";

const buttonData = {
  type: ComponentType.Button,
  customId: "interaction:checkin",
  label: "Check in",
  style: ButtonStyle.Primary,
  emoji: "907705464215711834",
} as const satisfies InteractionButtonComponentData;

class CheckinError extends Data.TaggedError("CheckinError")<{
  readonly message: string;
}> {
  constructor(message: string) {
    super({ message });
  }
}

export const button = handlerVariantContextBuilder<ButtonHandlerVariantT>()
  .data(buttonData)
  .handler(
    Effect.provide(guildServicesFromInteraction())(
      pipe(
        Effect.Do,
        InteractionContext.deferReply.tap(() => ({
          flags: MessageFlags.Ephemeral,
        })),
        bindObject({
          message: CachedInteractionContext.message<ButtonInteractionT>(),
          user: InteractionContext.user(),
        }),
        Effect.bind("messageCheckinData", ({ message }) =>
          pipe(
            MessageCheckinService.getMessageCheckinData(message.id),
            Effect.flatMap(observeOnce),
            Effect.flatMap(Function.identity),
          ),
        ),
        Effect.tap(({ message, user }) =>
          pipe(
            MessageCheckinService.setMessageCheckinMemberCheckinAt(
              message.id,
              user.id,
            ),
            Effect.flatMap((checkinData) =>
              Effect.suspend<
                Message,
                CheckinError | Cause.UnknownException,
                InteractionContext<RepliableInteractionT>
              >(() =>
                pipe(
                  checkinData,
                  Option.match({
                    onSome: () =>
                      InteractionContext.editReply.effect({
                        content: "You have been checked in!",
                      }),
                    onNone: () =>
                      Effect.fail(
                        new CheckinError(
                          "I don't think you are in the list of players to check in...",
                        ),
                      ),
                  }),
                ),
              ),
            ),
          ),
        ),
        Effect.bind("checkedInMentions", ({ message }) =>
          pipe(
            MessageCheckinService.getMessageCheckinMembers(message.id),
            Effect.flatMap(observeOnce),
            Effect.map(Array.filter((m) => Option.isSome(m.checkinAt))),
            Effect.map(Array.map((m) => userMention(m.memberId))),
            Effect.map(Array.join(" ")),
          ),
        ),
        Effect.tap(({ messageCheckinData }) =>
          pipe(
            messageCheckinData.roleId,
            Option.match({
              onSome: (roleId) => PermissionService.addRole.effect(roleId),
              onNone: () => Effect.void,
            }),
          ),
        ),
        Effect.tap(({ message, user, messageCheckinData, checkedInMentions }) =>
          Effect.all([
            Effect.tryPromise(() =>
              message.edit({
                content:
                  checkedInMentions.length > 0
                    ? `${messageCheckinData.initialMessage}\n\nChecked in: ${checkedInMentions}`
                    : messageCheckinData.initialMessage,
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
              SendableChannelContext.send({
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
