import { Effect, Layer, Option, Redacted } from "effect";
import { makeKubernetesServiceAccountTokenAuthorizer } from "sheet-auth/plugins/kubernetes-oauth/rpc-authorization";
import {
  decodeForwardedSheetAuthUser,
  SHEET_AUTH_SESSION_TOKEN_UNAVAILABLE,
} from "sheet-ingress-api/middlewares/forwardedAuthHeaders";
import { SheetBotDispatchRpcAuthorization } from "sheet-ingress-api/middlewares/sheetBotDispatchRpcAuthorization/tag";
import { SheetBotRpcAuthorization } from "sheet-ingress-api/middlewares/sheetBotRpcAuthorization/tag";
import { SheetAuthUser } from "sheet-ingress-api/schemas/middlewares/sheetAuthUser";
import { config } from "@/config";

type SheetBotRpcAuthorizationMiddleware = Parameters<typeof SheetBotRpcAuthorization.of>[0];
type SheetBotDispatchRpcAuthorizationMiddleware = Parameters<
  typeof SheetBotDispatchRpcAuthorization.of
>[0];

const forwardedSessionTokenUnavailable = Redacted.make(SHEET_AUTH_SESSION_TOKEN_UNAVAILABLE);

const makeSheetIngressAuthorizer = Effect.gen(function* () {
  const podNamespace = yield* config.podNamespace;
  const maybeIngressNamespace = yield* config.sheetIngressNamespace;
  const ingressNamespace = Option.getOrElse(maybeIngressNamespace, () => podNamespace);
  const audience = yield* config.sheetIngressKubernetesAudience;
  return yield* makeKubernetesServiceAccountTokenAuthorizer({
    audience,
    expectedNamespace: ingressNamespace,
    expectedServiceAccountName: "sheet-ingress-server",
  });
});

export const SheetBotRpcAuthorizationLive = Layer.effect(
  SheetBotRpcAuthorization,
  Effect.gen(function* () {
    const authorizer = yield* makeSheetIngressAuthorizer;

    const middleware: SheetBotRpcAuthorizationMiddleware = Effect.fn("SheetBotRpcAuthorization")(
      function* (rpcEffect, options) {
        const headers = options.headers;
        yield* authorizer.requireAuthorizedHeaders(headers);

        return yield* rpcEffect;
      },
    );

    return SheetBotRpcAuthorization.of(middleware);
  }),
);

export const SheetBotDispatchRpcAuthorizationLive = Layer.effect(
  SheetBotDispatchRpcAuthorization,
  Effect.gen(function* () {
    const authorizer = yield* makeSheetIngressAuthorizer;

    const middleware: SheetBotDispatchRpcAuthorizationMiddleware = Effect.fn(
      "SheetBotDispatchRpcAuthorization",
    )(function* (rpcEffect, options) {
      const headers = options.headers;
      yield* authorizer.requireAuthorizedHeaders(headers);

      const user = yield* Effect.suspend(() =>
        decodeForwardedSheetAuthUser(headers, {
          unavailableToken: forwardedSessionTokenUnavailable,
        }),
      );

      return yield* rpcEffect.pipe(Effect.provideService(SheetAuthUser, user));
    });

    return SheetBotDispatchRpcAuthorization.of(middleware);
  }),
);
