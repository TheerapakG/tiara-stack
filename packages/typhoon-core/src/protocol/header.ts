import { type } from "arktype";
import { Array, Cause, Chunk, Effect, pipe, Stream } from "effect";
import { validate, ValidationError } from "../schema/validate";

const headerFields = [
  "protocol",
  "version",
  "id",
  "action",
  "handler",
] as const;

const headerActionFields = [
  "client:subscribe",
  "client:unsubscribe",
  "client:once",
  "client:mutate",
  "server:update",
] as const;

class HeaderActionField {
  static encode(input: (typeof headerActionFields)[number]) {
    return Effect.succeed(headerActionFields.indexOf(input));
  }

  static decode(input: number) {
    return Array.get(headerActionFields, input);
  }
}

const headerFieldDecoderMap = {
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
  action: (value: unknown) =>
    pipe(
      value,
      validate(type("number")),
      Effect.flatMap((value) => HeaderActionField.decode(value)),
    ),
  handler: validate(type("string")),
} satisfies Record<
  (typeof headerFields)[number],
  (
    value: unknown,
  ) => Effect.Effect<
    unknown,
    ValidationError | Cause.NoSuchElementException,
    never
  >
>;

export type HeaderObject = {
  [key in (typeof headerFields)[number]]: Effect.Effect.Success<
    ReturnType<(typeof headerFieldDecoderMap)[key]>
  >;
};

const headerFieldEncoderMap = {
  protocol: validate(type("string")),
  version: validate(type("number")),
  id: (value: unknown) =>
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
  action: (value: unknown) =>
    pipe(
      value,
      validate(type.enumerated(...headerActionFields)),
      Effect.flatMap((value) => HeaderActionField.encode(value)),
    ),
  handler: validate(type("string")),
} satisfies Record<
  (typeof headerFields)[number],
  (
    value: unknown,
  ) => Effect.Effect<
    unknown,
    ValidationError | Cause.NoSuchElementException,
    never
  >
>;

export class Header {
  static encode(input: HeaderObject) {
    return Effect.forEach(
      Object.entries(input) as [(typeof headerFields)[number], unknown][],
      ([headerField, headerFieldValue]) =>
        pipe(
          Effect.Do,
          Effect.let(
            "headerFieldEncoder",
            () => headerFieldEncoderMap[headerField],
          ),
          Effect.bind(
            "headerFieldEncodedValue",
            ({ headerFieldEncoder }) =>
              headerFieldEncoder(headerFieldValue) as Effect.Effect<
                unknown,
                ValidationError,
                never
              >,
          ),
          Effect.map(({ headerFieldEncodedValue }) => [
            headerFields.indexOf(headerField),
            headerFieldEncodedValue,
          ]),
        ),
    );
  }

  static decode(input: [number, unknown][]) {
    // TODO: verify that all header fields are present
    return pipe(
      input,
      Effect.forEach(([headerFieldIndex, headerFieldValue]) =>
        pipe(
          Effect.Do,
          Effect.bind("headerField", () =>
            Array.get(headerFields, headerFieldIndex),
          ),
          Effect.let(
            "headerFieldDecoder",
            ({ headerField }) => headerFieldDecoderMap[headerField],
          ),
          Effect.bind(
            "headerFieldValue",
            ({ headerFieldDecoder }) =>
              headerFieldDecoder(headerFieldValue) as Effect.Effect<
                unknown,
                ValidationError,
                never
              >,
          ),
          Effect.map(
            ({ headerField, headerFieldValue }) =>
              [headerField, headerFieldValue] as const,
          ),
        ),
      ),
      Effect.map((acc) => Object.fromEntries(acc) as HeaderObject),
    );
  }
}
