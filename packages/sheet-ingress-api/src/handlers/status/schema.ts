import { Effect, Schema } from "effect";

export const ServiceStatusState = Schema.Literals(["ok", "down"]);
export type ServiceStatusState = Schema.Schema.Type<typeof ServiceStatusState>;

export const ServiceStatus = Schema.Struct({
  name: Schema.String,
  url: Schema.String,
  status: ServiceStatusState,
  httpStatus: Schema.NullOr(Schema.Number),
  latencyMs: Schema.NullOr(Schema.Number),
  checkedAt: Schema.DateTimeUtcFromMillis,
  error: Schema.optional(Schema.NullOr(Schema.String)).pipe(
    Schema.withDecodingDefault(Effect.succeed(null)),
  ),
});

export type ServiceStatus = Schema.Schema.Type<typeof ServiceStatus>;

export const ServicesStatusResponse = Schema.Struct({
  overallStatus: Schema.Literals(["ok", "degraded"]),
  checkedAt: Schema.DateTimeUtcFromMillis,
  services: Schema.Array(ServiceStatus),
});

export type ServicesStatusResponse = Schema.Schema.Type<typeof ServicesStatusResponse>;
