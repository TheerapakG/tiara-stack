import { NodeHttpClient, NodeRuntime } from "@effect/platform-node";
import { DiscordREST } from "dfx";
import { Context, Effect, FiberSet, Layer, Logger } from "effect";
import { sessionCommandLayer, workspaceCommandLayer } from "../commands";
import { discordGatewayLayer } from "../discord/gateway";
import { permissionButtonLayer, questionButtonLayer } from "../messageComponents/buttons";
import { sdkClient } from "../sdk/index";

const sdkLayer = Layer.effectContext(
  Effect.gen(function* () {
    const rest = yield* DiscordREST;
    const runDiscordEffect = yield* FiberSet.makeRuntimePromise();
    sdkClient.setDiscordRest(rest, runDiscordEffect);
    yield* Effect.acquireRelease(
      Effect.tryPromise(() => sdkClient.connect()),
      () => Effect.tryPromise(() => sdkClient.disconnect()),
    );
    return Context.empty();
  }),
).pipe(Layer.provide(discordGatewayLayer));

Layer.mergeAll(
  workspaceCommandLayer,
  sessionCommandLayer,
  permissionButtonLayer,
  questionButtonLayer,
  sdkLayer,
).pipe(
  Layer.provide(Logger.layer([Logger.consoleLogFmt])),
  Layer.provide(NodeHttpClient.layerFetch),
  Layer.launch,
  NodeRuntime.runMain(),
);
