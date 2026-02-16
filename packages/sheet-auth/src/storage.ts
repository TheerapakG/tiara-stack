import type { StorageAdapter } from "@openauthjs/openauth/storage/storage";
import { createStorage, type Storage as Unstorage } from "unstorage";
import redisDriver from "unstorage/drivers/redis";

export function createRedisStorage(redisUrl: string): StorageAdapter {
  const storage: Unstorage = createStorage({
    driver: redisDriver({
      url: redisUrl,
    }),
  });

  const SEPARATOR = ":";

  function joinKey(key: string[]): string {
    return key.join(SEPARATOR);
  }

  function splitKey(key: string): string[] {
    return key.split(SEPARATOR);
  }

  return {
    async get(key: string[]) {
      const value = await storage.getItem<Record<string, any>>(joinKey(key));
      return value ?? undefined;
    },

    async remove(key: string[]) {
      await storage.removeItem(joinKey(key));
    },

    async set(key: string[], value: any, expiry?: Date) {
      const ttl = expiry
        ? Math.max(0, Math.floor((expiry.getTime() - Date.now()) / 1000))
        : undefined;

      if (ttl !== undefined && ttl <= 0) {
        await storage.removeItem(joinKey(key));
        return;
      }

      await storage.setItem(joinKey(key), value, ttl ? { ttl } : undefined);
    },

    async *scan(prefix: string[]) {
      const keys = await storage.getKeys(joinKey(prefix));

      for (const key of keys) {
        const value = await storage.getItem<any>(key);
        if (value !== null) {
          yield [splitKey(key), value];
        }
      }
    },
  };
}

export type { StorageAdapter };
