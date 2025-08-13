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
import { Array, Data, Effect, Function, pipe } from "effect";
import { observeOnce } from "typhoon-server/signal";
import {
  ClientService,
  MessageCheckinService,
  PermissionService,
} from "../services";
import {
  buttonInteractionHandlerContextBuilder,
  ButtonInteractionT,
  CachedInteractionContext,
  InteractionContext,
} from "../types";
import { bindObject } from "../utils";

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

export const button = buttonInteractionHandlerContextBuilder()
  .data(buttonData)
  .handler(
    pipe(
      Effect.Do,
      InteractionContext.tapDeferReply({ flags: MessageFlags.Ephemeral }),
      bindObject({
        client: ClientService.getClient(),
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
          Effect.tap((values) =>
            Array.length(values) > 0
              ? InteractionContext.editReply({
                  content: "You have been checked in!",
                })
              : Effect.fail(
                  new CheckinError(
                    "I don't think you are in the list of players to check in...",
                  ),
                ),
          ),
        ),
      ),
      Effect.bind("checkedInMentions", ({ message }) =>
        pipe(
          MessageCheckinService.getMessageCheckinMembers(message.id),
          Effect.flatMap(observeOnce),
          Effect.map((members) =>
            members
              .filter((m) => m.checkinAt !== null)
              .map((m) => userMention(m.memberId))
              .join(" "),
          ),
        ),
      ),
      Effect.tap(({ messageCheckinData }) =>
        PermissionService.addRole(messageCheckinData.roleId),
      ),
      Effect.tap(
        ({ message, user, client, messageCheckinData, checkedInMentions }) =>
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
            Effect.tryPromise(async () => {
              const channel = await client.channels.fetch(
                messageCheckinData.channelId,
              );
              if (channel?.isSendable()) {
                await channel.send({
                  content: `${userMention(user.id)} has checked in!`,
                });
              }
            }),
          ]),
      ),
      Effect.asVoid,
    ),
  )
  .build();
