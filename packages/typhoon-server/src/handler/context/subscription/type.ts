import type { StandardSchemaV1 } from "@standard-schema/spec";
import { Effect, HKT, Option, Scope } from "effect";
import type { Type } from "typhoon-core/handler";
import { Handler } from "typhoon-core/server";
import { SignalContext } from "typhoon-core/signal";
import { Validator } from "typhoon-core/validator";
import { Event } from "../../../event/event";

type SubscriptionData = Handler.Config.Subscription.SubscriptionHandlerConfig;
type InnerSubscriptionHandler<
  A = unknown,
  E = unknown,
  R = unknown,
> = Effect.Effect<A, E, R | SignalContext.SignalContext>;
type SubscriptionHandler<A = unknown, E = unknown, R = unknown> = Effect.Effect<
  InnerSubscriptionHandler<A, E, R>,
  E,
  R
>;
interface SubscriptionHandlerTypeLambda extends Type.HandlerTypeLambda {
  readonly type: SubscriptionHandler<
    this["Success"],
    this["Error"],
    this["Context"]
  >;
}

interface TransformUnknown extends HKT.TypeLambda {
  readonly type: unknown;
}

interface TransformDataKey extends HKT.TypeLambda {
  readonly type: this["In"] extends infer Config extends SubscriptionData
    ? Handler.Config.NameOrUndefined<Config>
    : never;
}

interface TransformDataSuccessIn extends HKT.TypeLambda {
  readonly type: this["In"] extends infer Config extends SubscriptionData
    ? Handler.Config.ResponseOption<Config> extends Option.Some<
        infer Response extends
          Handler.Config.Shared.Response.ResponseConfig<StandardSchemaV1>
      >
      ? Validator.Input<Handler.Config.ResolvedResponseValidator<Response>>
      : unknown
    : never;
}

interface TransformDataSuccessOut extends HKT.TypeLambda {
  readonly type: this["In"] extends infer Config extends SubscriptionData
    ? Handler.Config.ResponseOption<Config> extends Option.Some<
        infer Response extends
          Handler.Config.Shared.Response.ResponseConfig<StandardSchemaV1>
      >
      ? Validator.Output<Handler.Config.ResolvedResponseValidator<Response>>
      : unknown
    : never;
}

interface TransformDataErrorIn extends HKT.TypeLambda {
  readonly type: this["In"] extends infer Config extends SubscriptionData
    ? Handler.Config.ResponseErrorOption<Config> extends Option.Some<
        infer ResponseError extends
          Handler.Config.Shared.ResponseError.ResponseErrorConfig<StandardSchemaV1>
      >
      ? Validator.Input<
          Handler.Config.ResolvedResponseErrorValidator<ResponseError>
        >
      : unknown
    : never;
}

interface TransformDataErrorOut extends HKT.TypeLambda {
  readonly type: this["In"] extends infer Config extends SubscriptionData
    ? Handler.Config.ResponseErrorOption<Config> extends Option.Some<
        infer ResponseError extends
          Handler.Config.Shared.ResponseError.ResponseErrorConfig<StandardSchemaV1>
      >
      ? Validator.Output<
          Handler.Config.ResolvedResponseErrorValidator<ResponseError>
        >
      : unknown
    : never;
}

interface TransformHandlerSuccess extends HKT.TypeLambda {
  readonly type: this["In"] extends infer H extends SubscriptionHandler
    ? Effect.Effect.Success<H> extends infer IH extends InnerSubscriptionHandler
      ? Effect.Effect.Success<IH>
      : never
    : never;
}

interface TransformHandlerError extends HKT.TypeLambda {
  readonly type: this["In"] extends infer H extends SubscriptionHandler
    ? Effect.Effect.Success<H> extends infer IH extends InnerSubscriptionHandler
      ? Effect.Effect.Error<H> | Effect.Effect.Error<IH>
      : never
    : never;
}

interface TransformHandlerContext extends HKT.TypeLambda {
  readonly type: this["In"] extends infer H extends SubscriptionHandler
    ? Effect.Effect.Success<H> extends infer IH extends InnerSubscriptionHandler
      ?
          | Effect.Effect.Context<H>
          | Exclude<Effect.Effect.Context<IH>, SignalContext.SignalContext>
      : never
    : never;
}

export interface SubscriptionHandlerT extends Type.BaseHandlerT {
  readonly Type: "subscription";
  readonly Data: SubscriptionData;
  readonly Handler: SubscriptionHandlerTypeLambda;
  readonly DefaultHandlerContext: Event | Scope.Scope;
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
