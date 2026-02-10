import { Zero } from "@rocicorp/zero";
import { Effect, Match, pipe, Layer, Runtime } from "effect";
import { FileSystem } from "@effect/platform";
import { type Schema, schema, mutators } from "sheet-db-schema/zero";
import { ZeroService as BaseZeroService } from "typhoon-core/services";
import { config } from "@/config";

const getAuth = () =>
  pipe(
    FileSystem.FileSystem,
    Effect.andThen((fs) => fs.readFileString("/var/run/secrets/tokens/zero-cache-token", "utf-8")),
  );

const makeZero = () =>
  pipe(
    Effect.all({
      auth: getAuth(),
      zeroCacheServer: config.zeroCacheServer,
      zeroCacheUserId: config.zeroCacheUserId,
    }),
    Effect.bindAll(({ auth, zeroCacheServer, zeroCacheUserId }) => ({
      zero: Effect.succeed(
        new Zero({
          server: zeroCacheServer,
          userID: zeroCacheUserId,
          auth,
          schema,
          mutators,
        }),
      ),
      runtime: Effect.runtime<FileSystem.FileSystem>(),
    })),
    Effect.tap(({ zero, runtime }) =>
      pipe(
        Effect.succeed(
          zero.connection.state.subscribe((state) =>
            pipe(
              Match.value(state),
              Match.when({ name: "needs-auth" }, () =>
                pipe(
                  getAuth(),
                  Effect.flatMap((auth) =>
                    Effect.tryPromise(() => zero.connection.connect({ auth })),
                  ),
                ),
              ),
              Match.orElse(() => Effect.void),
              Runtime.runFork(runtime),
            ),
          ),
        ),
        Effect.acquireRelease((unsubscribe) => Effect.sync(unsubscribe)),
      ),
    ),
    Effect.map(({ zero }) => zero),
  );

export const ZeroTag = BaseZeroService.ZeroService<Schema, undefined, {}>();
export const ZeroLive = pipe(makeZero(), Effect.andThen(BaseZeroService.make), Layer.scopedContext);
