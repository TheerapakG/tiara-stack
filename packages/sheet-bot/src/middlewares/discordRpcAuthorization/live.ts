import { Effect, Layer, Option } from "effect";
import { makeKubernetesServiceAccountTokenAuthorizer } from "sheet-auth/plugins/kubernetes-oauth/rpc-authorization";
import { SheetBotRpcAuthorization } from "sheet-ingress-api/middlewares/sheetBotRpcAuthorization/tag";
import { config } from "@/config";

type SheetBotRpcAuthorizationMiddleware = Parameters<typeof SheetBotRpcAuthorization.of>[0];

export const SheetBotRpcAuthorizationLive = Layer.effect(
  SheetBotRpcAuthorization,
  Effect.gen(function* () {
    const podNamespace = yield* config.podNamespace;
    const maybeIngressNamespace = yield* config.sheetIngressNamespace;
    const ingressNamespace = Option.getOrElse(maybeIngressNamespace, () => podNamespace);
    const audience = yield* config.sheetIngressKubernetesAudience;
    const authorizer = yield* makeKubernetesServiceAccountTokenAuthorizer({
      audience,
      expectedNamespace: ingressNamespace,
      expectedServiceAccountName: "sheet-ingress-server",
    });

    const middleware: SheetBotRpcAuthorizationMiddleware = Effect.fn("SheetBotRpcAuthorization")(
      function* (rpcEffect, options) {
        yield* authorizer.requireAuthorizedHeaders(options.headers);

        return yield* rpcEffect;
      },
    );

    return SheetBotRpcAuthorization.of(middleware);
  }),
);
