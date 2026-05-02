import { Ix } from "dfx";
import { Deferred, Effect, Option } from "effect";
import { describe, expect, it } from "vitest";
import { WrappedCommandHelper, makeForkedCommandHandler } from "./commandHelper";
import {
  MessageComponentHelper,
  makeForkedMessageComponentHandler,
} from "./messageComponentHelper";

const application = { id: "application-1" };

const makeInteraction = (id: string, token: string) =>
  ({
    id,
    token,
  }) as never;

const makeRest = (calls: Array<{ readonly applicationId: string; readonly token: string }>) =>
  ({
    updateOriginalWebhookMessage: (applicationId: string, token: string) =>
      Effect.sync(() => {
        calls.push({ applicationId, token });
        return {};
      }),
    withFiles:
      () =>
      <A, E, R>(effect: Effect.Effect<A, E, R>) =>
        effect,
  }) as never;

const makeCommandHelper = (rest: never) =>
  Effect.gen(function* () {
    const response = yield* Deferred.make<{
      readonly files: ReadonlyArray<File>;
      readonly payload: never;
    }>();

    return new WrappedCommandHelper(
      { data: {}, target: undefined } as never,
      Option.none(),
      [],
      rest,
      application as never,
      response as never,
    );
  });

const makeMessageComponentHelper = (rest: never) =>
  Effect.gen(function* () {
    const response = yield* Deferred.make<{
      readonly files: ReadonlyArray<File>;
      readonly payload: never;
    }>();

    return new MessageComponentHelper(rest, application as never, response as never);
  });

describe("interaction token context", () => {
  it("propagates the current interaction token through forked command handlers", async () => {
    const calls: Array<{ readonly applicationId: string; readonly token: string }> = [];
    const rest = makeRest(calls);

    const program = Effect.scoped(
      Effect.gen(function* () {
        const forkedHandler = yield* makeForkedCommandHandler((helper) =>
          helper.editReply({ payload: {} }),
        );
        const firstHelper = yield* makeCommandHelper(rest);
        const secondHelper = yield* makeCommandHelper(rest);

        yield* Effect.all(
          [
            forkedHandler(firstHelper).pipe(
              Effect.provideService(Ix.Interaction, makeInteraction("interaction-1", "token-1")),
            ),
            forkedHandler(secondHelper).pipe(
              Effect.provideService(Ix.Interaction, makeInteraction("interaction-2", "token-2")),
            ),
          ],
          { concurrency: "unbounded" },
        );
      }),
    );

    await Effect.runPromise(program as Effect.Effect<void, never, never>);

    expect(calls).toHaveLength(2);
    expect(calls).toEqual(
      expect.arrayContaining([
        { applicationId: "application-1", token: "token-1" },
        { applicationId: "application-1", token: "token-2" },
      ]),
    );
  });

  it("propagates the current interaction token through forked message component handlers", async () => {
    const calls: Array<{ readonly applicationId: string; readonly token: string }> = [];
    const rest = makeRest(calls);

    const program = Effect.scoped(
      Effect.gen(function* () {
        const forkedHandler = yield* makeForkedMessageComponentHandler((helper) =>
          helper.editReply({ payload: {} }),
        );
        const firstHelper = yield* makeMessageComponentHelper(rest);
        const secondHelper = yield* makeMessageComponentHelper(rest);

        yield* Effect.all(
          [
            forkedHandler(firstHelper).pipe(
              Effect.provideService(Ix.Interaction, makeInteraction("interaction-1", "token-1")),
            ),
            forkedHandler(secondHelper).pipe(
              Effect.provideService(Ix.Interaction, makeInteraction("interaction-2", "token-2")),
            ),
          ],
          { concurrency: "unbounded" },
        );
      }),
    );

    await Effect.runPromise(program as Effect.Effect<void, never, never>);

    expect(calls).toHaveLength(2);
    expect(calls).toEqual(
      expect.arrayContaining([
        { applicationId: "application-1", token: "token-1" },
        { applicationId: "application-1", token: "token-2" },
      ]),
    );
  });
});
