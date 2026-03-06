import { Atom, useAtomSuspense, Result } from "@effect-atom/atom-react";
import { SheetApisClient } from "#/lib/sheetApis";
import { Duration, Effect, Schema } from "effect";
import {
  ArgumentError,
  catchParseErrorAsValidationError,
  QueryResultError,
  ValidationError,
} from "typhoon-core/error";
import { Discord, Middlewares } from "sheet-apis/schema";
import { RequestError, ResponseError } from "#/lib/error";

export const _currentUserAtom = SheetApisClient.query("discord", "getCurrentUser", {});

export const currentUserAtom = Atom.make(
  Effect.fnUntraced(function* (get) {
    return yield* get.result(_currentUserAtom).pipe(
      catchParseErrorAsValidationError,
      Effect.catchTags({
        RequestError: (error) => Effect.fail(RequestError.make(error)),
        ResponseError: (error) => Effect.fail(ResponseError.make(error)),
      }),
    );
  }),
).pipe(
  Atom.setIdleTTL(Duration.infinity),
  Atom.serializable({
    key: "discord.getCurrentUser",
    schema: Result.Schema({
      success: Discord.DiscordUser,
      error: Schema.Union(
        ValidationError,
        QueryResultError,
        ArgumentError,
        Middlewares.Unauthorized,
        RequestError,
        ResponseError,
      ),
    }),
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
      catchParseErrorAsValidationError,
      Effect.catchTags({
        RequestError: (error) => Effect.fail(RequestError.make(error)),
        ResponseError: (error) => Effect.fail(ResponseError.make(error)),
      }),
    );
  }),
).pipe(
  Atom.setIdleTTL(Duration.infinity),
  Atom.serializable({
    key: "discord.getCurrentUserGuilds",
    schema: Result.Schema({
      success: Schema.Array(Discord.DiscordGuild),
      error: Schema.Union(
        ValidationError,
        QueryResultError,
        ArgumentError,
        Middlewares.Unauthorized,
        RequestError,
        ResponseError,
      ),
    }),
  }),
);

export const useCurrentUserGuilds = () => {
  const result = useAtomSuspense(currentUserGuildsAtom, {
    suspendOnWaiting: false,
    includeFailure: false,
  });

  return result.value;
};
