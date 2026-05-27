import type { CommandInteractionResponseContext } from "dfx-discord-utils/utils";
import { Duration, Effect } from "effect";

const sheetClusterDispatchTimeout = Duration.seconds(10);

export const runSheetClusterDispatch = <A, E, R>(
  response: CommandInteractionResponseContext,
  operation: string,
  effect: Effect.Effect<A, E, R>,
) =>
  effect.pipe(
    Effect.timeout(sheetClusterDispatchTimeout),
    Effect.catchTag("TimeoutError", () =>
      response.editReply({
        payload: {
          content: `Timed out while dispatching ${operation}. Please try again.`,
        },
      }),
    ),
    Effect.asVoid,
  );
