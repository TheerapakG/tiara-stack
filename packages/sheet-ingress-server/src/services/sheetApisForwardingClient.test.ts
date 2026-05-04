import { describe, expect, it } from "vitest";
import { Effect, HashSet, Option, Redacted } from "effect";
import { Headers } from "effect/unstable/http";
import { SheetAuthUser } from "sheet-ingress-api/schemas/middlewares/sheetAuthUser";
import { RoomOrderButtonMethods } from "sheet-ingress-api/sheet-apis-rpc";
import { getIngressRpcHeaders } from "./rpcAuthorizationClient";
import { SheetApisForwardingClient } from "./sheetApisForwardingClient";
import { SheetApisRpcClient } from "./sheetApisRpcClient";
import { SheetApisRpcTokens } from "./sheetApisRpcTokens";

const makeSheetApisRpcTokens = () =>
  ({
    getServiceToken: (tokenPath: string) => Effect.succeed(`${tokenPath}-token`),
  }) as never;

const run = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provideService(SheetApisRpcTokens, makeSheetApisRpcTokens()),
      Effect.provideService(SheetAuthUser, {
        accountId: "discord-user-1",
        userId: "user-1",
        permissions: HashSet.empty(),
        token: Redacted.make("sheet-auth-session-token"),
      }),
    ) as Effect.Effect<A, E, never>,
  );

describe("SheetApisForwardingClient", () => {
  it("builds sheet-apis ingress headers with sheet-auth session token but no Discord access token", async () => {
    const headers = await run(getIngressRpcHeaders({ serviceTokenPath: "sheet-apis-token" }));

    expect(Option.getOrUndefined(Headers.get(headers, "x-sheet-ingress-auth"))).toBe(
      "Bearer sheet-apis-token-token",
    );
    expect(Option.getOrUndefined(Headers.get(headers, "x-sheet-auth-user-id"))).toBe("user-1");
    expect(Option.getOrUndefined(Headers.get(headers, "x-sheet-auth-account-id"))).toBe(
      "discord-user-1",
    );
    expect(Option.getOrUndefined(Headers.get(headers, "x-sheet-auth-session-token"))).toBe(
      "Bearer sheet-auth-session-token",
    );
    expect(Option.isNone(Headers.get(headers, "x-sheet-discord-access-token"))).toBe(true);
  });

  it("builds sheet-bot ingress headers with the sheet-bot service token and shared auth context", async () => {
    const headers = await run(getIngressRpcHeaders({ serviceTokenPath: "sheet-bot-token" }));

    expect(Option.getOrUndefined(Headers.get(headers, "x-sheet-ingress-auth"))).toBe(
      "Bearer sheet-bot-token-token",
    );
    expect(Option.getOrUndefined(Headers.get(headers, "x-sheet-auth-user-id"))).toBe("user-1");
    expect(Option.getOrUndefined(Headers.get(headers, "x-sheet-auth-account-id"))).toBe(
      "discord-user-1",
    );
    expect(Option.getOrUndefined(Headers.get(headers, "x-sheet-auth-session-token"))).toBe(
      "Bearer sheet-auth-session-token",
    );
  });

  it("keeps split room-order forwarding methods aligned with shared button metadata", async () => {
    const rpcClient = Object.fromEntries(
      Object.values(RoomOrderButtonMethods).map((method) => [
        method.rpcTag,
        (args: unknown) => Effect.succeed({ method, args }),
      ]),
    );

    const client = await Effect.runPromise(
      SheetApisForwardingClient.make.pipe(
        Effect.provideService(SheetApisRpcClient, rpcClient as never),
      ),
    );

    for (const method of Object.values(RoomOrderButtonMethods)) {
      expect(client.roomOrder).toHaveProperty(method.endpointName);
      await expect(
        Effect.runPromise(
          client.roomOrder[method.endpointName]({
            payload: {
              guildId: "guild-1",
              messageId: "message-1",
              messageChannelId: "channel-1",
              interactionToken: "token-1",
            },
          } as never),
        ),
      ).resolves.toMatchObject({ method });
    }
  });
});
