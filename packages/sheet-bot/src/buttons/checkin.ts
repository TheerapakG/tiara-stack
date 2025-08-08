import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ComponentType,
  MessageActionRowComponentBuilder,
  MessageFlags,
  MessageFlagsBitField,
  userMention,
} from "discord.js";
import { Array, Data, Effect, Function, Option, pipe, Ref } from "effect";
import { observeOnce } from "typhoon-server/signal";
import { MessageCheckinService, PermissionService } from "../services";
import {
  buttonInteractionHandlerContextBuilder,
  InteractionContext,
} from "../types";

const buttonData = {
  type: ComponentType.Button,
  customId: "interaction:checkin",
  label: "Check in",
  style: ButtonStyle.Primary,
} as const;

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
      Effect.bind("interaction", () =>
        InteractionContext.interaction<ButtonInteraction>(),
      ),
      Effect.tap(({ interaction }) =>
        Effect.tryPromise(() => interaction.deferReply({ ephemeral: true })),
      ),
      Effect.bindAll(({ interaction }) => ({
        messageFlags: Ref.make(
          new MessageFlagsBitField().add(MessageFlags.Ephemeral),
        ),
        message: Option.fromNullable(interaction.message),
        serverId: Option.fromNullable(interaction.guildId),
      })),
      Effect.bind("messageCheckinData", ({ message }) =>
        pipe(
          MessageCheckinService.getMessageCheckinData(message.id),
          Effect.flatMap((computed) => observeOnce(computed.value)),
          Effect.flatMap(Function.identity),
        ),
      ),
      Effect.tap(({ interaction, message }) =>
        pipe(
          MessageCheckinService.setMessageCheckinMemberCheckinAt(
            message.id,
            interaction.user.id,
          ),
          Effect.tap((values) =>
            Array.length(values) > 0
              ? Effect.tryPromise(() =>
                  interaction.editReply({
                    content: "You have been checked in!",
                  }),
                )
              : Effect.fail(
                  new CheckinError(
                    "I don't think you are in the list of players to check in...",
                  ),
                ),
          ),
        ),
      ),
      Effect.bind("messageCheckinMembers", ({ message }) =>
        pipe(
          MessageCheckinService.getMessageCheckinMembers(message.id),
          Effect.flatMap((computed) => observeOnce(computed.value)),
        ),
      ),
      Effect.let("checkedInMentions", ({ messageCheckinMembers }) =>
        messageCheckinMembers
          .filter((m) => m.checkinAt !== null)
          .map((m) => userMention(m.memberId))
          .join(" "),
      ),
      Effect.tap(({ interaction, messageCheckinData }) =>
        PermissionService.addRole(interaction, messageCheckinData.roleId),
      ),
      Effect.tap(({ interaction, messageCheckinData, checkedInMentions }) =>
        Effect.tryPromise(() =>
          interaction.message.edit({
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
      ),
    ),
  )
  .build();
