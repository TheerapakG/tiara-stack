import { match, type } from "arktype";
import { Array, Chunk, Data, Effect, pipe, Stream } from "effect";
import { validate, ValidationError } from "../schema/validate";

const headerActionFields = [
  "client:subscribe",
  "client:unsubscribe",
  "client:once",
  "client:mutate",
  "server:update",
] as const;

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
  ["handler"],
  ["handler"],
  {
    handler: validate(type("string")),
  },
  {
    handler: validate(type("string")),
  },
);

const successNoncePayloadEncoderDecoder = new LookupEncoderDecoder(
  "successNoncePayloadEncoderDecoder",
  ["success", "nonce"],
  ["success", "nonce"],
  {
    success: validate(type("boolean")),
    nonce: validate(type("number")),
  },
  {
    success: validate(type("boolean")),
    nonce: validate(type("number")),
  },
);

const baseHeaderEncoderDecoder = new LookupEncoderDecoder(
  "baseHeaderEncoderDecoder",
  ["protocol", "version", "id", "action", "payload"],
  ["protocol", "version", "id", "action", "payload"],
  {
    protocol: validate(type("string")),
    version: validate(type("number")),
    id: validate(
      type("TypedArray.Uint8")
        .pipe((value) => Array.fromIterable(value))
        .to("16 <= number[] <= 16")
        .pipe((value) => value.map((v) => v.toString(16).padStart(2, "0")))
        .pipe(
          (value) =>
            `${value.slice(0, 4).join("")}-${value.slice(4, 6).join("")}-${value.slice(6, 8).join("")}-${value.slice(8, 10).join("")}-${value.slice(10).join("")}`,
        ),
    ),
    action: (value) =>
      pipe(
        value,
        validate(type("number")),
        Effect.flatMap((value) => HeaderActionField.decode(value)),
      ),
    payload: validate(type([["number", "unknown"], "[]"])),
  },
  {
    protocol: validate(type("string")),
    version: validate(type("number")),
    id: (value) =>
      pipe(
        value,
        validate(
          type("string")
            .pipe((value) => value.replace(/-/g, ""))
            .to("32 <= string <= 32"),
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
        validate(type.enumerated(...headerActionFields)),
        Effect.flatMap((value) => HeaderActionField.encode(value)),
      ),
    payload: validate(type([["number", "unknown"], "[]"])),
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
          ReturnType<(typeof successNoncePayloadEncoderDecoder)["decode"]>
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
      validate(type([["number", "unknown"], "[]"]))(payload),
    ),
    Effect.flatMap(({ action, payload }) =>
      match({})
        .case("'client:subscribe' | 'client:once' | 'client:mutate'", () =>
          handlerPayloadEncoderDecoder.decode(payload),
        )
        .case("'server:update'", () =>
          successNoncePayloadEncoderDecoder.decode(payload),
        )
        .case("'client:unsubscribe'", () =>
          emptyPayloadEncoderDecoder.decode(payload),
        )
        .default("never")(action),
    ),
  ) as Effect.Effect<
    Action extends "client:subscribe" | "client:once" | "client:mutate"
      ? Effect.Effect.Success<
          ReturnType<(typeof handlerPayloadEncoderDecoder)["decode"]>
        >
      : Action extends "server:update"
        ? Effect.Effect.Success<
            ReturnType<(typeof successNoncePayloadEncoderDecoder)["decode"]>
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
      match({})
        .case("'client:subscribe' | 'client:once' | 'client:mutate'", () =>
          handlerPayloadEncoderDecoder.encode(
            payload as Effect.Effect.Success<
              ReturnType<
                typeof payloadDecoder<
                  "client:subscribe" | "client:once" | "client:mutate"
                >
              >
            >,
          ),
        )
        .case("'server:update'", () =>
          successNoncePayloadEncoderDecoder.encode(
            payload as Effect.Effect.Success<
              ReturnType<typeof payloadDecoder<"server:update">>
            >,
          ),
        )
        .case("'client:unsubscribe'", () =>
          emptyPayloadEncoderDecoder.encode(
            payload as Effect.Effect.Success<
              ReturnType<typeof payloadDecoder<"client:unsubscribe">>
            >,
          ),
        )
        .default("never")(action),
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
}
