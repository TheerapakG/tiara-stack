import { AtomHttpApi, AtomRegistry } from "effect/unstable/reactivity";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http";
import { Api } from "sheet-apis/api";
import { Effect, Function, Layer, Option, pipe, Redacted } from "effect";
import { getRequest, getRequestHeaders } from "@tanstack/react-start/server";
import { createIsomorphicFn } from "@tanstack/react-start";
import { sessionAtom } from "#/lib/auth";
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
      const registry = yield* AtomRegistry.AtomRegistry;
      const { baseUrl, session } = yield* Effect.all({
        baseUrl: ensureResultAtomData(registry, sheetApisBaseUrlAtom, { revalidateIfStale: true }),
        session: ensureResultAtomData(registry, sessionAtom, { revalidateIfStale: true }),
      }).pipe(
        Effect.match({
          onFailure: () => ({ baseUrl: Option.none(), session: Option.none() }),
          onSuccess: ({ baseUrl, session }) => ({ baseUrl: Option.some(baseUrl), session }),
        }),
      );

      const headers = getRequestHeadersFn();

      return pipe(
        request,
        Option.match(baseUrl, {
          onSome: (baseUrl) => HttpClientRequest.prependUrl(baseUrl.href),
          onNone: () => Function.identity<HttpClientRequest.HttpClientRequest>,
        }),
        Option.match(session, {
          onSome: (session) =>
            session.token
              ? HttpClientRequest.bearerToken(encodeURIComponent(Redacted.value(session.token)))
              : Function.identity<HttpClientRequest.HttpClientRequest>,
          onNone: () => Function.identity<HttpClientRequest.HttpClientRequest>,
        }),
        HttpClientRequest.setHeaders(headers),
      );
    }),
  ) as unknown as HttpClient.HttpClient;
}).pipe(
  Layer.effect(HttpClient.HttpClient),
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(Layer.succeed(FetchHttpClient.RequestInit, { credentials: "include" })),
);

export class SheetApisClient extends AtomHttpApi.Service<SheetApisClient>()("SheetApisClient", {
  api: Api,
  httpClient: AuthClientLive,
}) {}
