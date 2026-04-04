import { useAtomSuspense } from "@effect/atom-react";
import { Atom, AsyncResult } from "effect/unstable/reactivity";
import { Sheet, Google, SheetConfig } from "sheet-apis/schema";
import { SheetApisClient } from "#/lib/sheetApis";
import { Effect, Schema } from "effect";
import {
  catchSchemaErrorAsValidationError,
  QueryResultAppError,
  QueryResultParseError,
  ValidationError,
} from "typhoon-core/error";
import { RequestError } from "#/lib/error";
import { useMemo } from "react";

// Private atom for fetching event config (includes startTime)
const _eventConfigAtom = Atom.family((guildId: string) =>
  SheetApisClient.query("sheet", "getEventConfig", { query: { guildId } }),
);

type EventConfig = Schema.Schema.Type<typeof SheetConfig.EventConfig>;
type EventConfigError =
  | ValidationError
  | QueryResultAppError
  | QueryResultParseError
  | Google.GoogleSheetsError
  | Sheet.ParserFieldError
  | SheetConfig.SheetConfigError
  | RequestError;

const EventConfigErrorSchema: Schema.Codec<EventConfigError, any> = Schema.revealCodec(
  Schema.Union([
    ValidationError,
    QueryResultAppError,
    QueryResultParseError,
    Google.GoogleSheetsError,
    Sheet.ParserFieldError,
    SheetConfig.SheetConfigError,
    RequestError,
  ]),
);

const EventConfigAsyncResultSchema: Schema.Codec<
  AsyncResult.AsyncResult<EventConfig, EventConfigError>,
  any
> = Schema.revealCodec(
  AsyncResult.Schema({
    success: SheetConfig.EventConfig,
    error: EventConfigErrorSchema,
  }),
);

// Serializable atom for event config
export const eventConfigAtom = Atom.family((guildId: string) =>
  Atom.make(
    Effect.fnUntraced(function* (get) {
      return yield* get.result(_eventConfigAtom(guildId)).pipe(
        catchSchemaErrorAsValidationError,
        Effect.catchTags({
          BadRequest: () => Effect.fail(RequestError.makeUnsafe({})),
        }),
      );
    }),
  ).pipe(
    Atom.serializable({
      key: `sheet.getEventConfig.${guildId}`,
      schema: EventConfigAsyncResultSchema,
    }),
  ),
);

// Hook to use event config (includes startTime)
export const useEventConfig = (guildId: string) => {
  const atom = useMemo(() => eventConfigAtom(guildId), [guildId]);
  const result = useAtomSuspense(atom, {
    suspendOnWaiting: false,
    includeFailure: false,
  });
  return result.value;
};
