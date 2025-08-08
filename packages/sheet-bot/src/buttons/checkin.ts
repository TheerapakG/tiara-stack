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
import { Data, Effect, Function, Option, pipe, Ref } from "effect";
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
          Effect.catchAll(() =>
            Effect.fail(
              new CheckinError(
                "I encountered an error while checking you in...",
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
            content: `${messageCheckinData.initialMessage}\n\nChecked in: ${checkedInMentions}`,
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
