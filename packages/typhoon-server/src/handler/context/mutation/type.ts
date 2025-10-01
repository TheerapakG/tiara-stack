import type { StandardSchemaV1 } from "@standard-schema/spec";
import { Effect, HKT, Option } from "effect";
import type { Type } from "typhoon-core/handler";
import { Handler } from "typhoon-core/server";
import { Validator } from "typhoon-core/validator";
import { Event } from "../../../event/event";

type MutationData = Handler.Config.Mutation.MutationHandlerConfig;
type MutationHandler<A = unknown, E = unknown, R = unknown> = Effect.Effect<
  A,
  E,
  R
>;
interface MutationHandlerTypeLambda extends Type.HandlerTypeLambda {
  readonly type: MutationHandler<
    this["Success"],
    this["Error"],
    this["Context"]
  >;
}

interface TransformUnknown extends HKT.TypeLambda {
  readonly type: unknown;
}

interface TransformDataKey extends HKT.TypeLambda {
  readonly type: this["In"] extends infer Config extends MutationData
    ? Handler.Config.NameOrUndefined<Config>
    : never;
}

interface TransformDataSuccessIn extends HKT.TypeLambda {
  readonly type: this["In"] extends infer Config extends MutationData
    ? Handler.Config.ResponseOption<Config> extends Option.Some<
        infer Response extends Handler.Config.Shared.Response.ResponseConfig<
          StandardSchemaV1,
          boolean
        >
      >
      ? Validator.Input<Handler.Config.ResolvedResponseValidator<Response>>
      : unknown
    : never;
}

interface TransformDataSuccessOut extends HKT.TypeLambda {
  readonly type: this["In"] extends infer Config extends MutationData
    ? Handler.Config.ResponseOption<Config> extends Option.Some<
        infer Response extends Handler.Config.Shared.Response.ResponseConfig<
          StandardSchemaV1,
          boolean
        >
      >
      ? Validator.Validated<Handler.Config.ResolvedResponseValidator<Response>>
      : unknown
    : never;
}

interface TransformHandlerSuccess extends HKT.TypeLambda {
  readonly type: this["In"] extends infer H extends MutationHandler
    ? Effect.Effect.Success<H>
    : never;
}

interface TransformHandlerError extends HKT.TypeLambda {
  readonly type: this["In"] extends infer H extends MutationHandler
    ? Effect.Effect.Error<H>
    : never;
}

interface TransformHandlerContext extends HKT.TypeLambda {
  readonly type: this["In"] extends infer H extends MutationHandler
    ? Effect.Effect.Context<H>
    : never;
}

export interface MutationHandlerT extends Type.BaseHandlerT {
  readonly Type: "mutation";
  readonly Data: MutationData;
  readonly Handler: MutationHandlerTypeLambda;
  readonly DefaultHandlerContext: Event;
  readonly TransformDataKey: TransformDataKey;
  readonly TransformDataSuccessIn: TransformDataSuccessIn;
  readonly TransformDataSuccessOut: TransformDataSuccessOut;
  readonly TransformDataError: TransformUnknown;
  readonly TransformDataContext: TransformUnknown;
  readonly TransformHandlerSuccess: TransformHandlerSuccess;
  readonly TransformHandlerError: TransformHandlerError;
  readonly TransformHandlerContext: TransformHandlerContext;
}
