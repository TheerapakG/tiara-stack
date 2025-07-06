import { Effect } from "effect";
import { GoogleAuth as GoogleAuthLibrary } from "google-auth-library";

export class GoogleAuth extends Effect.Service<GoogleAuth>()("GoogleAuth", {
  sync: () =>
    new GoogleAuthLibrary({
      // keyFile: "/.secret/google-service-account.json",
      keyFile: "/.secret/google-service-account.json",
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    }),
}) {}
