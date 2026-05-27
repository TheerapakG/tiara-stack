import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";
import {
  DiscordBotRestErrors,
  DiscordMessageRequestSchema,
  DiscordMessageSchema,
} from "dfx-discord-utils/discord/schema";
import { Unauthorized } from "typhoon-core/error";

export const UpdateOriginalInteractionResponseBodyPayloadSchema = Schema.Struct({
  interactionToken: Schema.String,
  payload: DiscordMessageRequestSchema,
});

export class IngressBotApi extends HttpApiGroup.make("ingressBot")
  .add(
    HttpApiEndpoint.patch(
      "updateOriginalInteractionResponse",
      "/bot/interactions/original-response",
      {
        payload: UpdateOriginalInteractionResponseBodyPayloadSchema,
        success: DiscordMessageSchema,
        error: [...DiscordBotRestErrors, Unauthorized],
      },
    ),
  )
  .annotate(OpenApi.Title, "Ingress Bot")
  .annotate(OpenApi.Description, "Ingress-only Discord bot proxy endpoints") {}
