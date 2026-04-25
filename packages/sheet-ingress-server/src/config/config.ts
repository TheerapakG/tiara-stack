import { Config } from "effect";

export const config = {
  port: Config.port("PORT").pipe(Config.withDefault(3000)),
  sheetApisBaseUrl: Config.string("SHEET_APIS_BASE_URL"),
  sheetBotBaseUrl: Config.string("SHEET_BOT_BASE_URL"),
  sheetAuthIssuer: Config.string("SHEET_AUTH_ISSUER"),
};
