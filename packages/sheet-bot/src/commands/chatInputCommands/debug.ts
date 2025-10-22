import {
  MessageCheckinService,
  MessageRoomOrderService,
  MessageSlotService,
  ConverterService,
  FormatService,
  GuildConfigService,
  GuildService,
  PlayerService,
  ScreenshotService,
  SheetService,
  PermissionService,
  guildServicesFromInteractionOption,
  InteractionContext,
  channelServicesFromInteraction,
  guildMemberServicesFromInteraction,
} from "@/services";
import {
  ChatInputHandlerVariantT,
  handlerVariantContextBuilder,
} from "@/types";
import { bindObject } from "@/utils";
import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";
import { Effect, Layer, pipe, Schema } from "effect";

const Services = {
  MessageCheckinService,
  MessageRoomOrderService,
  MessageSlotService,
  ConverterService,
  FormatService,
  GuildConfigService,
  GuildService,
  PlayerService,
  ScreenshotService,
  SheetService,
  PermissionService,
} as const;

export const command = handlerVariantContextBuilder<ChatInputHandlerVariantT>()
  .data(
    new SlashCommandBuilder()
      .setName("debug")
      .setDescription("Debug command")
      .addStringOption((option) =>
        option
          .setName("service")
          .setDescription("The service to debug")
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("method")
          .setDescription("The method to debug")
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("args")
          .setDescription("The arguments to pass to the method")
          .setRequired(true),
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
    Effect.provide(
      Layer.mergeAll(
        channelServicesFromInteraction(),
        guildMemberServicesFromInteraction(),
        guildServicesFromInteractionOption("server_id"),
      ),
    )(
      pipe(
        Effect.Do,
        PermissionService.checkOwner.tap(() => ({ allowSameGuild: false })),
        bindObject({
          service: InteractionContext.getString("service", true),
          method: InteractionContext.getString("method", true),
          args: InteractionContext.getString("args", true),
        }),
        InteractionContext.deferReply.tap(),
        Effect.bind("parsedArgs", ({ args }) =>
          pipe(
            args,
            Schema.decodeUnknown(
              Schema.parseJson(Schema.Array(Schema.Unknown)),
            ),
          ),
        ),
        Effect.let(
          "serviceObject",
          ({ service }) => Services[service as keyof typeof Services],
        ),
        Effect.bind(
          "result",
          ({ serviceObject, method, parsedArgs }) =>
            (serviceObject[method as keyof typeof serviceObject] as any)(
              ...parsedArgs,
            ) as Effect.Effect<
              unknown,
              unknown,
              | MessageCheckinService
              | MessageRoomOrderService
              | MessageSlotService
              | ConverterService
              | FormatService
              | GuildConfigService
              | GuildService
              | PlayerService
              | ScreenshotService
              | SheetService
              | PermissionService
            >,
        ),
        InteractionContext.editReply.tap(({ result }) => ({
          content: `Result: ${JSON.stringify(result)}`,
        })),
        Effect.withSpan("handleDebug", { captureStackTrace: true }),
      ),
    ),
  )
  .build();
