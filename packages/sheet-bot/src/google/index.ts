import { Layer, pipe } from "effect";
import { GoogleAuth } from "./auth";
import { GoogleSheets } from "./sheets";

export * from "./auth";
export * from "./sheets";

export const GoogleLive = pipe(
  Layer.mergeAll(GoogleSheets.DefaultWithoutDependencies),
  Layer.provideMerge(GoogleAuth.Default),
);
