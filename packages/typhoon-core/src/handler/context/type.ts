import { Effect } from "effect";

export interface WithMetricsExecutorTypeLambda {
  readonly R: unknown;
}

export type WithMetricsExecutorContextKind<F extends WithMetricsExecutorTypeLambda, R> = F extends {
  readonly context: unknown;
}
  ? (F & {
      readonly R: R;
    })["context"]
  : never;

export type WithMetricsExecutorResultKind<F extends WithMetricsExecutorTypeLambda, R> = F extends {
  readonly result: Effect.All.EffectAny;
}
  ? (F & {
      readonly R: R;
    })["result"]
  : never;
