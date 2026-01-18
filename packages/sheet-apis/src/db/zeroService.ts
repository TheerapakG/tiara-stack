import { Config } from "../config";
import { Effect, Match, pipe, Layer, Runtime } from "effect";
import { FileSystem } from "@effect/platform";
import { Schema, schema } from "sheet-db-schema/zero";
import { ZeroService as BaseZeroService } from "typhoon-core/services";
import { Zero } from "@rocicorp/zero";

const getAuth = () =>
  pipe(
    FileSystem.FileSystem,
    Effect.andThen((fs) => fs.readFileString("/var/run/secrets/tokens/zero-cache-token", "utf-8")),
  );

const makeZero = (config: Config) =>
  pipe(
    Effect.Do,
    Effect.bind("auth", () => getAuth()),
    Effect.bindAll(({ auth }) => ({
      zero: Effect.succeed(
        new Zero({
          server: config.zeroCacheServer,
          userID: config.zeroCacheUserId,
          auth,
          schema,
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

export const ZeroServiceTag = BaseZeroService.ZeroService<Schema, undefined>();
export const ZeroServiceLayer = pipe(
  Config.use((config) => pipe(makeZero(config), Effect.andThen(BaseZeroService.make))),
  Layer.scopedContext,
);
