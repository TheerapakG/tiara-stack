import { Effect, Layer, pipe, Redacted } from "effect";
import { createClient } from "@openauthjs/openauth/client";
import { subjects } from "sheet-auth/subjects";
import { SheetAuthTokenAuthorization } from "./tag";
import { Unauthorized } from "../error";
import { config } from "../../config";

export const SheetAuthTokenAuthorizationLive = Layer.effect(
  SheetAuthTokenAuthorization,
  pipe(
    Effect.Do,
    Effect.bind("issuer", () =>
      Effect.map(config.sheetAuthIssuer, (url) => url.replace(/\/$/, "")),
    ),
    Effect.map(({ issuer }) => {
      const client = createClient({
        clientID: "sheet-apis",
        issuer,
      });

      return SheetAuthTokenAuthorization.of({
        sheetAuthToken: (token) =>
          pipe(
            Effect.promise(() => client.verify(subjects, Redacted.value(token))),
            Effect.flatMap((result) => {
              if (result.err) {
                return Effect.fail(
                  new Unauthorized({
                    message: `Invalid sheet-auth token: ${result.err.name}`,
                    cause: result.err,
                  }),
                );
              }
              return Effect.succeed(result.subject.properties);
            }),
            Effect.withSpan("SheetAuthTokenAuthorization.sheetAuthToken", {
              captureStackTrace: true,
            }),
          ),
      });
    }),
  ),
);
