import { subtext, userMention } from "@discordjs/formatters";
import { Cron, DateTime, Effect, Layer, Option, Schedule, pipe } from "effect";
import { DiscordREST } from "dfx";
import { ActionRowBuilder } from "dfx-discord-utils/utils";
import { checkinButtonData } from "../messageComponents/buttons/checkin";
import { discordGatewayLayer } from "../discord/gateway";
import {
  CheckinService,
  ConverterService,
  EmbedService,
  GuildConfigService,
  MessageCheckinService,
  RoomOrderService,
  sendTentativeRoomOrder,
  SheetApisRequestContext,
} from "../services";

const autoCheckinNotice = "Sent automatically via auto check-in.";

const formatCheckinContent = (content: string): string =>
  [content, subtext(autoCheckinNotice)].join("\n");

const processChannel = Effect.fn("processChannel")(function* (
  guildId: string,
  hour: number,
  channelName: string,
) {
  const checkinService = yield* CheckinService;
  const messageCheckinService = yield* MessageCheckinService;
  const embedService = yield* EmbedService;
  const discordRest = yield* DiscordREST;
  const roomOrderService = yield* RoomOrderService;

  const generated = yield* checkinService.generate({
    guildId,
    channelName,
    hour,
  });

  if (generated.initialMessage !== null) {
    const initialMessage = formatCheckinContent(generated.initialMessage);
    const messageResult = yield* discordRest.createMessage(generated.checkinChannelId, {
      content: initialMessage,
      components: [new ActionRowBuilder().addComponent(checkinButtonData).toJSON()],
    });

    yield* messageCheckinService.upsertMessageCheckinData(messageResult.id, {
      initialMessage,
      hour: generated.hour,
      channelId: generated.runningChannelId,
      roleId: generated.roleId,
      guildId,
      messageChannelId: generated.checkinChannelId,
      createdByUserId: null,
    });

    if (generated.fillIds.length > 0) {
      yield* messageCheckinService.addMessageCheckinMembers(messageResult.id, generated.fillIds);
    }

    yield* sendTentativeRoomOrder({
      guildId,
      runningChannelId: generated.runningChannelId,
      hour: generated.hour,
      fillCount: generated.fillCount,
      roomOrderService,
      sender: discordRest,
    });
  }

  const embedDescriptionParts = [
    generated.monitorCheckinMessage,
    ...Option.match(Option.fromNullishOr(generated.monitorFailureMessage), {
      onSome: (failure) => [subtext(failure)],
      onNone: () => [],
    }),
    subtext(autoCheckinNotice),
  ];

  const embed = yield* pipe(
    embedService.makeBaseEmbedBuilder(),
    Effect.map((builder) =>
      builder
        .setTitle("Auto check-in summary for monitors")
        .setDescription(embedDescriptionParts.join("\n"))
        .toJSON(),
    ),
  );

  const monitorUserId = Option.getOrUndefined(Option.fromNullishOr(generated.monitorUserId));

  yield* discordRest.createMessage(generated.runningChannelId, {
    content: typeof monitorUserId === "string" ? userMention(monitorUserId) : undefined,
    embeds: [embed],
    allowed_mentions:
      typeof monitorUserId === "string"
        ? { users: [monitorUserId] as const }
        : { parse: [] as const },
  });

  return generated.initialMessage !== null ? 1 : 0;
});

const processGuild = Effect.fn("processGuild")(function* (guildId: string) {
  const converterService = yield* ConverterService;
  const guildConfigService = yield* GuildConfigService;

  const hour = yield* pipe(
    DateTime.now,
    Effect.map(DateTime.addDuration("20 minutes")),
    Effect.flatMap((dateTime) => converterService.convertDateTimeToHour(guildId, dateTime)),
  );

  const channelNames = (yield* guildConfigService.getGuildChannels(guildId, true))
    .map((channel) => Option.getOrUndefined(channel.name))
    .filter((name): name is string => typeof name === "string" && name.length > 0)
    .filter((name, index, array) => array.indexOf(name) === index);

  const counts = yield* Effect.forEach(
    channelNames,
    (channelName) =>
      pipe(
        processChannel(guildId, hour, channelName),
        Effect.catch((err) => pipe(Effect.logError(err), Effect.as(0))),
      ),
    { concurrency: "unbounded" },
  );

  return counts.reduce((acc, count) => acc + count, 0);
});

export const autoCheckinTaskLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const guildConfigService = yield* GuildConfigService;
    const autoCheckinTask = Effect.fn("autoCheckinTask", { attributes: { task: "autoCheckin" } })(
      function* () {
        yield* Effect.log("running auto check-in task...");

        const guildConfigs = yield* guildConfigService.getAutoCheckinGuilds();
        const counts = yield* Effect.forEach(
          guildConfigs,
          (guildConfig) =>
            pipe(
              processGuild(guildConfig.guildId),
              Effect.provide(
                Layer.mergeAll(
                  discordGatewayLayer,
                  CheckinService.layer,
                  ConverterService.layer,
                  EmbedService.layer,
                  MessageCheckinService.layer,
                  RoomOrderService.layer,
                ),
              ),
              Effect.catch((err) => pipe(Effect.logError(err), Effect.as(0))),
            ),
          { concurrency: "unbounded" },
        );

        yield* Effect.log(
          `sent ${counts.reduce((acc, count) => acc + count, 0)} check-in message(s) across all ${guildConfigs.length} guilds`,
        );
      },
    );
    const runAutoCheckinTask = SheetApisRequestContext.asBot(() =>
      autoCheckinTask().pipe(Effect.annotateLogs({ task: "autoCheckin" })),
    );

    yield* pipe(
      runAutoCheckinTask(),
      Effect.schedule(
        Schedule.cron(
          Cron.make({
            seconds: [0],
            minutes: [45],
            hours: [],
            days: [],
            months: [],
            weekdays: [],
          }),
        ),
      ),
      Effect.forkScoped,
    );
  }),
).pipe(Layer.provide(GuildConfigService.layer));
