import {
  ClientService,
  InteractionContext,
  PermissionService,
} from "@/services";
import {
  ChatInputHandlerVariantT,
  handlerVariantContextBuilder,
} from "@/types";
import { FileSystem } from "@effect/platform";
import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";
import { Effect, pipe } from "effect";
import { WebSocketClient } from "typhoon-client-ws/client";
import { SheetApisClient } from "~~/src/client";

export const command = handlerVariantContextBuilder<ChatInputHandlerVariantT>()
  .data(
    new SlashCommandBuilder()
      .setName("test_service_account_oidc")
      .setDescription("Test service account OIDC")
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
    pipe(
      Effect.Do,
      InteractionContext.deferReply.tap(),
      PermissionService.checkOwner.tap(() => ({ allowSameGuild: false })),
      Effect.bind("fs", () => FileSystem.FileSystem),
      Effect.bind("sheetApisJwt", ({ fs }) =>
        fs.readFileString("/var/run/secrets/tokens/sheet-apis-token", "utf-8"),
      ),
      Effect.bind("response", ({ sheetApisJwt }) =>
        pipe(
          SheetApisClient.get(),
          Effect.flatMap((client) =>
            WebSocketClient.once(client, "testOIDC", { token: sheetApisJwt }),
          ),
        ),
      ),
      InteractionContext.editReply.tapEffect(({ sheetApisJwt, response }) =>
        pipe(
          ClientService.makeEmbedBuilder(),
          Effect.map((embed) => ({
            embeds: [
              embed
                .setTitle("Success!")
                .setDescription(
                  `API JWT: ${sheetApisJwt}\nResponse: ${JSON.stringify(response, null, 2)}`,
                ),
            ],
          })),
        ),
      ),
      Effect.asVoid,
      Effect.withSpan("testServiceAccountOIDC", {
        captureStackTrace: true,
      }),
    ),
  )
  .build();
