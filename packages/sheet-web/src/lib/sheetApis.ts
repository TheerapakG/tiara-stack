import { AtomHttpApi, Registry } from "@effect-atom/atom-react";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "@effect/platform";
import { Api } from "sheet-apis/api";
import { Effect, Function, Layer, Option, pipe } from "effect";
import { getRequest, getRequestHeaders } from "@tanstack/react-start/server";
import { createIsomorphicFn } from "@tanstack/react-start";
import { sessionJwtAtom } from "#/lib/auth";
import { sheetApisBaseUrlAtom } from "#/lib/configAtoms";
import { ensureResultAtomData } from "#/lib/atomRegistry";

const getRequestHeadersFn = createIsomorphicFn()
  .server(() => ({
    origin: getRequestHeaders().get("origin") ?? new URL(getRequest().url).origin,
    cookie: getRequestHeaders().get("cookie") ?? undefined,
  }))
  .client(() => ({}));

const AuthClientLive = Effect.gen(function* () {
  const httpClient = yield* HttpClient.HttpClient;

  return HttpClient.mapRequestEffect(
    httpClient,
    Effect.fnUntraced(function* (request) {
      const registry = yield* Registry.AtomRegistry;
      const { baseUrl, jwt } = yield* Effect.all({
        baseUrl: ensureResultAtomData(registry, sheetApisBaseUrlAtom),
        jwt: ensureResultAtomData(registry, sessionJwtAtom),
      }).pipe(
        Effect.match({
          onFailure: () => ({ baseUrl: Option.none(), jwt: Option.none() }),
          onSuccess: ({ baseUrl, jwt }) => ({ baseUrl: Option.some(baseUrl), jwt }),
        }),
      );

      const headers = getRequestHeadersFn();

      return pipe(
        request,
        Option.match(baseUrl, {
          onSome: (baseUrl) => HttpClientRequest.prependUrl(baseUrl.href),
          onNone: () => Function.identity<HttpClientRequest.HttpClientRequest>,
        }),
        Option.match(jwt, {
          onSome: (token) => HttpClientRequest.bearerToken(token),
          onNone: () => Function.identity<HttpClientRequest.HttpClientRequest>,
        }),
        HttpClientRequest.setHeaders(headers),
      );
    }),
  ) as HttpClient.HttpClient;
}).pipe(
  Layer.effect(HttpClient.HttpClient),
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(Layer.succeed(FetchHttpClient.RequestInit, { credentials: "include" })),
);

export class SheetApisClient extends AtomHttpApi.Tag<SheetApisClient>()("SheetApisClient", {
  api: Api,
  httpClient: AuthClientLive,
}) {}
