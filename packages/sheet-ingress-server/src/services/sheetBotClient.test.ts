import { describe, expect, it } from "vitest";
import { Cause, ConfigProvider, Deferred, Effect, Exit, Fiber, Option, Redacted } from "effect";
import { Headers, HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";
import { SheetBotClient } from "./sheetBotClient";
import { SheetApisClient } from "./sheetApisClient";

const makeSheetApisClient = () =>
  ({
    getServiceUser: () =>
      Effect.succeed({
        token: Redacted.make("service-token"),
      }),
  }) as never;

const run = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  httpClient: HttpClient.HttpClient = HttpClient.make((request) =>
    Effect.succeed(HttpClientResponse.fromWeb(request, new Response("{}", { status: 500 }))),
  ),
  sheetApisClient: never = makeSheetApisClient(),
) =>
  Effect.runPromise(
    Effect.scoped(
      effect.pipe(
        Effect.provideService(SheetApisClient, sheetApisClient),
        Effect.provideService(HttpClient.HttpClient, httpClient),
        Effect.provide(
          ConfigProvider.layer(
            ConfigProvider.fromUnknown({ SHEET_BOT_BASE_URL: "http://sheet-bot" }),
          ),
        ),
      ) as Effect.Effect<A, E, never>,
    ),
  );

describe("SheetBotClient", () => {
  it("exposes application and cache compatibility wrappers", async () => {
    const client = await run(SheetBotClient.make);

    expect(client.application.getApplication).toEqual(expect.any(Function));
    expect(client.cache.getMember).toEqual(expect.any(Function));
  });

  it("adds the service bearer token to RPC HTTP requests", async () => {
    const requestReceived = Deferred.makeUnsafe<HttpClientRequest.HttpClientRequest>();
    const httpClient = HttpClient.make((request) => {
      return Deferred.succeed(requestReceived, request).pipe(
        Effect.as(HttpClientResponse.fromWeb(request, new Response("{}", { status: 500 }))),
      );
    });

    const request = await run(
      Effect.gen(function* () {
        const client = yield* SheetBotClient.make;
        const fiber = yield* Effect.forkScoped(Effect.ignore(client.application.getApplication()));
        const request = yield* Deferred.await(requestReceived);
        yield* Fiber.interrupt(fiber);
        return request;
      }),
      httpClient,
    );

    expect(request.url).toBe("http://sheet-bot/rpc/");
    expect(Option.getOrUndefined(Headers.get(request.headers, "authorization"))).toBe(
      "Bearer service-token",
    );
  });

  it("wraps service-user failures as RPC transport errors", async () => {
    const serviceUserFailure = new Error("service-user refresh failed");
    const sheetApisClient = {
      getServiceUser: () => Effect.fail(serviceUserFailure),
    } as never;

    const exit = await Effect.runPromiseExit(
      Effect.scoped(
        Effect.gen(function* () {
          const client = yield* SheetBotClient.make;
          return yield* client.application.getApplication();
        }).pipe(
          Effect.provideService(SheetApisClient, sheetApisClient),
          Effect.provideService(
            HttpClient.HttpClient,
            HttpClient.make((request) =>
              Effect.succeed(
                HttpClientResponse.fromWeb(request, new Response("{}", { status: 500 })),
              ),
            ),
          ),
          Effect.provide(
            ConfigProvider.layer(
              ConfigProvider.fromUnknown({ SHEET_BOT_BASE_URL: "http://sheet-bot" }),
            ),
          ),
        ),
      ),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const error = Cause.findErrorOption(exit.cause);
      const cause = Cause.pretty(exit.cause);
      expect(Option.isSome(error)).toBe(true);
      if (Option.isSome(error)) {
        expect(error.value._tag).toBe("RpcClientError");
        if (error.value._tag !== "RpcClientError") return;
        const reason = error.value.reason;
        expect(reason._tag).toBe("HttpError");
        if (reason._tag !== "HttpError") return;
        expect(reason.kind).toBe("TransportError");
        const authCause = (reason.cause as { cause?: unknown }).cause as Error & {
          cause?: unknown;
        };
        expect(authCause.message).toContain("Failed to get sheet-bot service user");
        expect(String(authCause.cause)).toContain("service-user refresh failed");
      }
      expect(cause).toContain("RpcClientError");
    }
  });
});
