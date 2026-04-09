import { useAtomSuspense } from "@effect/atom-react";
import { Atom, AsyncResult } from "effect/unstable/reactivity";
import { SheetApisClient } from "#/lib/sheetApis";
import { Duration, Effect, Schema } from "effect";
import {
  ArgumentError,
  QueryResultAppError,
  QueryResultParseError,
  SchemaError,
} from "typhoon-core/error";
import { Discord } from "sheet-apis/schema";
import { RequestError } from "#/lib/error";

export const _currentUserAtom = SheetApisClient.query("discord", "getCurrentUser", {});

const DiscordRequestErrorSchema = Schema.revealCodec(
  Schema.Union([
    SchemaError,
    QueryResultAppError,
    QueryResultParseError,
    ArgumentError,
    RequestError,
  ]),
);

const CurrentUserAsyncResultSchema = Schema.revealCodec(
  AsyncResult.Schema({
    success: Discord.DiscordUser,
    error: DiscordRequestErrorSchema,
  }),
);

const CurrentUserGuildsAsyncResultSchema = Schema.revealCodec(
  AsyncResult.Schema({
    success: Schema.Array(Discord.DiscordGuild),
    error: DiscordRequestErrorSchema,
  }),
);

export const currentUserAtom = Atom.make(
  Effect.fnUntraced(function* (get) {
    return yield* get.result(_currentUserAtom).pipe(
      Effect.catchTags({
        BadRequest: () => Effect.fail(RequestError.makeUnsafe({})),
      }),
    );
  }),
).pipe(
  Atom.setIdleTTL(Duration.infinity),
  Atom.serializable({
    key: "discord.getCurrentUser",
    schema: CurrentUserAsyncResultSchema,
  }),
);

export const useCurrentUser = () => {
  const result = useAtomSuspense(currentUserAtom, {
    suspendOnWaiting: false,
    includeFailure: false,
  });

  return result.value;
};

export const _currentUserGuildsAtom = SheetApisClient.query("discord", "getCurrentUserGuilds", {});

export const currentUserGuildsAtom = Atom.make(
  Effect.fnUntraced(function* (get) {
    return yield* get.result(_currentUserGuildsAtom).pipe(
      Effect.catchTags({
        BadRequest: () => Effect.fail(RequestError.makeUnsafe({})),
      }),
    );
  }),
).pipe(
  Atom.setIdleTTL(Duration.infinity),
  Atom.serializable({
    key: "discord.getCurrentUserGuilds",
    schema: CurrentUserGuildsAsyncResultSchema,
  }),
);

export const useCurrentUserGuilds = () => {
  const result = useAtomSuspense(currentUserGuildsAtom, {
    suspendOnWaiting: false,
    includeFailure: false,
  });

  return result.value;
};
