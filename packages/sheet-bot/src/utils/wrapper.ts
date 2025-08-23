import { Data, Effect, Function, pipe } from "effect";

export const effectify =
  <In, Out, E1, R1>(f: (_: In) => Effect.Effect<Out, E1, R1>) =>
  <E2, R2>(input: Effect.Effect<In, E2, R2>) =>
    pipe(input, Effect.flatMap(f));

export const effectifyOptional =
  <In, Out, E1, R1>(f: (_?: In) => Effect.Effect<Out, E1, R1>) =>
  <E2, R2>(input?: Effect.Effect<In, E2, R2>) =>
    pipe(input ?? Effect.succeed(undefined), Effect.flatMap(f));

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
  f: (_?: In) => Effect.Effect<Out, E1, R1>,
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

export const tapEffectify = <In, Out, E1, R1>(
  f: (_: In) => Effect.Effect<Out, E1, R1>,
) =>
  Function.dual<
    <O, E2, R2>(
      transform: (object: NoInfer<O>) => Effect.Effect<NoInfer<In>, E2, R2>,
    ) => <E3, R3>(
      self: Effect.Effect<O, E3, R3>,
    ) => Effect.Effect<O, E1 | E2 | E3, R1 | R2 | R3>,
    <O, E2, R2, E3, R3>(
      self: Effect.Effect<O, E3, R3>,
      transform: (object: NoInfer<O>) => Effect.Effect<NoInfer<In>, E2, R2>,
    ) => Effect.Effect<O, E1 | E2 | E3, R1 | R2 | R3>
  >(
    2,
    <O, E2, R2, E3, R3>(
      self: Effect.Effect<O, E3, R3>,
      transform: (object: NoInfer<O>) => Effect.Effect<NoInfer<In>, E2, R2>,
    ) =>
      pipe(
        self,
        Effect.tap((a) => pipe(transform(a), Effect.flatMap(f))),
      ),
  );

export const tapEffectifyOptional = <In, Out, E1, R1>(
  f: (_?: In) => Effect.Effect<Out, E1, R1>,
) =>
  Function.dual<
    <O, E2, R2>(
      transform?: (object: NoInfer<O>) => Effect.Effect<NoInfer<In>, E2, R2>,
    ) => <E3, R3>(
      self: Effect.Effect<O, E3, R3>,
    ) => Effect.Effect<O, E1 | E2 | E3, R1 | R2 | R3>,
    <O, E2, R2, E3, R3>(
      self: Effect.Effect<O, E3, R3>,
      transform?: (object: NoInfer<O>) => Effect.Effect<NoInfer<In>, E2, R2>,
    ) => Effect.Effect<O, E1 | E2 | E3, R1 | R2 | R3>
  >(
    (args) => Effect.isEffect(args[0]),
    <O, E2, R2, E3, R3>(
      self: Effect.Effect<O, E3, R3>,
      transform?: (object: NoInfer<O>) => Effect.Effect<NoInfer<In>, E2, R2>,
    ) =>
      pipe(
        self,
        Effect.tap((a) =>
          pipe(transform?.(a) ?? Effect.succeed(undefined), Effect.flatMap(f)),
        ),
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
  f: (_?: In) => Effect.Effect<Out, E1, R1>,
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

export const mapEffectify = <In, Out, E1, R1>(
  f: (_: In) => Effect.Effect<Out, E1, R1>,
) =>
  Function.dual<
    <O, E2, R2>(
      transform: (object: NoInfer<O>) => Effect.Effect<NoInfer<In>, E2, R2>,
    ) => <E3, R3>(
      self: Effect.Effect<O, E3, R3>,
    ) => Effect.Effect<Out, E1 | E2 | E3, R1 | R2 | R3>,
    <O, E2, R2, E3, R3>(
      self: Effect.Effect<O, E3, R3>,
      transform: (object: NoInfer<O>) => Effect.Effect<NoInfer<In>, E2, R2>,
    ) => Effect.Effect<Out, E1 | E2 | E3, R1 | R2 | R3>
  >(
    2,
    <O, E2, R2, E3, R3>(
      self: Effect.Effect<O, E3, R3>,
      transform: (object: NoInfer<O>) => Effect.Effect<NoInfer<In>, E2, R2>,
    ) =>
      pipe(
        self,
        Effect.flatMap((a) => pipe(transform(a), Effect.flatMap(f))),
      ),
  );

export const mapEffectifyOptional = <In, Out, E1, R1>(
  f: (_?: In) => Effect.Effect<Out, E1, R1>,
) =>
  Function.dual<
    <O, E2, R2>(
      transform?: (object: NoInfer<O>) => Effect.Effect<NoInfer<In>, E2, R2>,
    ) => <E3, R3>(
      self: Effect.Effect<O, E3, R3>,
    ) => Effect.Effect<Out, E1 | E2 | E3, R1 | R2 | R3>,
    <O, E2, R2, E3, R3>(
      self: Effect.Effect<O, E3, R3>,
      transform?: (object: NoInfer<O>) => Effect.Effect<NoInfer<In>, E2, R2>,
    ) => Effect.Effect<Out, E1 | E2 | E3, R1 | R2 | R3>
  >(
    (args) => Effect.isEffect(args[0]),
    <O, E2, R2, E3, R3>(
      self: Effect.Effect<O, E3, R3>,
      transform?: (object: NoInfer<O>) => Effect.Effect<NoInfer<In>, E2, R2>,
    ) =>
      pipe(
        self,
        Effect.flatMap((a) =>
          pipe(transform?.(a) ?? Effect.succeed(undefined), Effect.flatMap(f)),
        ),
      ),
  );

export const bindify = <In, Out, E1, R1>(
  f: (_: In) => Effect.Effect<Out, E1, R1>,
) =>
  Function.dual<
    <O extends object, N extends string>(
      name: Exclude<N, keyof O>,
      transform: (object: NoInfer<O>) => NoInfer<In>,
    ) => <E2, R2>(
      self: Effect.Effect<O, E2, R2>,
    ) => Effect.Effect<
      { [K in N | keyof O]: K extends keyof O ? O[K] : Out },
      E1 | E2,
      R1 | R2
    >,
    <O extends object, N extends string, E2, R2>(
      self: Effect.Effect<O, E2, R2>,
      name: Exclude<N, keyof O>,
      transform: (object: NoInfer<O>) => NoInfer<In>,
    ) => Effect.Effect<
      { [K in N | keyof O]: K extends keyof O ? O[K] : Out },
      E1 | E2,
      R1 | R2
    >
  >(
    3,
    <O extends object, N extends string, E2, R2>(
      self: Effect.Effect<O, E2, R2>,
      name: Exclude<N, keyof O>,
      transform: (object: NoInfer<O>) => NoInfer<In>,
    ) =>
      pipe(
        self,
        Effect.bind(name, (a) => f(transform(a))),
      ),
  );

export const bindifyOptional = <In, Out, E1, R1>(
  f: (_?: In) => Effect.Effect<Out, E1, R1>,
) =>
  Function.dual<
    <O extends object, N extends string>(
      name: Exclude<N, keyof O>,
      transform?: (object: NoInfer<O>) => NoInfer<In>,
    ) => <E2, R2>(
      self: Effect.Effect<O, E2, R2>,
    ) => Effect.Effect<
      { [K in N | keyof O]: K extends keyof O ? O[K] : Out },
      E1 | E2,
      R1 | R2
    >,
    <O extends object, N extends string, E2, R2>(
      self: Effect.Effect<O, E2, R2>,
      name: Exclude<N, keyof O>,
      transform?: (object: NoInfer<O>) => NoInfer<In>,
    ) => Effect.Effect<
      { [K in N | keyof O]: K extends keyof O ? O[K] : Out },
      E1 | E2,
      R1 | R2
    >
  >(
    (args) => Effect.isEffect(args[0]),
    <O extends object, N extends string, E2, R2>(
      self: Effect.Effect<O, E2, R2>,
      name: Exclude<N, keyof O>,
      transform?: (object: NoInfer<O>) => NoInfer<In>,
    ) =>
      pipe(
        self,
        Effect.bind(name, (a) => f(transform?.(a))),
      ),
  );

export const bindEffectify = <In, Out, E1, R1>(
  f: (_: In) => Effect.Effect<Out, E1, R1>,
) =>
  Function.dual<
    <O extends object, N extends string, E2, R2>(
      name: Exclude<N, keyof O>,
      transform: (object: NoInfer<O>) => Effect.Effect<NoInfer<In>, E2, R2>,
    ) => <E3, R3>(
      self: Effect.Effect<O, E3, R3>,
    ) => Effect.Effect<
      { [K in N | keyof O]: K extends keyof O ? O[K] : Out },
      E1 | E2 | E3,
      R1 | R2 | R3
    >,
    <O extends object, N extends string, E2, R2, E3, R3>(
      self: Effect.Effect<O, E3, R3>,
      name: Exclude<N, keyof O>,
      transform: (object: NoInfer<O>) => Effect.Effect<NoInfer<In>, E2, R2>,
    ) => Effect.Effect<
      { [K in N | keyof O]: K extends keyof O ? O[K] : Out },
      E1 | E2 | E3,
      R1 | R2 | R3
    >
  >(
    3,
    <O extends object, N extends string, E2, R2, E3, R3>(
      self: Effect.Effect<O, E3, R3>,
      name: Exclude<N, keyof O>,
      transform: (object: NoInfer<O>) => Effect.Effect<NoInfer<In>, E2, R2>,
    ) =>
      pipe(
        self,
        Effect.bind(name, (a) => pipe(transform(a), Effect.flatMap(f))),
      ),
  );

export const bindEffectifyOptional = <In, Out, E1, R1>(
  f: (_?: In) => Effect.Effect<Out, E1, R1>,
) =>
  Function.dual<
    <O extends object, N extends string, E2, R2>(
      name: Exclude<N, keyof O>,
      transform?: (object: NoInfer<O>) => Effect.Effect<NoInfer<In>, E2, R2>,
    ) => <E3, R3>(
      self: Effect.Effect<O, E3, R3>,
    ) => Effect.Effect<
      { [K in N | keyof O]: K extends keyof O ? O[K] : Out },
      E1 | E2 | E3,
      R1 | R2 | R3
    >,
    <O extends object, N extends string, E2, R2, E3, R3>(
      self: Effect.Effect<O, E3, R3>,
      name: Exclude<N, keyof O>,
      transform?: (object: NoInfer<O>) => Effect.Effect<NoInfer<In>, E2, R2>,
    ) => Effect.Effect<
      { [K in N | keyof O]: K extends keyof O ? O[K] : Out },
      E1 | E2 | E3,
      R1 | R2 | R3
    >
  >(
    (args) => Effect.isEffect(args[0]),
    <O extends object, N extends string, E2, R2, E3, R3>(
      self: Effect.Effect<O, E3, R3>,
      name: Exclude<N, keyof O>,
      transform?: (object: NoInfer<O>) => Effect.Effect<NoInfer<In>, E2, R2>,
    ) =>
      pipe(
        self,
        Effect.bind(name, (a) =>
          pipe(transform?.(a) ?? Effect.succeed(undefined), Effect.flatMap(f)),
        ),
      ),
  );

class Wrap<In, Out, E1, R1> extends Data.TaggedClass("Wrap")<{
  readonly f: (_: In) => Effect.Effect<Out, E1, R1>;
}> {
  get sync() {
    return this.f;
  }

  get effect() {
    return effectify(this.f);
  }

  get tap() {
    return tapify(this.f);
  }

  get tapEffect() {
    return tapEffectify(this.f);
  }

  get map() {
    return mapify(this.f);
  }

  get mapEffect() {
    return mapEffectify(this.f);
  }

  get bind() {
    return bindify(this.f);
  }

  get bindEffect() {
    return bindEffectify(this.f);
  }
}

class WrapOptional<In, Out, E1, R1> extends Data.TaggedClass("WrapOptional")<{
  readonly f: (_?: In) => Effect.Effect<Out, E1, R1>;
}> {
  get sync() {
    return this.f;
  }

  get effect() {
    return effectifyOptional(this.f);
  }

  get tap() {
    return tapifyOptional(this.f);
  }

  get tapEffect() {
    return tapEffectifyOptional(this.f);
  }

  get map() {
    return mapifyOptional(this.f);
  }

  get mapEffect() {
    return mapEffectifyOptional(this.f);
  }

  get bind() {
    return bindifyOptional(this.f);
  }

  get bindEffect() {
    return bindEffectifyOptional(this.f);
  }
}

export const wrap = <In, Out, E1, R1>(
  f: (_: In) => Effect.Effect<Out, E1, R1>,
) => new Wrap({ f });

export const wrapOptional = <In, Out, E1, R1>(
  f: (_?: In) => Effect.Effect<Out, E1, R1>,
) => new WrapOptional({ f });
