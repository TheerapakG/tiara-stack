import { Effect, Either, Schema, pipe, ParseResult } from "effect";
import { RequestParamsConfig } from "./shared/requestParams";
import { ResponseConfig } from "./shared/response";
import { ResponseErrorConfig } from "./shared/responseError";
import {
  response,
  responseError,
  type PartialHandlerConfig,
  type ResponseOrUndefined,
  type ResponseErrorOrUndefined,
} from "./data";
import { Validate, Validator } from "~/validator";
import { Validation } from "~/error";
import type { StandardSchemaV1 } from "@standard-schema/spec";

export type ResolvedRequestParamsValidator<
  Config extends RequestParamsConfig | undefined,
> =
  Config extends RequestParamsConfig<
    infer T extends StandardSchemaV1,
    infer Validate
  >
    ? Validate extends true
      ? T
      : undefined
    : undefined;

export type ResolvedResponseValidator<
  Config extends ResponseConfig | undefined,
> =
  Config extends ResponseConfig<infer T extends StandardSchemaV1>
    ? T
    : undefined;

export type ResolvedResponseErrorValidator<
  Config extends ResponseErrorConfig | undefined,
> =
  Config extends ResponseErrorConfig<infer T extends StandardSchemaV1>
    ? T
    : undefined;

export const resolveRequestParamsValidator: <
  const Config extends RequestParamsConfig | undefined,
>(
  config: Config,
) => ResolvedRequestParamsValidator<Config> = <
  const Config extends RequestParamsConfig | undefined,
>(
  config: Config,
): ResolvedRequestParamsValidator<Config> =>
  (config?.validate
    ? config.validator
    : undefined) as ResolvedRequestParamsValidator<Config>;

export const resolveResponseValidator: <
  const Config extends ResponseConfig | undefined,
>(
  config: Config,
) => ResolvedResponseValidator<Config> = <
  const Config extends ResponseConfig | undefined,
>(
  config: Config,
): ResolvedResponseValidator<Config> =>
  config?.validator as ResolvedResponseValidator<Config>;

export const resolveResponseErrorValidator: <
  const Config extends ResponseErrorConfig | undefined,
>(
  config: Config,
) => ResolvedResponseErrorValidator<Config> = <
  const Config extends ResponseErrorConfig | undefined,
>(
  config: Config,
): ResolvedResponseErrorValidator<Config> =>
  config?.validator as ResolvedResponseErrorValidator<Config>;

export const encodeResponse =
  <const Config extends PartialHandlerConfig>(config: Config) =>
  (
    either: [
      ResolvedResponseValidator<ResponseOrUndefined<Config>>,
      ResolvedResponseErrorValidator<ResponseErrorOrUndefined<Config>>,
    ] extends [
      infer A extends Schema.Schema.All,
      infer E extends Schema.Schema.All,
    ]
      ? Either.Either<Schema.Schema.Type<A>, Schema.Schema.Type<E>>
      : never,
  ): [
    ResolvedResponseValidator<ResponseOrUndefined<Config>>,
    ResolvedResponseErrorValidator<ResponseErrorOrUndefined<Config>>,
  ] extends [
    infer A extends Schema.Schema.All,
    infer E extends Schema.Schema.All,
  ]
    ? Effect.Effect<
        Either.Either<Schema.Schema.Encoded<A>, Schema.Schema.Encoded<E>>,
        ParseResult.ParseError
      >
    : never =>
    pipe(
      either,
      Either.match({
        onRight: (v) =>
          pipe(
            v,
            Schema.encode(
              resolveResponseValidator(
                response(config),
              ) as unknown as ResolvedResponseValidator<
                ResponseOrUndefined<Config>
              > extends infer A extends Schema.Schema.Any
                ? A
                : never,
            ),
            Effect.map(Either.right),
          ),
        onLeft: (v) =>
          pipe(
            v,
            Schema.encode(
              resolveResponseErrorValidator(
                responseError(config),
              ) as unknown as ResolvedResponseErrorValidator<
                ResponseErrorOrUndefined<Config>
              > extends infer E extends Schema.Schema.Any
                ? E
                : never,
            ),
            Effect.map(Either.left),
          ),
      }),
    ) as unknown as [
      ResolvedResponseValidator<ResponseOrUndefined<Config>>,
      ResolvedResponseErrorValidator<ResponseErrorOrUndefined<Config>>,
    ] extends [
      infer A extends Schema.Schema.All,
      infer E extends Schema.Schema.All,
    ]
      ? Effect.Effect<
          Either.Either<Schema.Schema.Encoded<A>, Schema.Schema.Encoded<E>>,
          ParseResult.ParseError
        >
      : never;

export const decodeResponseUnknown =
  <const Config extends PartialHandlerConfig>(config: Config) =>
  (
    either: Either.Either<unknown, unknown>,
  ): Effect.Effect<
    Either.Either<
      Validator.Output<ResolvedResponseValidator<ResponseOrUndefined<Config>>>,
      Validator.Output<
        ResolvedResponseErrorValidator<ResponseErrorOrUndefined<Config>>
      >
    >,
    Validation.ValidationError
  > =>
    pipe(
      either,
      Either.match({
        onRight: (v) =>
          pipe(
            v,
            Validate.validate(resolveResponseValidator(response(config))),
            Effect.map(Either.right),
          ),
        onLeft: (v) =>
          pipe(
            v,
            Validate.validate(
              resolveResponseErrorValidator(responseError(config)),
            ),
            Effect.map(Either.left),
          ),
      }),
    );
