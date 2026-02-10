import { Schema } from "effect";

export const config = {
  zeroCacheServer: Schema.Config("ZERO_CACHE_SERVER", Schema.String),
  zeroCacheUserId: Schema.Config("ZERO_CACHE_USER_ID", Schema.String),
};
