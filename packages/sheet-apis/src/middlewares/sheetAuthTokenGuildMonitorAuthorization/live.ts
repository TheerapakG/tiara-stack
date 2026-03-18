import { Effect, Layer, pipe } from "effect";
import { SheetAuthTokenAuthorizationLive } from "../sheetAuthTokenAuthorization/live";
import { SheetAuthTokenAuthorization } from "../sheetAuthTokenAuthorization/tag";
import { makeSheetAuthTokenGuildMonitorAuthorization } from "./shared";
import { SheetAuthTokenGuildMonitorAuthorization } from "./tag";

export const SheetAuthTokenGuildMonitorAuthorizationLiveLayer = Layer.effect(
  SheetAuthTokenGuildMonitorAuthorization,
  pipe(SheetAuthTokenAuthorization, Effect.flatMap(makeSheetAuthTokenGuildMonitorAuthorization)),
);

export const SheetAuthTokenGuildMonitorAuthorizationLive =
  SheetAuthTokenGuildMonitorAuthorizationLiveLayer.pipe(
    Layer.provide(SheetAuthTokenAuthorizationLive),
  );
