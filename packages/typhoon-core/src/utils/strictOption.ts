import { Option } from "effect";

export type ValueExtendsOr<O extends Option.Option<unknown>, E, D> =
  O extends Option.Some<infer T extends E> ? T : D;

export type ValueExtends<O extends Option.Option<unknown>, E> = ValueExtendsOr<O, E, never>;

export const some = <T>(value: T) => Option.some(value) as Option.Some<T>;

export const none = <T = never>() => Option.none<T>() as Option.None<T>;

export type GetOrUndefined<O extends Option.Option<unknown>> =
  O extends Option.Some<unknown> ? Option.Option.Value<O> : undefined;

export const getOrUndefined = <O extends Option.Option<unknown>>(option: O) =>
  Option.getOrUndefined(option) as GetOrUndefined<O>;

export type GetOrNull<O extends Option.Option<unknown>> =
  O extends Option.Some<unknown> ? Option.Option.Value<O> : null;

export const getOrNull = <O extends Option.Option<unknown>>(option: O) =>
  Option.getOrNull(option) as GetOrNull<O>;
