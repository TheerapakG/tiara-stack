import {
  ClientService,
  InteractionContext,
  PermissionService,
} from "@/services";
import {
  ChatInputHandlerVariantT,
  handlerVariantContextBuilder,
} from "@/types";
import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";
import { Effect, pipe } from "effect";
import fs from "fs/promises";

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
      Effect.bind("sheetApisJwt", () =>
        Effect.tryPromise(() =>
          fs.readFile("/var/run/secrets/tokens/sheet-apis-token", "utf-8"),
        ),
      ),
      Effect.bind("kubernetesJwt", () =>
        Effect.tryPromise(() =>
          fs.readFile("/var/run/secrets/tokens/kubernetes-token", "utf-8"),
        ),
      ),
      Effect.bind("oidc", ({ kubernetesJwt }) =>
        Effect.tryPromise(() =>
          fetch(
            "https://kubernetes.default.svc.cluster.local/.well-known/openid-configuration",
            {
              headers: {
                Authorization: `Bearer ${kubernetesJwt}`,
              },
            },
          ),
        ),
      ),
      Effect.bind("oidcJson", ({ oidc }) =>
        Effect.tryPromise(() => oidc.json()),
      ),
      InteractionContext.editReply.tapEffect(
        ({ sheetApisJwt, kubernetesJwt, oidcJson }) =>
          pipe(
            ClientService.makeEmbedBuilder(),
            Effect.map((embed) => ({
              embeds: [
                embed
                  .setTitle("Success!")
                  .setDescription(
                    `API JWT: ${sheetApisJwt}\nKubernetes JWT: ${kubernetesJwt}\nOIDC: ${JSON.stringify(oidcJson, null, 2)}`,
                  ),
              ],
            })),
          ),
      ),
    ),
  )
  .build();
