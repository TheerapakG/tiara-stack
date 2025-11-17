import { Context, Types } from "effect";
import type { Zero, Schema, CustomMutatorDefs } from "@rocicorp/zero";

const ZeroServiceTypeId = Symbol("ZeroServiceTypeId");
export type ZeroServiceTypeId = typeof ZeroServiceTypeId;

interface Variance<
  out S extends Schema,
  out MD extends CustomMutatorDefs | undefined,
> {
  [ZeroServiceTypeId]: {
    _S: Types.Covariant<S>;
    _MD: Types.Covariant<MD>;
  };
}

/**
 * ZeroService provides access to a Zero instance.
 */
export interface ZeroService<
  S extends Schema,
  MD extends CustomMutatorDefs | undefined,
> extends Variance<S, MD> {}

/**
 * ZeroService provides access to a Zero instance.
 */
export const ZeroService = <
  S extends Schema,
  MD extends CustomMutatorDefs | undefined,
>() => Context.GenericTag<ZeroService<S, MD>, Zero<S, MD>>("ZeroService");
