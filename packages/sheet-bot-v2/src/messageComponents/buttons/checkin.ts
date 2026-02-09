import { Ix } from "dfx";
import { InteractionsRegistry } from "dfx/gateway";
import { userMention } from "@discordjs/formatters";
import { ButtonStyle, MessageFlags } from "discord-api-types/v10";
import { Array, Effect, Layer, Option, pipe } from "effect";
import { DiscordGatewayLayer } from "@/discord/gateway";
import {
  MessageComponentHelper,
  makeButton,
  makeButtonData,
  makeMessageActionRowData,
  makeMessageComponent,
} from "@/utils/messageComponentHelper";
import { MessageCheckinService } from "@/services";
import { GuildMember, Interaction } from "@/utils";

export const checkinButtonData = makeButtonData((b) =>
  b
    .setCustomId("interaction:checkin")
    .setLabel("Check in")
    .setStyle(ButtonStyle.Primary)
    .setEmoji({ id: "907705464215711834", name: "Miku_Happy" }),
);

const makeCheckinButtonHandler = Effect.gen(function* () {
  const messageCheckinService = yield* MessageCheckinService;
  const guildMemberUtils = yield* GuildMember.GuildMemberUtils;

  return yield* makeButton(checkinButtonData.toJSON(), (helper: MessageComponentHelper) =>
    Effect.gen(function* () {
      yield* helper.deferReply({ flags: MessageFlags.Ephemeral });

      const guild = yield* Interaction.guild();
      const user = yield* Interaction.user();
      const message = yield* Interaction.message();

      const guildId = Option.map(guild, (g) => g.id).pipe(Option.getOrThrow);
      const userId = user.id;
      const messageId = Option.map(message, (m) => m.id).pipe(Option.getOrThrow);
      const messageChannelId = Option.map(message, (m) => m.channel_id).pipe(Option.getOrThrow);

      yield* messageCheckinService.setMessageCheckinMemberCheckinAt(messageId, userId, Date.now());

      // Give user immediate feedback first (ephemeral confirmation)
      yield* helper.editReply({
        payload: {
          content: "You have been checked in!",
        },
      });

      const messageCheckinData = yield* messageCheckinService.getMessageCheckinData(messageId);

      const checkedInMembers = yield* messageCheckinService.getMessageCheckinMembers(messageId);

      const checkedInMentions = pipe(
        checkedInMembers,
        Array.filter((m) => Option.isSome(m.checkinAt)),
        Array.map((m) => userMention(m.memberId)),
      );

      const content = pipe(
        checkedInMentions,
        Array.match({
          onNonEmpty: (mentions) =>
            `${messageCheckinData.initialMessage}\n\nChecked in: ${mentions.join(" ")}`,
          onEmpty: () => messageCheckinData.initialMessage,
        }),
      );

      // Edit the original message using REST API (use the message's actual channel)
      yield* helper.rest.updateMessage(messageChannelId, messageId, {
        content,
        components: [makeMessageActionRowData((b) => b.setComponents(checkinButtonData)).toJSON()],
      });

      // Send notification to the running channel
      yield* helper.rest.createMessage(messageCheckinData.channelId, {
        content: `${userMention(userId)} has checked in!`,
      });

      yield* Effect.transposeMapOption(messageCheckinData.roleId, (roleId) =>
        guildMemberUtils.addRoles(guildId, userId, [roleId]),
      );
    }),
  );
});

export const checkinButton = {
  data: checkinButtonData,
  handler: makeCheckinButtonHandler,
};

const makeCheckinButton = Effect.gen(function* () {
  const button = yield* makeCheckinButtonHandler;

  return makeMessageComponent(button.data, button.handler);
});

export const CheckinButtonLive = Layer.scopedDiscard(
  Effect.gen(function* () {
    const registry = yield* InteractionsRegistry;
    const button = yield* makeCheckinButton;

    yield* registry.register(Ix.builder.add(button).catchAllCause(Effect.log));
  }),
).pipe(
  Layer.provide(
    Layer.mergeAll(
      DiscordGatewayLayer,
      MessageCheckinService.Default,
      GuildMember.GuildMemberUtils.Default,
    ),
  ),
);
