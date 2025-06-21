import { StandardSchemaV1 } from "@standard-schema/spec";
import { validate } from "../schema/validate";

export type RequestParamsConfig<
  T extends StandardSchemaV1 = StandardSchemaV1,
  Validate extends boolean = boolean,
> = {
  validator: T;
  validate: Validate;
};

export const validateRequestParamsConfig = <
  Config extends RequestParamsConfig | undefined,
>(
  config: Config,
) =>
  validate(
    (config
      ? config.validate
        ? config.validator
        : undefined
      : undefined) as Config extends RequestParamsConfig<
      infer T,
      infer Validate
    >
      ? Validate extends true
        ? T
        : undefined
      : undefined,
  );

export type ResponseConfig<
  T extends StandardSchemaV1 = StandardSchemaV1,
  Stream extends boolean = boolean,
> = {
  validator: T;
  stream: Stream;
};

export type HandlerConfig<
  Name extends string = string,
  HandlerType extends "subscription" | "mutation" = "subscription" | "mutation",
  RequestParams extends
    | RequestParamsConfig<StandardSchemaV1, boolean>
    | undefined = RequestParamsConfig<StandardSchemaV1, boolean> | undefined,
  Response extends ResponseConfig<StandardSchemaV1, boolean> = ResponseConfig<
    StandardSchemaV1,
    boolean
  >,
> = {
  name: Name;
  type: HandlerType;
  requestParams: RequestParams;
  response: Response;
};

export type SubscriptionHandlerConfig<
  Name extends string = string,
  RequestParams extends
    | RequestParamsConfig<StandardSchemaV1, boolean>
    | undefined = RequestParamsConfig<StandardSchemaV1, boolean> | undefined,
  Response extends ResponseConfig<StandardSchemaV1, boolean> = ResponseConfig<
    StandardSchemaV1,
    boolean
  >,
> = HandlerConfig<Name, "subscription", RequestParams, Response>;

export type MutationHandlerConfig<
  Name extends string = string,
  RequestParams extends
    | RequestParamsConfig<StandardSchemaV1, boolean>
    | undefined = RequestParamsConfig<StandardSchemaV1, boolean> | undefined,
  Response extends ResponseConfig<StandardSchemaV1, boolean> = ResponseConfig<
    StandardSchemaV1,
    boolean
  >,
> = HandlerConfig<Name, "mutation", RequestParams, Response>;

type HandlerConfigBuilderContext<
  Name extends string | undefined,
  HandlerType extends "subscription" | "mutation" | undefined,
  RequestParams extends
    | RequestParamsConfig<StandardSchemaV1, boolean>
    | undefined,
  Response extends ResponseConfig<StandardSchemaV1, boolean> | undefined,
> = {
  name: Name;
  type: HandlerType;
  requestParams: RequestParams;
  response: Response;
};

const defineHandlerNameContext = <
  Name extends string,
  HandlerType extends "subscription" | "mutation" | undefined,
  RequestParams extends
    | RequestParamsConfig<StandardSchemaV1, boolean>
    | undefined,
  Response extends ResponseConfig<StandardSchemaV1, boolean> | undefined,
>(
  ctx: HandlerConfigBuilderContext<
    undefined,
    HandlerType,
    RequestParams,
    Response
  >,
  name: Name,
): HandlerConfigBuilderContext<Name, HandlerType, RequestParams, Response> => {
  return { ...ctx, name };
};

const defineHandlerTypeContext = <
  Name extends string | undefined,
  HandlerType extends "subscription" | "mutation",
  RequestParams extends
    | RequestParamsConfig<StandardSchemaV1, boolean>
    | undefined,
  Response extends ResponseConfig<StandardSchemaV1, boolean> | undefined,
>(
  ctx: HandlerConfigBuilderContext<Name, undefined, RequestParams, Response>,
  type: HandlerType,
): HandlerConfigBuilderContext<Name, HandlerType, RequestParams, Response> => {
  return { ...ctx, type };
};

export type RequestParamsConfigIn<
  T extends StandardSchemaV1,
  Validate extends boolean | undefined,
> = {
  validator: T;
  validate?: Validate;
};

type CoercedTrue<T extends boolean | undefined> = T extends undefined
  ? true
  : T;
type CoercedFalse<T extends boolean | undefined> = T extends undefined
  ? false
  : T;

const coerceTrue = <T extends boolean | undefined>(
  value: T,
): CoercedTrue<T> => {
  return (value ?? true) as CoercedTrue<T>;
};

const coerceFalse = <T extends boolean | undefined>(
  value: T,
): CoercedFalse<T> => {
  return (value ?? false) as CoercedFalse<T>;
};

export type DefinedRequestParamsConfig<
  CParams extends RequestParamsConfigIn<StandardSchemaV1, boolean | undefined>,
> =
  CParams extends RequestParamsConfigIn<infer TParams, infer Validate>
    ? RequestParamsConfig<TParams, CoercedTrue<Validate>>
    : never;

const transformRequestParamConfig = <
  CParams extends RequestParamsConfigIn<StandardSchemaV1, boolean | undefined>,
>(
  config: CParams,
): DefinedRequestParamsConfig<CParams> => {
  return {
    validator: config.validator,
    validate: coerceTrue(config.validate),
  } as DefinedRequestParamsConfig<CParams>;
};

const defineHandlerRequestParamsContext = <
  Name extends string | undefined,
  HandlerType extends "subscription" | "mutation" | undefined,
  RequestParams extends RequestParamsConfigIn<
    StandardSchemaV1,
    boolean | undefined
  >,
  Response extends ResponseConfig<StandardSchemaV1, boolean> | undefined,
>(
  ctx: HandlerConfigBuilderContext<Name, HandlerType, undefined, Response>,
  requestParams: RequestParams,
): HandlerConfigBuilderContext<
  Name,
  HandlerType,
  DefinedRequestParamsConfig<RequestParams>,
  Response
> => {
  return { ...ctx, requestParams: transformRequestParamConfig(requestParams) };
};

export type ResponseConfigIn<
  T extends StandardSchemaV1,
  Stream extends boolean | undefined,
> = {
  validator: T;
  stream?: Stream;
};

export type DefinedResponseConfig<
  C extends ResponseConfigIn<StandardSchemaV1, boolean | undefined>,
> =
  C extends ResponseConfigIn<infer T, infer Stream>
    ? ResponseConfig<T, CoercedFalse<Stream>>
    : never;

const baseTransformResponseConfig = <
  T extends StandardSchemaV1,
  Stream extends boolean | undefined,
>(
  config: ResponseConfigIn<T, Stream>,
): ResponseConfig<T, CoercedFalse<Stream>> => {
  return {
    validator: config.validator,
    stream: coerceFalse(config.stream) as CoercedFalse<Stream>,
  };
};

const transformResponseConfig = <
  C extends ResponseConfigIn<StandardSchemaV1, boolean | undefined>,
>(
  config: C,
): DefinedResponseConfig<C> => {
  return baseTransformResponseConfig(
    config as ResponseConfigIn<StandardSchemaV1, boolean | undefined>,
  ) as DefinedResponseConfig<C>;
};

const defineHandlerResponseContext = <
  Name extends string | undefined,
  HandlerType extends "subscription" | "mutation" | undefined,
  RequestParams extends
    | RequestParamsConfig<StandardSchemaV1, boolean>
    | undefined,
  Response extends ResponseConfigIn<StandardSchemaV1, boolean | undefined>,
>(
  ctx: HandlerConfigBuilderContext<Name, HandlerType, RequestParams, undefined>,
  response: Response,
): HandlerConfigBuilderContext<
  Name,
  HandlerType,
  RequestParams,
  DefinedResponseConfig<Response>
> => {
  return { ...ctx, response: transformResponseConfig(response) };
};

class HandlerConfigBuilder<
  Name extends string | undefined = string | undefined,
  HandlerType extends "subscription" | "mutation" | undefined =
    | "subscription"
    | "mutation"
    | undefined,
  RequestParams extends
    | RequestParamsConfig<StandardSchemaV1, boolean>
    | undefined = RequestParamsConfig<StandardSchemaV1, boolean> | undefined,
  Response extends ResponseConfig<StandardSchemaV1, boolean> | undefined =
    | ResponseConfig<StandardSchemaV1, boolean>
    | undefined,
> {
  private constructor(
    private readonly ctx: HandlerConfigBuilderContext<
      Name,
      HandlerType,
      RequestParams,
      Response
    >,
  ) {}

  static make(): HandlerConfigBuilder<
    undefined,
    undefined,
    undefined,
    undefined
  > {
    return new HandlerConfigBuilder({
      name: undefined,
      type: undefined,
      requestParams: undefined,
      response: undefined,
    });
  }

  private internalName<Name extends string>(
    this: HandlerConfigBuilder<undefined, HandlerType, RequestParams, Response>,
    name: Name,
  ): HandlerConfigBuilder<Name, HandlerType, RequestParams, Response> {
    return new HandlerConfigBuilder(defineHandlerNameContext(this.ctx, name));
  }

  name<Name extends string>(
    name: Name,
  ): this extends HandlerConfigBuilder<
    undefined,
    HandlerType,
    RequestParams,
    Response
  >
    ? HandlerConfigBuilder<Name, HandlerType, RequestParams, Response>
    : "'name' is already defined" {
    return (
      this as unknown as HandlerConfigBuilder<
        undefined,
        HandlerType,
        RequestParams,
        Response
      >
    ).internalName(name) as unknown as this extends HandlerConfigBuilder<
      undefined,
      HandlerType,
      RequestParams,
      Response
    >
      ? HandlerConfigBuilder<Name, HandlerType, RequestParams, Response>
      : "'name' is already defined";
  }

  private internalType<HandlerType extends "subscription" | "mutation">(
    this: HandlerConfigBuilder<Name, undefined, RequestParams, Response>,
    type: HandlerType,
  ): HandlerConfigBuilder<Name, HandlerType, RequestParams, Response> {
    return new HandlerConfigBuilder(defineHandlerTypeContext(this.ctx, type));
  }

  type<HandlerType extends "subscription" | "mutation">(
    type: HandlerType,
  ): this extends HandlerConfigBuilder<Name, undefined, RequestParams, Response>
    ? HandlerConfigBuilder<Name, HandlerType, RequestParams, Response>
    : "'type' is already defined" {
    return (
      this as unknown as HandlerConfigBuilder<
        Name,
        undefined,
        RequestParams,
        Response
      >
    ).internalType(type) as unknown as this extends HandlerConfigBuilder<
      Name,
      undefined,
      RequestParams,
      Response
    >
      ? HandlerConfigBuilder<Name, HandlerType, RequestParams, Response>
      : "'type' is already defined";
  }

  private internalRequest<
    RequestParams extends RequestParamsConfigIn<
      StandardSchemaV1,
      boolean | undefined
    >,
  >(
    this: HandlerConfigBuilder<Name, HandlerType, undefined, Response>,
    requestParams: RequestParams,
  ): HandlerConfigBuilder<
    Name,
    HandlerType,
    DefinedRequestParamsConfig<RequestParams>,
    Response
  > {
    return new HandlerConfigBuilder(
      defineHandlerRequestParamsContext(this.ctx, requestParams),
    );
  }

  request<
    RequestParamsIn extends RequestParamsConfigIn<
      StandardSchemaV1,
      boolean | undefined
    >,
  >(
    requestParams: RequestParamsIn,
  ): this extends HandlerConfigBuilder<Name, HandlerType, undefined, Response>
    ? HandlerConfigBuilder<
        Name,
        HandlerType,
        DefinedRequestParamsConfig<RequestParamsIn>,
        Response
      >
    : "'request' is already defined" {
    return (
      this as unknown as HandlerConfigBuilder<
        Name,
        HandlerType,
        undefined,
        Response
      >
    ).internalRequest(
      requestParams,
    ) as unknown as this extends HandlerConfigBuilder<
      Name,
      HandlerType,
      undefined,
      Response
    >
      ? HandlerConfigBuilder<
          Name,
          HandlerType,
          DefinedRequestParamsConfig<RequestParamsIn>,
          Response
        >
      : "'request' is already defined";
  }

  private internalResponse<
    Response extends ResponseConfigIn<StandardSchemaV1, boolean | undefined>,
  >(
    this: HandlerConfigBuilder<Name, HandlerType, RequestParams, undefined>,
    response: Response,
  ): HandlerConfigBuilder<
    Name,
    HandlerType,
    RequestParams,
    DefinedResponseConfig<Response>
  > {
    return new HandlerConfigBuilder(
      defineHandlerResponseContext(this.ctx, response),
    );
  }

  response<
    ResponseIn extends ResponseConfigIn<StandardSchemaV1, boolean | undefined>,
  >(
    response: ResponseIn,
  ): this extends HandlerConfigBuilder<
    Name,
    HandlerType,
    RequestParams,
    undefined
  >
    ? HandlerConfigBuilder<
        Name,
        HandlerType,
        RequestParams,
        DefinedResponseConfig<ResponseIn>
      >
    : "'response' is already defined" {
    return (
      this as unknown as HandlerConfigBuilder<
        Name,
        HandlerType,
        RequestParams,
        undefined
      >
    ).internalResponse(
      response,
    ) as unknown as this extends HandlerConfigBuilder<
      Name,
      HandlerType,
      RequestParams,
      undefined
    >
      ? HandlerConfigBuilder<
          Name,
          HandlerType,
          RequestParams,
          DefinedResponseConfig<ResponseIn>
        >
      : "'response' is already defined";
  }

  build<
    Name extends string,
    HandlerType extends "subscription" | "mutation",
    Response extends ResponseConfig<StandardSchemaV1, boolean>,
  >(
    this: HandlerConfigBuilder<Name, HandlerType, RequestParams, Response>,
  ): HandlerConfig<Name, HandlerType, RequestParams, Response> {
    return {
      name: this.ctx.name,
      type: this.ctx.type,
      requestParams: this.ctx.requestParams,
      response: this.ctx.response,
    };
  }
}

export const defineHandlerConfigBuilder = () => HandlerConfigBuilder.make();
