import { Effect, Layer, Context } from "effect";
import { createStorage, CreateStorageOptions, prefixStorage, type Storage } from "unstorage";
import { default as memoryDriver } from "unstorage/drivers/memory";
import { default as redisDriver, RedisOptions } from "unstorage/drivers/redis";

export class Unstorage extends Context.Service<Unstorage, Storage>()("Unstorage") {
  static layer = (storage: Storage) => Layer.succeed(Unstorage, storage);

  static createLayer = (opts?: CreateStorageOptions) => Unstorage.layer(createStorage(opts));

  static redisLayer = (opts: RedisOptions) => Unstorage.createLayer({ driver: redisDriver(opts) });

  static memoryLayer = Unstorage.createLayer({ driver: memoryDriver() });

  static prefixed = Effect.fn("Unstorage.prefixed")(function* (prefix: string) {
    const storage = yield* Unstorage;
    return prefixStorage(storage, prefix);
  });

  static prefixedLayer = (prefix: string) =>
    Layer.effectContext(
      Effect.gen(function* () {
        const storage = yield* Unstorage.prefixed(prefix);
        return Context.make(Unstorage, storage);
      }),
    );
}
