import { Context, Effect, Layer, pipe } from "effect";
import { createStorage, prefixStorage, type Storage } from "unstorage";
import { default as memoryDriver } from "unstorage/drivers/memory";
import { default as redisDriver, RedisOptions } from "unstorage/drivers/redis";

export class Unstorage extends Context.Tag("Unstorage")<Unstorage, Storage>() {
  static RedisLive = (opts: RedisOptions) =>
    Layer.succeed(Unstorage, createStorage({ driver: redisDriver(opts) }));

  static MemoryLive = Layer.succeed(Unstorage, createStorage({ driver: memoryDriver() }));

  static prefixed = (prefix: string) =>
    pipe(
      Unstorage,
      Effect.andThen((storage) => prefixStorage(storage, prefix)),
    );

  static PrefixedLive = (prefix: string) =>
    Layer.effectContext(
      pipe(
        Unstorage.prefixed(prefix),
        Effect.andThen((storage) => Context.make(Unstorage, storage)),
      ),
    );
}

export const RedisUnstorageLive = (opts: RedisOptions): Layer.Layer<Unstorage> =>
  Unstorage.RedisLive(opts);

export const PrefixedUnstorageLive = (prefix: string): Layer.Layer<Unstorage, never, Unstorage> =>
  Unstorage.PrefixedLive(prefix);
