import { Effect, Layer } from "effect";
import { ApplicationOwnerResolver } from "../../services/applicationOwner";
import { SheetAuthClient } from "../../services/sheetAuthClient";
import { makeSheetAuthTokenAuthorization } from "./shared";
import { SheetAuthTokenAuthorization } from "./tag";

export const SheetAuthTokenAuthorizationLive = Layer.effect(
  SheetAuthTokenAuthorization,
  Effect.gen(function* () {
    const authClient = yield* SheetAuthClient;
    const applicationOwnerResolver = yield* ApplicationOwnerResolver;

    return yield* makeSheetAuthTokenAuthorization(authClient, applicationOwnerResolver);
  }),
).pipe(Layer.provide([SheetAuthClient.layer, ApplicationOwnerResolver.layer]));
