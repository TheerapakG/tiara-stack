import { Schema } from "effect";
import { Multipart } from "effect/unstable/http";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/unstable/httpapi";
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

export const UpdateOriginalInteractionResponseWithFilesBodyPayloadSchema = Schema.Struct({
  interactionToken: Schema.String,
  payload: Schema.fromJsonString(DiscordMessageRequestSchema),
  files: Multipart.FilesSchema,
}).pipe(HttpApiSchema.asMultipart({ maxParts: 12, maxFileSize: 10 * 1024 * 1024 }));

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
  .add(
    HttpApiEndpoint.patch(
      "updateOriginalInteractionResponseWithFiles",
      "/bot/interactions/original-response/files",
      {
        payload: UpdateOriginalInteractionResponseWithFilesBodyPayloadSchema,
        success: DiscordMessageSchema,
        error: [...DiscordBotRestErrors, Unauthorized],
      },
    ),
  )
  .annotate(OpenApi.Title, "Ingress Bot")
  .annotate(OpenApi.Description, "Ingress-only Discord bot proxy endpoints") {}
