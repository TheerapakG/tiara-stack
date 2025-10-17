import { RequestParamsConfig } from "./shared/requestParams";
import { ResponseConfig } from "./shared/response";

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
