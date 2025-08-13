import { Effect, Layer, pipe } from "effect";
import { InteractionContext, InteractionKind, InteractionT } from "../../types";
import { ClientService, PermissionService } from "../interaction";

export const interactionServices = <I extends InteractionT>(
  interaction: InteractionKind<I>,
) =>
  pipe(
    Layer.mergeAll(PermissionService.Default),
    Layer.provideMerge(
      Layer.mergeAll(
        ClientService.fromInteraction(interaction),
        Layer.succeedContext(InteractionContext.make<I>(interaction)),
      ),
    ),
    Effect.succeed,
    Effect.withSpan("interactionServices", {
      captureStackTrace: true,
      attributes: {
        interactionId: interaction.id,
      },
    }),
    Layer.unwrapEffect,
  );
