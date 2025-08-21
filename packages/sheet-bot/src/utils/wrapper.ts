import { Effect, Function, pipe } from "effect";

export const tapify = <In, Out, E1, R1>(
  f: (_: In) => Effect.Effect<Out, E1, R1>,
) =>
  Function.dual<
    <O>(
      transform: (object: NoInfer<O>) => NoInfer<In>,
    ) => <E2, R2>(
      self: Effect.Effect<O, E2, R2>,
    ) => Effect.Effect<O, E1 | E2, R1 | R2>,
    <O, E2, R2>(
      self: Effect.Effect<O, E2, R2>,
      transform: (object: NoInfer<O>) => NoInfer<In>,
    ) => Effect.Effect<O, E1 | E2, R1 | R2>
  >(
    2,
    <O, E2, R2>(
      self: Effect.Effect<O, E2, R2>,
      transform: (object: NoInfer<O>) => NoInfer<In>,
    ) =>
      pipe(
        self,
        Effect.tap((a) => f(transform(a))),
      ),
  );

export const tapifyOptional = <In, Out, E1, R1>(
  f: (_: In | undefined) => Effect.Effect<Out, E1, R1>,
) =>
  Function.dual<
    <O>(
      transform?: (object: NoInfer<O>) => NoInfer<In>,
    ) => <E2, R2>(
      self: Effect.Effect<O, E2, R2>,
    ) => Effect.Effect<O, E1 | E2, R1 | R2>,
    <O, E2, R2>(
      self: Effect.Effect<O, E2, R2>,
      transform?: (object: NoInfer<O>) => NoInfer<In>,
    ) => Effect.Effect<O, E1 | E2, R1 | R2>
  >(
    (args) => Effect.isEffect(args[0]),
    <O, E2, R2>(
      self: Effect.Effect<O, E2, R2>,
      transform?: (object: NoInfer<O>) => NoInfer<In>,
    ) =>
      pipe(
        self,
        Effect.tap((a) => f(transform?.(a))),
      ),
  );

export const mapify = <In, Out, E1, R1>(
  f: (_: In) => Effect.Effect<Out, E1, R1>,
) =>
  Function.dual<
    <O>(
      transform: (object: NoInfer<O>) => NoInfer<In>,
    ) => <E2, R2>(
      self: Effect.Effect<O, E2, R2>,
    ) => Effect.Effect<Out, E1 | E2, R1 | R2>,
    <O, E2, R2>(
      self: Effect.Effect<O, E2, R2>,
      transform: (object: NoInfer<O>) => NoInfer<In>,
    ) => Effect.Effect<Out, E1 | E2, R1 | R2>
  >(
    2,
    <O, E2, R2>(
      self: Effect.Effect<O, E2, R2>,
      transform: (object: NoInfer<O>) => NoInfer<In>,
    ) =>
      pipe(
        self,
        Effect.flatMap((a) => f(transform(a))),
      ),
  );

export const mapifyOptional = <In, Out, E1, R1>(
  f: (_: In | undefined) => Effect.Effect<Out, E1, R1>,
) =>
  Function.dual<
    <O>(
      transform?: (object: NoInfer<O>) => NoInfer<In>,
    ) => <E2, R2>(
      self: Effect.Effect<O, E2, R2>,
    ) => Effect.Effect<Out, E1 | E2, R1 | R2>,
    <O, E2, R2>(
      self: Effect.Effect<O, E2, R2>,
      transform?: (object: NoInfer<O>) => NoInfer<In>,
    ) => Effect.Effect<Out, E1 | E2, R1 | R2>
  >(
    (args) => Effect.isEffect(args[0]),
    <O, E2, R2>(
      self: Effect.Effect<O, E2, R2>,
      transform?: (object: NoInfer<O>) => NoInfer<In>,
    ) =>
      pipe(
        self,
        Effect.flatMap((a) => f(transform?.(a))),
      ),
  );
