import { RequestParamsConfig, ResponseConfig } from "./data";

export type ResolvedRequestParamsValidator<
  Config extends RequestParamsConfig | undefined,
> =
  Config extends RequestParamsConfig<infer T, infer Validate>
    ? Validate extends true
      ? T
      : undefined
    : undefined;

export type ResolvedResponseValidator<
  Config extends ResponseConfig | undefined,
> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Config extends ResponseConfig<infer T, any> ? T : undefined;

export const resolveRequestParamsValidator = <
  const Config extends RequestParamsConfig | undefined,
>(
  config: Config,
) =>
  (config?.validate
    ? config.validator
    : undefined) as ResolvedRequestParamsValidator<Config>;

export const resolveResponseValidator = <
  const Config extends ResponseConfig | undefined,
>(
  config: Config,
) => config?.validator as ResolvedResponseValidator<Config>;
