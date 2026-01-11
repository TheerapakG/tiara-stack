import { Config } from "../config";
import { Effect, pipe, Layer } from "effect";
import { FileSystem } from "@effect/platform";
import { Schema, schema } from "sheet-db-schema/zero";
import { ZeroService as BaseZeroService } from "typhoon-core/services";
import { Zero } from "@rocicorp/zero";

export const ZeroServiceTag = BaseZeroService.ZeroService<Schema, undefined>();
export const ZeroServiceLayer = pipe(
  Config.use((config) =>
    pipe(
      FileSystem.FileSystem,
      Effect.andThen((fs) =>
        BaseZeroService.make(
          new Zero({
            server: config.zeroCacheServer,
            userID: config.zeroCacheUserId,
            auth: () =>
              Effect.runPromise(
                pipe(
                  fs.readFileString("/var/run/secrets/tokens/zero-cache-token", "utf-8"),
                  Effect.tap(() => Effect.log("zero user id", config.zeroCacheUserId)),
                  Effect.tap((v) => Effect.log("zero token", v)),
                ),
              ),
            schema: schema,
          }),
        ),
      ),
    ),
  ),
  Layer.effectContext,
);
