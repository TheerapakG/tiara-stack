import { Ix } from "dfx";
import { InteractionsRegistry } from "dfx/gateway";
import { ApplicationIntegrationType, InteractionContextType } from "discord-api-types/v10";
import { Effect, Layer, Option, pipe, Array } from "effect";
import { DiscordGatewayLayer } from "../discord/gateway";
import { CommandHelper, Interaction } from "../utils";
import {
  EmbedService,
  GuildConfigService,
  PermissionService,
  ScreenshotService,
} from "../services";

const makeScreenshotCommand = Effect.gen(function* () {
  const guildConfigService = yield* GuildConfigService;
  const permissionService = yield* PermissionService;
  const screenshotService = yield* ScreenshotService;

  return yield* CommandHelper.makeCommand(
    (builder) =>
      builder
        .setName("screenshot")
        .setDescription("Day screenshot command")
        .addStringOption((option) =>
          option
            .setName("channel_name")
            .setDescription("The channel to get the screenshot for")
            .setRequired(true),
        )
        .addNumberOption((option) =>
          option.setName("day").setDescription("The day to get the slots for").setRequired(true),
        )
        .addStringOption((option) =>
          option.setName("server_id").setDescription("The server to get the teams for"),
        )
        .setIntegrationTypes(
          ApplicationIntegrationType.GuildInstall,
          ApplicationIntegrationType.UserInstall,
        )
        .setContexts(
          InteractionContextType.BotDM,
          InteractionContextType.Guild,
          InteractionContextType.PrivateChannel,
        ),
    Effect.fn("screenshot")(function* (command) {
      yield* command.deferReply();

      const serverId = command.optionValueOptional("server_id");
      const interactionGuildId = (yield* Interaction.guild()).pipe(Option.map((guild) => guild.id));
      const guildId = pipe(
        serverId,
        Option.orElse(() => interactionGuildId),
        Option.getOrThrow,
      );

      const channelName = command.optionValue("channel_name");
      const day = command.optionValue("day");

      yield* Effect.firstSuccessOf([
        permissionService.checkInteractionUserApplicationOwner(),
        pipe(
          permissionService.checkInteractionUserGuildRoles(
            yield* guildConfigService
              .getGuildManagerRoles(guildId)
              .pipe(Effect.map(Array.map((role) => role.roleId))),
            guildId,
          ),
          Effect.catchTag("PermissionError", () =>
            Effect.fail(new Error("You can only take screenshots as a manager")),
          ),
        ),
      ]);

      const screenshot = yield* screenshotService.getScreenshot(guildId, channelName, day);

      yield* command.editReplyWithFiles(
        [new File([Buffer.from(screenshot)], "screenshot.png", { type: "image/png" })],
        {
          payload: {
            attachments: [
              {
                id: "0",
                description: `Day ${day}'s schedule screenshot`,
                filename: "screenshot.png",
              },
            ],
          },
        },
      );
    }),
  );
});

const makeGlobalScreenshotCommand = Effect.gen(function* () {
  const screenshotCommand = yield* makeScreenshotCommand;

  return CommandHelper.makeGlobalCommand(screenshotCommand.data, screenshotCommand.handler);
});

export const ScreenshotCommandLive = Layer.scopedDiscard(
  Effect.gen(function* () {
    const registry = yield* InteractionsRegistry;
    const command = yield* makeGlobalScreenshotCommand;

    yield* registry.register(Ix.builder.add(command).catchAllCause(Effect.log));
  }),
).pipe(
  Layer.provide(
    Layer.mergeAll(
      DiscordGatewayLayer,
      PermissionService.Default,
      GuildConfigService.Default,
      EmbedService.Default,
      ScreenshotService.Default,
    ),
  ),
);
