import { NodeRuntime } from "@effect/platform-node";
import { Layer, Logger } from "effect";
import { HttpLive } from "./http";
import { MetricsLive } from "./metrics";
import { TracesLive } from "./traces";

HttpLive.pipe(
  Layer.provide(MetricsLive),
  Layer.provide(TracesLive),
  Layer.provide(Logger.logFmt),
  Layer.launch,
  NodeRuntime.runMain as any,
);
