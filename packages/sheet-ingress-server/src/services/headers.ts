import { Option } from "effect";
import type { HttpServerRequest } from "effect/unstable/http";

const forwardedHeadersFrom = (request: HttpServerRequest.HttpServerRequest) => {
  const remoteAddress = Option.getOrUndefined(request.remoteAddress);
  const forwardedFor = remoteAddress
    ? [request.headers["x-forwarded-for"], remoteAddress].filter(Boolean).join(", ")
    : request.headers["x-forwarded-for"];

  return {
    ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
    "x-forwarded-host": request.headers["x-forwarded-host"] ?? request.headers.host ?? "",
    "x-forwarded-proto": request.headers["x-forwarded-proto"] ?? "http",
  };
};

export const scrubbedForwardHeadersFrom = (request: HttpServerRequest.HttpServerRequest) => {
  const safeHeaders = Object.fromEntries(
    Object.entries(request.headers).filter(([key]) => {
      const normalizedKey = key.toLowerCase();
      return normalizedKey !== "authorization" && !normalizedKey.startsWith("x-sheet-");
    }),
  );
  return { ...safeHeaders, ...forwardedHeadersFrom(request) };
};
