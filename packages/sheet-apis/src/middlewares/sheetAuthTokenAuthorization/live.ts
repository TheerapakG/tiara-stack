import { Effect, Layer, pipe } from "effect";
import { type SheetAuthClient as SheetAuthClientValue } from "sheet-auth/client";
import { ApplicationOwnerResolver } from "../../services/applicationOwner";
import { SheetAuthClient } from "../../services/sheetAuthClient";
import { makeSheetAuthTokenAuthorization } from "./shared";
import { SheetAuthTokenAuthorization } from "./tag";

export const SheetAuthTokenAuthorizationLiveLayer = Layer.effect(
  SheetAuthTokenAuthorization,
  pipe(
    Effect.all({
      authClient: SheetAuthClient,
      applicationOwnerResolver: ApplicationOwnerResolver,
    }),
    Effect.flatMap(({ authClient, applicationOwnerResolver }) =>
      makeSheetAuthTokenAuthorization(authClient as SheetAuthClientValue, applicationOwnerResolver),
    ),
  ),
);

export const SheetAuthTokenAuthorizationLive = SheetAuthTokenAuthorizationLiveLayer.pipe(
  Layer.provide(Layer.mergeAll(SheetAuthClient.Default, ApplicationOwnerResolver.Default)),
);
