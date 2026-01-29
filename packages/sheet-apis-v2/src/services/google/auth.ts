import { Effect, pipe } from "effect";
import { GoogleAuth } from "google-auth-library";

export class GoogleAuthService extends Effect.Service<GoogleAuthService>()("GoogleAuthService", {
  sync: () =>
    pipe(
      new GoogleAuth({
        keyFile: "/.secret/google-service-account.json",
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      }),
      (auth) => ({
        getAuth: () => auth,
      }),
    ),
  accessors: true,
}) {}
