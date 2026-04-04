import { Effect, Layer, ServiceMap } from "effect";
import { GoogleAuth } from "google-auth-library";

export class GoogleAuthService extends ServiceMap.Service<GoogleAuthService>()(
  "GoogleAuthService",
  {
    make: Effect.sync(() => ({
      getAuth: () =>
        new GoogleAuth({
          keyFile: "/.secret/google-service-account.json",
          scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        }),
    })),
  },
) {
  static layer = Layer.effect(GoogleAuthService, this.make);
}
