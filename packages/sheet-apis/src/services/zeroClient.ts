import { Zero } from "@rocicorp/zero";
import { readFile } from "node:fs/promises";
import { Effect, Layer, Match, pipe } from "effect";
import { type Schema, schema, mutators } from "sheet-db-schema/zero";
import { ZeroClient as BaseZeroClient } from "typhoon-zero/client";
import { config } from "@/config";

const getAuth = Effect.fn("zero.getAuth")(function* () {
  return yield* Effect.promise(() => readFile("/var/run/secrets/tokens/zero-cache-token", "utf-8"));
});

const makeZero = Effect.fn("zero.makeZero")(function* () {
  const auth = yield* getAuth();
  const zeroCacheServer = yield* config.zeroCacheServer;
  const zeroCacheUserId = yield* config.zeroCacheUserId;
  const context = yield* Effect.context();
  const zero = new Zero({
    server: zeroCacheServer,
    userID: zeroCacheUserId,
    auth,
    schema,
    mutators,
  });

  yield* Effect.acquireRelease(
    Effect.sync(() =>
      zero.connection.state.subscribe((state) =>
        pipe(
          Match.value(state),
          Match.when({ name: "needs-auth" }, () =>
            pipe(
              getAuth(),
              Effect.flatMap((auth) => Effect.tryPromise(() => zero.connection.connect({ auth }))),
            ),
          ),
          Match.orElse(() => Effect.void),
          Effect.provideContext(context),
          Effect.runFork,
        ),
      ),
    ),
    (unsubscribe) => Effect.sync(unsubscribe),
  );

  return zero;
});

export class ZeroClient extends BaseZeroClient.ZeroClient<Schema, undefined, unknown>() {
  static layer = Layer.effect(
    ZeroClient,
    Effect.gen({ self: this }, function* () {
      const zero = yield* makeZero();
      return yield* this.make(zero);
    }),
  );
}
