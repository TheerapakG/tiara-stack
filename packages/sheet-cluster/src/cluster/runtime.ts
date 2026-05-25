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
import { HttpRouter } from "effect/unstable/http";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { createServer } from "node:http";
import { config } from "@/config";
import { AutoCheckinService } from "@/services";
import { autoCheckinWorkflowLayer } from "@/workflows/autoCheckin";
import { postgresSqlLayer } from "@/services";
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
      shardGroups,
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
).pipe(Layer.provide(postgresSqlLayer), Layer.withSpan("sheet-cluster.clusterStorage"));

const runnerHealthLayer = Layer.unwrap(
  Effect.gen(function* () {
    const namespace = yield* config.podNamespace;
    return RunnerHealth.layerK8s({ namespace, labelSelector: "app=sheet-cluster" });
  }),
).pipe(Layer.withSpan("sheet-cluster.runnerHealth"));

export const clusterClientLayer = HttpRunner.layerHttpClientOnly.pipe(
  Layer.provide(clusterStorageLayer),
  Layer.provide(HttpRunner.layerClientProtocolHttp({ path: "/cluster/rpc" })),
  Layer.provide(shardingConfigLayer),
  Layer.provide(RpcSerialization.layerJson),
  Layer.withSpan("sheet-cluster.clusterClient"),
);

export const clusterWorkflowEngineClientLayer = ClusterWorkflowEngine.layer.pipe(
  Layer.provide(clusterStorageLayer),
  Layer.provide(clusterClientLayer),
  Layer.withSpan("sheet-cluster.workflowEngineClient"),
);

const clusterRunnerLayer = HttpRunner.layerClient.pipe(
  Layer.provide(clusterStorageLayer),
  Layer.provide(runnerHealthLayer),
  Layer.provide(K8sHttpClient.layer),
  Layer.provide(HttpRunner.layerClientProtocolHttp({ path: "/cluster/rpc" })),
  Layer.provide(shardingConfigLayer),
  Layer.provide(RpcSerialization.layerJson),
);

const clusterStartupLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    yield* Sharding.Sharding;
    yield* Effect.logInfo("Started sheet-cluster sharding runtime");
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
);

const clusterHttpServerLayer = Layer.unwrap(
  Effect.gen(function* () {
    const host = yield* config.clusterRunnerListenHost;
    const port = yield* config.clusterRunnerListenPort;
    return NodeHttpServer.layer(createServer, { host, port });
  }),
);

const clusterRpcRoutesLayer = RunnerServer.layer.pipe(
  Layer.provide(RpcServer.layerProtocolHttp({ path: "/cluster/rpc" })),
  Layer.provide(RpcSerialization.layerJson),
);

export const clusterHttpLayer = HttpRouter.serve(
  clusterRpcRoutesLayer.pipe(
    Layer.provideMerge(clusterLayer),
    Layer.provideMerge(HttpRouter.layer),
  ),
).pipe(Layer.provide(clusterHttpServerLayer), Layer.withSpan("sheet-cluster.clusterHttp"));
