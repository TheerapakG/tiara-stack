import type { StandardSchemaV1 } from "@standard-schema/spec";
import { Effect, HKT, Option, Scope } from "effect";
import type { Type } from "typhoon-core/handler";
import { Handler } from "typhoon-core/server";
import { SignalContext, SignalService } from "typhoon-core/signal";
import { Validator } from "typhoon-core/validator";
import { Event } from "@/event/event";

export type SubscriptionData = Handler.Data.Subscription.SubscriptionHandlerData;
type InnerSubscriptionHandler<A = unknown, E = unknown, R = unknown> = Effect.Effect<
  A,
  E,
  R | SignalContext.SignalContext | SignalService.SignalService
>;
type SubscriptionHandler<A = unknown, E = unknown, R = unknown> = Effect.Effect<
  InnerSubscriptionHandler<A, E, R>,
  E,
  R | SignalService.SignalService
>;
interface SubscriptionHandlerTypeLambda extends Type.HandlerTypeLambda {
  readonly type: SubscriptionHandler<this["Success"], this["Error"], this["Context"]>;
}

interface TransformUnknown extends HKT.TypeLambda {
  readonly type: unknown;
}

interface TransformDataKey extends Type.TransformDataKeyTypeLambda {
  readonly type: this["In"] extends infer Config extends SubscriptionData
    ? Handler.Data.NameOrUndefined<Config>
    : never;
}

interface TransformDataSuccessIn extends HKT.TypeLambda {
  readonly type: this["In"] extends infer Config extends SubscriptionData
    ? Handler.Data.ResponseOption<Config> extends Option.Some<
        infer Response extends Handler.Data.Shared.Response.ResponseConfig<StandardSchemaV1>
      >
      ? Validator.Input<Handler.Data.ResolvedResponseValidator<Response>>
      : unknown
    : never;
}

interface TransformDataSuccessOut extends HKT.TypeLambda {
  readonly type: this["In"] extends infer Config extends SubscriptionData
    ? Handler.Data.ResponseOption<Config> extends Option.Some<
        infer Response extends Handler.Data.Shared.Response.ResponseConfig<StandardSchemaV1>
      >
      ? Validator.Output<Handler.Data.ResolvedResponseValidator<Response>>
      : unknown
    : never;
}

interface TransformDataErrorIn extends HKT.TypeLambda {
  readonly type: this["In"] extends infer Config extends SubscriptionData
    ? Handler.Data.ResponseErrorOption<Config> extends Option.Some<
        infer ResponseError extends
          Handler.Data.Shared.ResponseError.ResponseErrorConfig<StandardSchemaV1>
      >
      ? Validator.Input<Handler.Data.ResolvedResponseErrorValidator<ResponseError>>
      : unknown
    : never;
}

interface TransformDataErrorOut extends HKT.TypeLambda {
  readonly type: this["In"] extends infer Config extends SubscriptionData
    ? Handler.Data.ResponseErrorOption<Config> extends Option.Some<
        infer ResponseError extends
          Handler.Data.Shared.ResponseError.ResponseErrorConfig<StandardSchemaV1>
      >
      ? Validator.Output<Handler.Data.ResolvedResponseErrorValidator<ResponseError>>
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
          | Exclude<Effect.Effect.Context<H>, SignalService.SignalService>
          | Exclude<
              Effect.Effect.Context<IH>,
              SignalContext.SignalContext | SignalService.SignalService
            >
      : never
    : never;
}

export interface SubscriptionHandlerT extends Type.BaseHandlerT {
  readonly Type: "subscription";
  readonly Data: SubscriptionData;
  readonly Handler: SubscriptionHandlerTypeLambda;
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
