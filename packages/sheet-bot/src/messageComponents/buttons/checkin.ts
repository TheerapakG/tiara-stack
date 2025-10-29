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
import { Array, Effect, Number, Option, Order, pipe } from "effect";

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
          MessageCheckinService.getMessageCheckinData(message.id),
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
            Effect.map(Array.filter((m) => Option.isSome(m.checkinAt))),
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
