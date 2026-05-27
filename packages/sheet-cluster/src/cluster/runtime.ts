import { NodeHttpServer } from "@effect/platform-node";
import { Duration, Effect, Layer, Option } from "effect";
import {
  ClusterWorkflowEngine,
  HttpRunner,
  K8sHttpClient,
  RunnerAddress,
  RunnerHealth,
  RunnerServer,
  Sharding,
  ShardingConfig,
  SqlMessageStorage,
  SqlRunnerStorage,
} from "effect/unstable/cluster";
import { FetchHttpClient, HttpRouter } from "effect/unstable/http";
import { RpcSerialization } from "effect/unstable/rpc";
import { createServer } from "node:http";
import { config } from "@/config";
import { AutoCheckinService } from "@/services";
import { autoCheckinWorkflowLayer } from "@/workflows/autoCheckin";
import { getClusterRunnerReadinessSnapshot, postgresSqlLayer } from "@/services";
import { dispatchWorkflowLayer } from "@/workflows/dispatch";

const shardGroups = ["dispatch", "autoCheckin"] as const;

const configuredRunnerAddress = Effect.gen(function* () {
  const runnerHost = yield* config.clusterRunnerHost;
  const runnerPort = yield* config.clusterRunnerPort;
  return RunnerAddress.make(runnerHost, runnerPort);
});

export const shardingConfigLayer = Layer.unwrap(
  Effect.gen(function* () {
    const runnerAddress = yield* configuredRunnerAddress;
    const runnerListenHost = yield* config.clusterRunnerListenHost;
    const runnerListenPort = yield* config.clusterRunnerListenPort;

    return ShardingConfig.layer({
      runnerAddress: Option.some(runnerAddress),
      runnerListenAddress: Option.some(RunnerAddress.make(runnerListenHost, runnerListenPort)),
      assignedShardGroups: shardGroups,
      availableShardGroups: shardGroups,
      shardsPerGroup: 300,
      entityMailboxCapacity: 4096,
      entityMaxIdleTime: Duration.minutes(5),
      simulateRemoteSerialization: false,
    });
  }),
).pipe(Layer.withSpan("sheet-cluster.shardingConfig"));

export const clusterStorageLayer = Layer.mergeAll(
  SqlMessageStorage.layerWith({ prefix: "sheet_apis_cluster" }),
  SqlRunnerStorage.layerWith({ prefix: "sheet_apis_cluster" }),
).pipe(Layer.withSpan("sheet-cluster.clusterStorage"));

const runnerHealthLayer = Layer.unwrap(
  Effect.gen(function* () {
    const namespace = yield* config.podNamespace;
    return RunnerHealth.layerK8s({ namespace, labelSelector: "app=sheet-cluster" });
  }),
).pipe(Layer.withSpan("sheet-cluster.runnerHealth"));

export const clusterClientLayer = RunnerServer.layerClientOnly.pipe(
  Layer.provide(clusterStorageLayer),
  Layer.provide(HttpRunner.layerClientProtocolHttp({ path: "/cluster/rpc" })),
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(shardingConfigLayer),
  Layer.provide(RpcSerialization.layerJson),
  Layer.withSpan("sheet-cluster.clusterClient"),
);

export const clusterWorkflowEngineClientLayer = ClusterWorkflowEngine.layer.pipe(
  Layer.provide(clusterStorageLayer),
  Layer.provide(clusterClientLayer),
  Layer.withSpan("sheet-cluster.workflowEngineClient"),
);

const clusterRunnerLayer = HttpRunner.layerHttpOptions({ path: "/cluster/rpc" }).pipe(
  Layer.provide(clusterStorageLayer),
  Layer.provide(runnerHealthLayer),
  Layer.provide(K8sHttpClient.layer),
  Layer.provide(HttpRunner.layerClientProtocolHttp({ path: "/cluster/rpc" })),
  Layer.provide(shardingConfigLayer),
  Layer.provide(RpcSerialization.layerJson),
);

const runnerReadinessProbeTimeout = Duration.seconds(15);

const clusterStartupLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    yield* Sharding.Sharding;
    yield* Effect.logInfo("Started sheet-cluster sharding runtime");
    yield* getClusterRunnerReadinessSnapshot.pipe(
      Effect.delay(Duration.seconds(5)),
      Effect.flatMap((snapshot) => {
        const ready = snapshot.hasRecentHealthyRunner;
        const log = ready ? Effect.logInfo : Effect.logWarning;
        return log("Checked sheet-cluster runner registration", snapshot);
      }),
      Effect.timeoutOrElse({
        duration: runnerReadinessProbeTimeout,
        orElse: () =>
          Effect.logWarning("sheet-cluster runner readiness probe timed out", {
            timeoutMillis: Duration.toMillis(runnerReadinessProbeTimeout),
          }),
      }),
      Effect.catchCause((cause) =>
        Effect.logWarning("Failed to inspect sheet-cluster runner registration", cause),
      ),
      Effect.forkScoped,
    );
    yield* Effect.never.pipe(Effect.forkScoped);
  }),
);

export const clusterLayer = Layer.mergeAll(
  dispatchWorkflowLayer,
  autoCheckinWorkflowLayer,
  clusterStartupLayer,
).pipe(
  Layer.provide(AutoCheckinService.layer),
  Layer.provide(ClusterWorkflowEngine.layer),
  Layer.provideMerge(clusterRunnerLayer),
  Layer.provide(postgresSqlLayer),
);

const clusterHttpServerLayer = Layer.unwrap(
  Effect.gen(function* () {
    const host = yield* config.clusterRunnerListenHost;
    const port = yield* config.clusterRunnerListenPort;
    return NodeHttpServer.layer(createServer, { host, port });
  }),
);

export const clusterHttpLayer = HttpRouter.serve(
  clusterLayer.pipe(Layer.provideMerge(HttpRouter.layer)),
).pipe(Layer.provide(clusterHttpServerLayer), Layer.withSpan("sheet-cluster.clusterHttp"));
