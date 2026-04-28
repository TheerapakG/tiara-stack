import { InteractionsRegistry } from "dfx/gateway";
import { userMention } from "@discordjs/formatters";
import { ButtonStyle, MessageFlags } from "discord-api-types/v10";
import { Ix } from "dfx/index";
import { Array, Effect, Layer, Option, pipe } from "effect";
import { discordGatewayLayer } from "../../discord/gateway";
import {
  makeButton,
  makeButtonData,
  makeMessageActionRowData,
  makeMessageComponent,
} from "dfx-discord-utils/utils";
import { MessageCheckinService, SheetApisRequestContext } from "@/services";
import { GuildMember } from "dfx-discord-utils/utils";
import { Interaction } from "dfx-discord-utils/utils";
import { discordApplicationLayer } from "../../discord/application";
import { discordConfigLayer } from "../../discord/config";

const getInteractionGuildId = Effect.gen(function* () {
  const interactionGuild = yield* Interaction.guild();
  return pipe(
    interactionGuild,
    Option.map((guild) => (guild as { id: string }).id),
  );
});

const getInteractionUser = Effect.gen(function* () {
  return (yield* Interaction.user()) as { id: string };
});

const getInteractionMessage = Effect.gen(function* () {
  const interactionMessage = yield* Interaction.message();
  return pipe(
    interactionMessage,
    Option.map((message) => message as { id: string; channel_id: string }),
  );
});

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

  return yield* makeButton(
    checkinButtonData.toJSON(),
    SheetApisRequestContext.asInteractionUser(
      Effect.fn("checkinButton")(function* (helper) {
        yield* helper.deferReply({ flags: MessageFlags.Ephemeral });

        const guildId = Option.getOrThrow(yield* getInteractionGuildId);
        const user = yield* getInteractionUser;
        const accountId = user.id;
        const message = Option.getOrThrow(yield* getInteractionMessage);
        const messageId = message.id;
        const messageChannelId = message.channel_id;

        yield* messageCheckinService.setMessageCheckinMemberCheckinAt(
          messageId,
          accountId,
          Date.now(),
        );

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
          components: [
            makeMessageActionRowData((b) => b.setComponents(checkinButtonData)).toJSON(),
          ],
        });

        // Send notification to the running channel
        yield* helper.rest.createMessage(messageCheckinData.channelId, {
          content: `${userMention(accountId)} has checked in!`,
        });

        yield* pipe(
          messageCheckinData.roleId,
          Option.match({
            onSome: (roleId) => guildMemberUtils.addRoles(guildId, accountId, [roleId]),
            onNone: () => Effect.void,
          }),
        );
      }),
    ),
  );
});

const makeCheckinButton = Effect.gen(function* () {
  const button = yield* makeCheckinButtonHandler;

  return makeMessageComponent(button.data, button.handler as never);
});

export const checkinButtonLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const registry = yield* InteractionsRegistry;
    const button = yield* makeCheckinButton;

    yield* registry.register(Ix.builder.add(button).catchAllCause(Effect.log));
  }),
).pipe(
  Layer.provide(
    Layer.mergeAll(
      discordGatewayLayer,
      discordApplicationLayer,
      MessageCheckinService.layer,
      Layer.provide(GuildMember.GuildMemberUtils.layer, discordConfigLayer),
    ),
  ),
);
