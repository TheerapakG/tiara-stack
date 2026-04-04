import { Config, Effect, Schema } from "effect";
import { makeArgumentError } from "typhoon-core/error";

// Config schema definitions using Schema.Config
export const authBaseUrlConfig = Config.schema(Schema.URL, "AUTH_BASE_URL")
  .asEffect()
  .pipe(Effect.mapError((error) => makeArgumentError(error.message, error)));
export const appBaseUrlConfig = Config.schema(Schema.URL, "APP_BASE_URL")
  .asEffect()
  .pipe(Effect.mapError((error) => makeArgumentError(error.message, error)));
export const sheetApisBaseUrlConfig = Config.schema(Schema.URL, "SHEET_APIS_BASE_URL")
  .asEffect()
  .pipe(Effect.mapError((error) => makeArgumentError(error.message, error)));
