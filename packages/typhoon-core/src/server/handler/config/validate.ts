import { Effect, Either, Schema, pipe, ParseResult, flow } from "effect";
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
import { ValidationError } from "~/error";
import type { StandardSchemaV1 } from "@standard-schema/spec";

export type ResolvedRequestParamsValidator<Config extends RequestParamsConfig | undefined> =
  Config extends RequestParamsConfig<infer T extends StandardSchemaV1, infer Validate>
    ? Validate extends true
      ? T
      : undefined
    : undefined;

export type ResolvedResponseValidator<Config extends ResponseConfig | undefined> =
  Config extends ResponseConfig<infer T extends StandardSchemaV1> ? T : undefined;

export type ResolvedResponseErrorValidator<Config extends ResponseErrorConfig | undefined> =
  Config extends ResponseErrorConfig<infer T extends StandardSchemaV1> ? T : undefined;

export const resolveRequestParamsValidator: <const Config extends RequestParamsConfig | undefined>(
  config: Config,
) => ResolvedRequestParamsValidator<Config> = <
  const Config extends RequestParamsConfig | undefined,
>(
  config: Config,
): ResolvedRequestParamsValidator<Config> =>
  (config?.validate ? config.validator : undefined) as ResolvedRequestParamsValidator<Config>;

export const resolveResponseValidator: <const Config extends ResponseConfig | undefined>(
  config: Config,
) => ResolvedResponseValidator<Config> = <const Config extends ResponseConfig | undefined>(
  config: Config,
): ResolvedResponseValidator<Config> => config?.validator as ResolvedResponseValidator<Config>;

export const resolveResponseErrorValidator: <const Config extends ResponseErrorConfig | undefined>(
  config: Config,
) => ResolvedResponseErrorValidator<Config> = <
  const Config extends ResponseErrorConfig | undefined,
>(
  config: Config,
): ResolvedResponseErrorValidator<Config> =>
  config?.validator as ResolvedResponseErrorValidator<Config>;

type EffectSchemaType<V> = V extends Schema.Schema.All ? Schema.Schema.Type<V> : unknown;

type EffectSchemaEncoded<T, V> = V extends Schema.Schema.All ? Schema.Schema.Encoded<V> : T;

export const encodeResponse =
  <const Config extends PartialHandlerConfig>(config: Config) =>
  <
    A extends EffectSchemaType<ResolvedResponseValidator<ResponseOrUndefined<Config>>>,
    E extends EffectSchemaType<ResolvedResponseErrorValidator<ResponseErrorOrUndefined<Config>>>,
  >(
    either: Either.Either<A, E>,
  ): Effect.Effect<
    Either.Either<
      EffectSchemaEncoded<A, ResolvedResponseValidator<ResponseOrUndefined<Config>>>,
      EffectSchemaEncoded<E, ResolvedResponseErrorValidator<ResponseErrorOrUndefined<Config>>>
    >,
    ParseResult.ParseError
  > =>
    pipe(
      either,
      Either.match({
        onRight: (v) => {
          const responseValidator = resolveResponseValidator(response(config));
          if (!Schema.isSchema(responseValidator)) {
            return Effect.succeed(Either.right(v));
          }

          return pipe(v, Schema.encode(responseValidator), Effect.map(Either.right));
        },
        onLeft: (v) => {
          const responseErrorValidator = resolveResponseErrorValidator(responseError(config));
          if (!Schema.isSchema(responseErrorValidator)) {
            return Effect.succeed(Either.left(v));
          }

          return pipe(v, Schema.encode(responseErrorValidator), Effect.map(Either.left));
        },
      }),
    ) as unknown as Effect.Effect<
      Either.Either<
        EffectSchemaEncoded<A, ResolvedResponseValidator<ResponseOrUndefined<Config>>>,
        EffectSchemaEncoded<E, ResolvedResponseErrorValidator<ResponseErrorOrUndefined<Config>>>
      >,
      ParseResult.ParseError
    >;

export const encodeResponseEffect =
  <const Config extends PartialHandlerConfig>(config: Config) =>
  <
    A extends EffectSchemaType<ResolvedResponseValidator<ResponseOrUndefined<Config>>>,
    E extends EffectSchemaType<ResolvedResponseErrorValidator<ResponseErrorOrUndefined<Config>>>,
    R,
  >(
    effect: Effect.Effect<A, E, R>,
  ): Effect.Effect<
    EffectSchemaEncoded<A, ResolvedResponseValidator<ResponseOrUndefined<Config>>>,
    EffectSchemaEncoded<E, ResolvedResponseErrorValidator<ResponseErrorOrUndefined<Config>>>,
    R
  > =>
    pipe(
      effect,
      Effect.either,
      Effect.flatMap(encodeResponse(config)),
      Effect.orDie,
      Effect.flatten,
    );

export const decodeResponseUnknown =
  <const Config extends PartialHandlerConfig>(config: Config) =>
  (
    either: Either.Either<unknown, unknown>,
  ): Effect.Effect<
    Either.Either<
      Validator.Output<ResolvedResponseValidator<ResponseOrUndefined<Config>>>,
      Validator.Output<ResolvedResponseErrorValidator<ResponseErrorOrUndefined<Config>>>
    >,
    ValidationError
  > =>
    pipe(
      either,
      Either.match({
        onRight: flow(
          Validate.validate(resolveResponseValidator(response(config))),
          Effect.map(Either.right),
        ),
        onLeft: flow(
          Validate.validate(resolveResponseErrorValidator(responseError(config))),
          Effect.map(Either.left),
        ),
      }),
    );
