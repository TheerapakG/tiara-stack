import {
  GuildConfigService,
  guildServicesFromInteractionOption,
  InteractionContext,
  PermissionService,
  ScreenshotService,
} from "@/services";
import { ChatInputHandlerVariantT, handlerVariantContextBuilder } from "@/types";
import { bindObject } from "@/utils";
import {
  ApplicationIntegrationType,
  InteractionContextType,
  AttachmentBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { Array, Effect, pipe } from "effect";
import { UntilObserver } from "typhoon-core/signal";

export const command = handlerVariantContextBuilder<ChatInputHandlerVariantT>()
  .data(
    new SlashCommandBuilder()
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
  )
  .handler(
    Effect.provide(guildServicesFromInteractionOption("server_id"))(
      pipe(
        Effect.Do,
        PermissionService.checkOwner.tap(() => ({ allowSameGuild: true })),
        PermissionService.checkRoles.tapEffect(() =>
          pipe(
            GuildConfigService.getGuildManagerRoles(),
            UntilObserver.observeUntilRpcResultResolved(),
            Effect.flatten,
            Effect.map(Array.map((role) => role.roleId)),
            Effect.map((roles) => ({
              roles,
              reason: "You can only take screenshots as a manager",
            })),
          ),
        ),
        bindObject({
          channelName: InteractionContext.getString("channel_name", true),
          day: InteractionContext.getNumber("day", true),
        }),
        InteractionContext.deferReply.tap(),
        Effect.bind("screenshot", ({ channelName, day }) =>
          pipe(
            ScreenshotService.getScreenshot(channelName, day),
            UntilObserver.observeUntilRpcResultResolved(),
            Effect.flatten,
          ),
        ),
        InteractionContext.editReply.tap(({ screenshot }) => ({
          files: [
            new AttachmentBuilder(Buffer.from(screenshot), {
              name: "screenshot.png",
            }),
          ],
        })),
        Effect.withSpan("handleScreenshot", { captureStackTrace: true }),
      ),
    ),
  )
  .build();
