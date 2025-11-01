import { Array, Function, Option, Struct, Types } from "effect";

type OptionFields<A> = {
  [K in keyof A as A[K] extends Option.Option<any>
    ? K
    : never]: A[K] extends Option.Option<any> ? A[K] : never;
};

type OptionFieldValues<A> = {
  [K in keyof A as A[K] extends Option.Option<any>
    ? K
    : never]: A[K] extends Option.Option<any>
    ? Option.Option.Value<A[K]>
    : never;
};

export type GetSomeFields<A, F extends keyof OptionFields<A>> = Option.Option<
  Types.Simplify<Pick<OptionFieldValues<A>, F>>
>;

export const getSomeFields = Function.dual<
  <const A extends object, const F extends keyof OptionFields<A>>(
    fields: Array.NonEmptyReadonlyArray<F>,
  ) => (a: A) => Option.Option<Types.Simplify<Pick<OptionFieldValues<A>, F>>>,
  <const A extends object, const F extends keyof OptionFields<A>>(
    a: A,
    fields: Array.NonEmptyReadonlyArray<F>,
  ) => Option.Option<Types.Simplify<Pick<OptionFieldValues<A>, F>>>
>(
  2,
  <A extends object, const F extends keyof OptionFields<A>>(
    a: A,
    fields: Array.NonEmptyReadonlyArray<F>,
  ) =>
    Option.all(
      Struct.pick(a, ...fields) as Pick<OptionFields<A>, F>,
    ) as unknown as Option.Option<
      Types.Simplify<Pick<OptionFieldValues<A>, F>>
    >,
);
