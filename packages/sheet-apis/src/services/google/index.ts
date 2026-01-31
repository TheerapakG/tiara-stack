import { Layer, pipe } from "effect";
import { GoogleAuthService } from "./auth";
import { GoogleSheets } from "./sheets";

export * from "./auth";
export * from "./sheets";

export const GoogleLive = pipe(
  Layer.mergeAll(GoogleSheets.DefaultWithoutDependencies),
  Layer.provideMerge(GoogleAuthService.Default),
);
