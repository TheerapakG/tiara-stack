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
      PermissionService.checkOwner.tap(() => ({ allowSameGuild: false })),
      Effect.bind("jwt", () =>
        Effect.tryPromise(() =>
          fs.readFile("/var/run/secrets/tokens/sheet-apis-token", "utf-8"),
        ),
      ),
      Effect.bind("oidc", () =>
        Effect.tryPromise(() =>
          fetch(
            "https://kubernetes.default.svc.cluster.local/.well-known/openid-configuration",
          ),
        ),
      ),
      InteractionContext.editReply.tapEffect(({ jwt, oidc }) =>
        pipe(
          ClientService.makeEmbedBuilder(),
          Effect.map((embed) => ({
            embeds: [
              embed
                .setTitle("Success!")
                .setDescription(`JWT: ${jwt}\nOIDC: ${oidc}`),
            ],
          })),
        ),
      ),
    ),
  )
  .build();
