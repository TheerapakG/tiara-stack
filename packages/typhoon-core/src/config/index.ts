import { ConfigProvider, Effect, FileSystem, Layer } from "effect";

export const dotEnvConfigProviderLayer = (path = ".env") =>
  Layer.unwrap(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;

      return yield* fs.readFileString(path).pipe(
        Effect.map((content) =>
          ConfigProvider.layerAdd(ConfigProvider.fromDotEnvContents(content)).pipe(
            Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv())),
          ),
        ),
        Effect.catch((error) =>
          Effect.logWarning(
            `Could not read ${path} file, falling back to environment variables`,
            error,
          ).pipe(Effect.as(ConfigProvider.layer(ConfigProvider.fromEnv()))),
        ),
      );
    }),
  );
