import { Effect, Layer, pipe } from "effect";
import { type SheetAuthClient as SheetAuthClientValue } from "sheet-auth/client";
import { SheetAuthClient } from "../../services/sheetAuthClient";
import { makeSheetAuthTokenAuthorization } from "./shared";
import { SheetAuthTokenAuthorization } from "./tag";

export const SheetAuthTokenAuthorizationLiveLayer = Layer.effect(
  SheetAuthTokenAuthorization,
  pipe(
    SheetAuthClient,
    Effect.flatMap((authClient: SheetAuthClientValue) =>
      makeSheetAuthTokenAuthorization(authClient),
    ),
  ),
);

export const SheetAuthTokenAuthorizationLive = SheetAuthTokenAuthorizationLiveLayer.pipe(
  Layer.provide(SheetAuthClient.Default),
);
