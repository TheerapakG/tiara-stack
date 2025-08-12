import { Interaction } from "discord.js";
import { Effect, Layer, pipe } from "effect";
import { ClientService, PermissionService } from "../interaction";

export const interactionServices = <I extends Interaction>(interaction: I) =>
  pipe(
    Layer.mergeAll(PermissionService.Default),
    Layer.provide(Layer.mergeAll(ClientService.fromInteraction(interaction))),
    Effect.succeed,
    Effect.withSpan("interactionServices", {
      captureStackTrace: true,
      attributes: {
        interactionId: interaction.id,
      },
    }),
    Layer.unwrapEffect,
  );
