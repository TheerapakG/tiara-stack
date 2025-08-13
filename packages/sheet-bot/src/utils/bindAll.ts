import { Effect } from "effect";

export const bindObject =
  <
    A extends object,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    X extends Record<string, Effect.Effect<any, any, any>>,
  >(
    obj: [Extract<keyof X, keyof A>] extends [never] ? X : `Duplicate keys`,
  ) =>
  <E, R>(self: Effect.Effect<A, E, R>) =>
    Effect.bindAll(() => obj, { concurrency: "unbounded" })(self);
