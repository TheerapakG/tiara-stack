import { Effect, Tracer } from "effect";

export const ObservableSymbol = Symbol("Typhoon/Observability/Observable");

export type ObservableOptions = {
  readonly withSpan?: boolean;
};

export abstract class Observable {
  abstract readonly [ObservableSymbol]: ObservableOptions;

  static withSpan(
    observable: Observable,
    name: string,
    options: Tracer.SpanOptions,
  ) {
    return <A = never, E = never, R = never>(effect: Effect.Effect<A, E, R>) =>
      observable[ObservableSymbol].withSpan
        ? Effect.withSpan(name, options)(effect)
        : effect;
  }
}
