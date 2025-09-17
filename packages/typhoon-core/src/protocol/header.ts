import { Array, Chunk, Data, Effect, Match, pipe, Stream } from "effect";
import * as v from "valibot";
import { validate } from "../validator/validate";
import { ValidationError } from "../validator/validator";

export type * from "../validator/validator";

const headerActionFields = [
  "client:subscribe",
  "client:unsubscribe",
  "client:once",
  "client:mutate",
  "server:update",
] as const;

export class InvalidHeaderError extends Data.TaggedError(
  "InvalidHeaderError",
) {}

export class InvalidHeaderFieldError extends Data.TaggedError(
  "InvalidHeaderFieldError",
)<{
  field: string | number;
}> {}

class HeaderActionField {
  static encode(input: (typeof headerActionFields)[number]) {
    return pipe(
      Array.findFirstIndex(headerActionFields, (field) => field === input),
      Effect.mapError(() => new InvalidHeaderFieldError({ field: input })),
    );
  }

  static decode(input: number) {
    return pipe(
      Array.get(headerActionFields, input),
      Effect.mapError(() => new InvalidHeaderFieldError({ field: input })),
    );
  }
}

type EncodingTable<
  RequiredField extends string,
  DT extends DecodingTable<string>,
> = {
  [key in keyof InferDecoded<RequiredField, DT>]: (
    value: InferDecoded<RequiredField, DT>[key],
  ) => Effect.Effect<unknown, ValidationError | InvalidHeaderFieldError, never>;
};

type DecodingTable<Field extends string> = {
  [key in Field]: (
    value: unknown,
  ) => Effect.Effect<unknown, ValidationError | InvalidHeaderFieldError, never>;
};

type InferAllDecoded<DT extends DecodingTable<string>> = {
  [key in keyof DT]: Effect.Effect.Success<ReturnType<DT[key]>>;
};

type InferDecoded<
  RequiredField extends string,
  DT extends DecodingTable<string>,
> = Partial<Omit<InferAllDecoded<DT>, RequiredField>> &
  Required<Pick<InferAllDecoded<DT>, RequiredField>>;

class LookupEncoderDecoder<
  Field extends string,
  RequiredField extends Field,
  DT extends DecodingTable<Field>,
  ET extends EncodingTable<RequiredField, DT>,
  InferredField extends keyof InferDecoded<RequiredField, DT> &
    Field = keyof InferDecoded<RequiredField, DT> & Field,
> {
  constructor(
    private readonly name: string,
    private readonly fields: Field[],
    private readonly requiredFields: RequiredField[],
    private readonly decodingTable: DT,
    private readonly encodingTable: ET,
  ) {}

  encode(input: InferDecoded<RequiredField, DT>) {
    return pipe(
      Stream.Do,
      Stream.bind(
        "entries",
        () =>
          Stream.fromIterable(
            Object.entries(input) as [
              InferredField,
              InferDecoded<RequiredField, DT>[InferredField],
            ][],
          ),
        { concurrency: "unbounded" },
      ),
      Stream.let("fieldIndex", ({ entries: [field, _value] }) =>
        this.fields.indexOf(field),
      ),
      Stream.let(
        "fieldEncoder",
        ({ entries: [field, _value] }) => this.encodingTable[field],
      ),
      Stream.bind(
        "fieldEncodedValue",
        ({ fieldEncoder, entries: [_field, value] }) =>
          pipe(
            fieldEncoder(value) as Effect.Effect<
              unknown,
              ValidationError | InvalidHeaderFieldError,
              never
            >,
            Stream.fromEffect,
          ),
        { concurrency: "unbounded" },
      ),
      Stream.map(
        ({ fieldIndex, fieldEncodedValue }) =>
          [fieldIndex, fieldEncodedValue] as [number, unknown],
      ),
      Stream.runCollect,
      Effect.map(Chunk.toArray),
      Effect.withSpan(`${this.name}.encode`, {
        captureStackTrace: true,
      }),
    );
  }

  decode(input: [number, unknown][]) {
    // TODO: check if required fields are present
    return pipe(
      Stream.Do,
      Stream.bind("entries", () => Stream.fromIterable(input), {
        concurrency: "unbounded",
      }),
      Stream.bind(
        "field",
        ({ entries: [fieldIndex, _fieldValue] }) =>
          pipe(
            Array.get(this.fields, fieldIndex),
            Effect.mapError(
              () => new InvalidHeaderFieldError({ field: fieldIndex }),
            ),
            Stream.fromEffect,
          ),
        { concurrency: "unbounded" },
      ),
      Stream.let("fieldDecoder", ({ field }) => this.decodingTable[field]),
      Stream.bind(
        "fieldValue",
        ({ fieldDecoder, entries: [_fieldIndex, fieldValue] }) =>
          pipe(
            fieldDecoder(fieldValue) as Effect.Effect<
              unknown,
              ValidationError | InvalidHeaderFieldError,
              never
            >,
            Stream.fromEffect,
          ),
        { concurrency: "unbounded" },
      ),
      Stream.runFold({}, (acc, { field, fieldValue }) => ({
        ...acc,
        [field]: fieldValue,
      })),
      Effect.map((acc) => acc as InferDecoded<RequiredField, DT>),
      Effect.withSpan(`${this.name}.decode`, {
        captureStackTrace: true,
      }),
    );
  }

  decodeUnknown(input: unknown) {
    return pipe(
      input,
      validate(v.array(v.tuple([v.number(), v.unknown()]))),
      Effect.flatMap((input) => this.decode(input)),
      Effect.catchAll(() => Effect.fail(new InvalidHeaderError())),
      Effect.withSpan(`${this.name}.decodeUnknown`, {
        captureStackTrace: true,
      }),
    );
  }

  decodeUnknownEffect<E = never, R = never>(
    input: Effect.Effect<unknown, E, R>,
  ) {
    return pipe(
      input,
      Effect.flatMap(this.decodeUnknown),
      Effect.catchAll(() => Effect.fail(new InvalidHeaderError())),
      Effect.withSpan(`${this.name}.decodeUnknownEffect`, {
        captureStackTrace: true,
      }),
    );
  }
}

const emptyPayloadEncoderDecoder = new LookupEncoderDecoder(
  "emptyPayloadEncoderDecoder",
  [],
  [],
  {},
  {},
);

const handlerPayloadEncoderDecoder = new LookupEncoderDecoder(
  "handlerPayloadEncoderDecoder",
  ["handler", "token"],
  ["handler", "token"],
  {
    handler: validate(v.string()),
    token: validate(v.optional(v.string())),
  },
  {
    handler: validate(v.string()),
    token: validate(v.optional(v.string())),
  },
);

const successTimestampPayloadEncoderDecoder = new LookupEncoderDecoder(
  "successTimestampPayloadEncoderDecoder",
  ["success", "timestamp"],
  ["success", "timestamp"],
  {
    success: validate(v.boolean()),
    timestamp: validate(v.date()),
  },
  {
    success: validate(v.boolean()),
    timestamp: validate(v.date()),
  },
);

const baseHeaderEncoderDecoder = new LookupEncoderDecoder(
  "baseHeaderEncoderDecoder",
  ["protocol", "version", "id", "action", "payload"],
  ["protocol", "version", "id", "action", "payload"],
  {
    protocol: validate(v.string()),
    version: validate(v.number()),
    id: validate(
      v.pipe(
        v.instance(Uint8Array),
        v.transform((value) => Array.fromIterable(value)),
        v.length(16),
        v.transform((value) =>
          value.map((v) => v.toString(16).padStart(2, "0")),
        ),
        v.transform(
          (value) =>
            `${value.slice(0, 4).join("")}-${value.slice(4, 6).join("")}-${value.slice(6, 8).join("")}-${value.slice(8, 10).join("")}-${value.slice(10).join("")}`,
        ),
      ),
    ),
    action: (value) =>
      pipe(
        value,
        validate(v.number()),
        Effect.flatMap((value) => HeaderActionField.decode(value)),
      ),
    payload: validate(v.array(v.tuple([v.number(), v.unknown()]))),
  },
  {
    protocol: validate(v.string()),
    version: validate(v.number()),
    id: (value) =>
      pipe(
        value,
        validate(
          v.pipe(
            v.string(),
            v.transform((value) => value.replace(/-/g, "")),
            v.length(32),
          ),
        ),
        Stream.fromIterableEffect,
        Stream.grouped(2),
        Stream.map(Chunk.join("")),
        Stream.map((value) => parseInt(value, 16)),
        Stream.runCollect,
        Effect.map((chunk) => new Uint8Array(chunk)),
      ),
    action: (value) =>
      pipe(
        value,
        validate(v.union(headerActionFields.map((field) => v.literal(field)))),
        Effect.flatMap((value) => HeaderActionField.encode(value)),
      ),
    payload: validate(v.array(v.tuple([v.number(), v.unknown()]))),
  },
);

const payloadDecoder = <Action extends (typeof headerActionFields)[number]>({
  action,
  payload,
}: {
  action: Action;
  payload: [number, unknown][];
}): Effect.Effect<
  Action extends "client:subscribe" | "client:once" | "client:mutate"
    ? Effect.Effect.Success<
        ReturnType<(typeof handlerPayloadEncoderDecoder)["decode"]>
      >
    : Action extends "server:update"
      ? Effect.Effect.Success<
          ReturnType<(typeof successTimestampPayloadEncoderDecoder)["decode"]>
        >
      : Action extends "client:unsubscribe"
        ? Effect.Effect.Success<
            ReturnType<(typeof emptyPayloadEncoderDecoder)["decode"]>
          >
        : never,
  ValidationError | InvalidHeaderFieldError,
  never
> =>
  pipe(
    Effect.Do,
    Effect.let("action", () => action),
    Effect.bind("payload", () =>
      validate(v.array(v.tuple([v.number(), v.unknown()])))(payload),
    ),
    Effect.flatMap(({ action, payload }) =>
      pipe(
        Match.value(action as (typeof headerActionFields)[number]),
        Match.whenOr("client:subscribe", "client:once", "client:mutate", () =>
          handlerPayloadEncoderDecoder.decode(payload),
        ),
        Match.when("server:update", () =>
          successTimestampPayloadEncoderDecoder.decode(payload),
        ),
        Match.when("client:unsubscribe", () =>
          emptyPayloadEncoderDecoder.decode(payload),
        ),
        Match.exhaustive,
      ),
    ),
  ) as Effect.Effect<
    Action extends "client:subscribe" | "client:once" | "client:mutate"
      ? Effect.Effect.Success<
          ReturnType<(typeof handlerPayloadEncoderDecoder)["decode"]>
        >
      : Action extends "server:update"
        ? Effect.Effect.Success<
            ReturnType<(typeof successTimestampPayloadEncoderDecoder)["decode"]>
          >
        : Action extends "client:unsubscribe"
          ? Effect.Effect.Success<
              ReturnType<(typeof emptyPayloadEncoderDecoder)["decode"]>
            >
          : never,
    ValidationError | InvalidHeaderFieldError,
    never
  >;

const payloadEncoder = <
  Action extends
    (typeof headerActionFields)[number] = (typeof headerActionFields)[number],
>({
  action,
  payload,
}: {
  action: Action;
  payload: Effect.Effect.Success<ReturnType<typeof payloadDecoder<Action>>>;
}) =>
  pipe(
    Effect.Do,
    Effect.let("action", () => action),
    Effect.let("payload", () => payload),
    Effect.flatMap(({ action, payload }) =>
      pipe(
        Match.value(action as (typeof headerActionFields)[number]),
        Match.whenOr("client:subscribe", "client:once", "client:mutate", () =>
          handlerPayloadEncoderDecoder.encode(
            payload as Effect.Effect.Success<
              ReturnType<
                typeof payloadDecoder<
                  "client:subscribe" | "client:once" | "client:mutate"
                >
              >
            >,
          ),
        ),
        Match.when("server:update", () =>
          successTimestampPayloadEncoderDecoder.encode(
            payload as Effect.Effect.Success<
              ReturnType<typeof payloadDecoder<"server:update">>
            >,
          ),
        ),
        Match.when("client:unsubscribe", () =>
          emptyPayloadEncoderDecoder.encode(
            payload as Effect.Effect.Success<
              ReturnType<typeof payloadDecoder<"client:unsubscribe">>
            >,
          ),
        ),
        Match.exhaustive,
      ),
    ),
  );

type InternalHeader<
  Action extends
    (typeof headerActionFields)[number] = (typeof headerActionFields)[number],
> = Omit<
  Effect.Effect.Success<ReturnType<typeof baseHeaderEncoderDecoder.decode>>,
  "action" | "payload"
> & {
  action: Action;
  payload: Effect.Effect.Success<ReturnType<typeof payloadDecoder<Action>>>;
};

export type Header<
  Action extends
    (typeof headerActionFields)[number] = (typeof headerActionFields)[number],
> = Action extends infer A
  ? A extends (typeof headerActionFields)[number]
    ? InternalHeader<A>
    : never
  : never;

export class HeaderEncoderDecoder {
  static encode(input: Header) {
    return pipe(
      Effect.Do,
      Effect.bind("encodedPayload", () => payloadEncoder(input)),
      Effect.flatMap(({ encodedPayload }) =>
        baseHeaderEncoderDecoder.encode({
          ...input,
          payload: encodedPayload,
        }),
      ),
      Effect.withSpan("HeaderEncoderDecoder.encode", {
        captureStackTrace: true,
      }),
    );
  }

  static decode(input: [number, unknown][]) {
    return pipe(
      Effect.Do,
      Effect.bind("decodedBaseHeader", () =>
        baseHeaderEncoderDecoder.decode(input),
      ),
      Effect.bind(
        "decodedPayload",
        ({ decodedBaseHeader: { action, payload } }) =>
          payloadDecoder({
            action,
            payload,
          }),
      ),
      Effect.map(
        ({ decodedBaseHeader, decodedPayload }) =>
          ({
            ...decodedBaseHeader,
            payload: decodedPayload,
          }) as Header,
      ),
      Effect.withSpan("HeaderEncoderDecoder.decode", {
        captureStackTrace: true,
      }),
    );
  }

  static decodeUnknown(input: unknown) {
    return pipe(
      input,
      validate(v.array(v.tuple([v.number(), v.unknown()]))),
      Effect.flatMap(HeaderEncoderDecoder.decode),
      Effect.catchAll(() => Effect.fail(new InvalidHeaderError())),
      Effect.withSpan("HeaderEncoderDecoder.decodeUnknown", {
        captureStackTrace: true,
      }),
    );
  }

  static decodeUnknownEffect<E = never, R = never>(
    input: Effect.Effect<unknown, E, R>,
  ) {
    return pipe(
      input,
      Effect.flatMap(HeaderEncoderDecoder.decodeUnknown),
      Effect.catchAll(() => Effect.fail(new InvalidHeaderError())),
      Effect.withSpan("HeaderEncoderDecoder.decodeUnknownEffect", {
        captureStackTrace: true,
      }),
    );
  }
}
