import { describe, expect, it, vi } from "vitest";
import { ConfigProvider, Effect, HashSet, Redacted } from "effect";
import { Headers } from "effect/unstable/http";
import { SheetBotDispatchRpcAuthorization } from "sheet-ingress-api/middlewares/sheetBotDispatchRpcAuthorization/tag";
import { SheetAuthUser } from "sheet-ingress-api/schemas/middlewares/sheetAuthUser";
import { SheetBotDispatchRpcAuthorizationLive } from "./live";

type AuthorizedUser = {
  readonly accountId: string;
  readonly userId: string;
  readonly permissions: HashSet.HashSet<string>;
  readonly token: string;
};

vi.mock("sheet-auth/plugins/kubernetes-oauth/rpc-authorization", async () => {
  const { Duration, Effect } = await import("effect");
  return {
    getBearerToken: (authorization: string | undefined) => {
      if (!authorization?.startsWith("Bearer ")) {
        return undefined;
      }

      const token = authorization.slice("Bearer ".length).trim();
      return token.length === 0 ? undefined : token;
    },
    makeKubernetesServiceAccountTokenAuthorizer: vi.fn(() =>
      Effect.succeed({
        requireAuthorizedHeaders: vi.fn(() =>
          Effect.succeed({
            exp: Math.floor(Date.now() / 1000) + 60,
            sub: "system:serviceaccount:default:sheet-ingress-server",
            ttl: Duration.minutes(1),
          }),
        ),
      }),
    ),
  };
});

const makeHeaders = (headers: Record<string, string>) =>
  Object.entries(headers).reduce(
    (acc, [key, value]) => Headers.set(acc, key, value),
    Headers.empty,
  );

const runMiddleware = (headers: Headers.Headers) =>
  Effect.runPromiseExit(
    Effect.scoped(
      Effect.gen(function* () {
        const authorization = yield* SheetBotDispatchRpcAuthorization;
        return yield* authorization(
          Effect.gen(function* () {
            const user = yield* SheetAuthUser;
            return {
              accountId: user.accountId,
              userId: user.userId,
              permissions: user.permissions,
              token: Redacted.value(user.token),
            };
          }) as never,
          {
            client: {} as never,
            requestId: 0 as never,
            rpc: {} as never,
            payload: undefined,
            headers,
          },
        );
      }).pipe(
        Effect.provide(SheetBotDispatchRpcAuthorizationLive),
        Effect.provide(
          ConfigProvider.layer(
            ConfigProvider.fromUnknown({
              POD_NAMESPACE: "default",
              SHEET_INGRESS_KUBERNETES_AUDIENCE: "sheet-bot",
            }),
          ),
        ),
      ) as unknown as Effect.Effect<AuthorizedUser, never, never>,
    ),
  );

describe("SheetBotDispatchRpcAuthorizationLive", () => {
  it("rejects calls without forwarded auth user headers", async () => {
    const exit = await runMiddleware(makeHeaders({ "x-sheet-ingress-auth": "Bearer token" }));

    expect(exit._tag).toBe("Failure");
  });

  it("provides forwarded SheetAuthUser when headers exist", async () => {
    const exit = await runMiddleware(
      makeHeaders({
        "x-sheet-ingress-auth": "Bearer token",
        "x-sheet-auth-user-id": "user-1",
        "x-sheet-auth-account-id": "discord-user-1",
        "x-sheet-auth-permissions": "account:discord:discord-user-1",
        "x-sheet-auth-session-token": "Bearer sheet-auth-session-token",
      }),
    );

    expect(exit._tag).toBe("Success");
    if (exit._tag === "Success") {
      expect(exit.value.accountId).toBe("discord-user-1");
      expect(exit.value.userId).toBe("user-1");
      expect(HashSet.has(exit.value.permissions, "account:discord:discord-user-1")).toBe(true);
      expect(exit.value.token).toBe("sheet-auth-session-token");
    }
  });
});
