import { Effect, Layer, pipe } from "effect";
import {
  ClientService,
  InteractionContext,
  InteractionKind,
  InteractionT,
  PermissionService,
} from "@/services/interaction";

export type InteractionServices<I extends InteractionT> = Layer.Layer.Success<
  ReturnType<typeof interactionServices<I>>
>;

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
