import type { StandardSchemaV1 } from "@standard-schema/spec";
import { Effect, HKT, Option, Scope } from "effect";
import type { Type } from "typhoon-core/handler";
import { Handler } from "typhoon-core/server";
import { SignalService } from "typhoon-core/signal";
import { Validator } from "typhoon-core/validator";
import { Event } from "@/event/event";

export type MutationData = Handler.Data.Mutation.MutationHandlerData;
type MutationHandler<A = unknown, E = unknown, R = unknown> = Effect.Effect<
  A,
  E,
  R | SignalService.SignalService
>;
interface MutationHandlerTypeLambda extends Type.HandlerTypeLambda {
  readonly type: MutationHandler<this["Success"], this["Error"], this["Context"]>;
}

interface TransformUnknown extends HKT.TypeLambda {
  readonly type: unknown;
}

interface TransformDataKey extends Type.TransformDataKeyTypeLambda {
  readonly type: this["In"] extends infer Config extends MutationData
    ? Handler.Data.NameOrUndefined<Config>
    : never;
}

interface TransformDataSuccessIn extends HKT.TypeLambda {
  readonly type: this["In"] extends infer Config extends MutationData
    ? Handler.Data.ResponseOption<Config> extends Option.Some<
        infer Response extends Handler.Data.Shared.Response.ResponseConfig<StandardSchemaV1>
      >
      ? Validator.Input<Handler.Data.ResolvedResponseValidator<Response>>
      : unknown
    : never;
}

interface TransformDataSuccessOut extends HKT.TypeLambda {
  readonly type: this["In"] extends infer Config extends MutationData
    ? Handler.Data.ResponseOption<Config> extends Option.Some<
        infer Response extends Handler.Data.Shared.Response.ResponseConfig<StandardSchemaV1>
      >
      ? Validator.Output<Handler.Data.ResolvedResponseValidator<Response>>
      : unknown
    : never;
}

interface TransformDataErrorIn extends HKT.TypeLambda {
  readonly type: this["In"] extends infer Config extends MutationData
    ? Handler.Data.ResponseErrorOption<Config> extends Option.Some<
        infer ResponseError extends
          Handler.Data.Shared.ResponseError.ResponseErrorConfig<StandardSchemaV1>
      >
      ? Validator.Input<Handler.Data.ResolvedResponseErrorValidator<ResponseError>>
      : unknown
    : never;
}

interface TransformDataErrorOut extends HKT.TypeLambda {
  readonly type: this["In"] extends infer Config extends MutationData
    ? Handler.Data.ResponseErrorOption<Config> extends Option.Some<
        infer ResponseError extends
          Handler.Data.Shared.ResponseError.ResponseErrorConfig<StandardSchemaV1>
      >
      ? Validator.Output<Handler.Data.ResolvedResponseErrorValidator<ResponseError>>
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
    ? Exclude<Effect.Effect.Context<H>, SignalService.SignalService>
    : never;
}

export interface MutationHandlerT extends Type.BaseHandlerT {
  readonly Type: "mutation";
  readonly Data: MutationData;
  readonly Handler: MutationHandlerTypeLambda;
  readonly DefaultHandlerContext: Event | Scope.Scope | SignalService.SignalService;
  readonly TransformDataKey: TransformDataKey;
  readonly TransformDataSuccessIn: TransformDataSuccessIn;
  readonly TransformDataSuccessOut: TransformDataSuccessOut;
  readonly TransformDataErrorIn: TransformDataErrorIn;
  readonly TransformDataErrorOut: TransformDataErrorOut;
  readonly TransformDataContext: TransformUnknown;
  readonly TransformHandlerSuccess: TransformHandlerSuccess;
  readonly TransformHandlerError: TransformHandlerError;
  readonly TransformHandlerContext: TransformHandlerContext;
}
