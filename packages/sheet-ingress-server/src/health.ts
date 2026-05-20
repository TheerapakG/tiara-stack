import { Layer } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";

export const healthRoutesLayer = Layer.mergeAll(
  HttpRouter.add("GET", "/live", HttpServerResponse.empty({ status: 200 })),
  HttpRouter.add("GET", "/ready", HttpServerResponse.empty({ status: 200 })),
);
