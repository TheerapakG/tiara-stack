import { describe, expect, it } from "@effect/vitest";
import { Effect, Predicate, Schema, Scope } from "effect";
import { ArgumentError } from "./argument";
import { SchemaError } from "./schema";

const decodeFailure = <S extends Schema.Top>(schema: S, value: unknown) =>
  Effect.flip(Schema.decodeUnknownEffect(schema)(value));
const isCompositeIssue = Predicate.isTagged("Composite");
const isPointerIssue = Predicate.isTagged("Pointer");
const isFilterIssue = Predicate.isTagged("Filter");

describe("SchemaError", () => {
  it.effect(
    "converts a basic decode failure into a tagged SchemaError",
    Effect.fnUntraced(function* () {
      const error = yield* decodeFailure(Schema.Struct({ a: Schema.String }), { a: 1 });

      expect(error._tag).toBe("SchemaError");
      expect(error.message).toContain("Expected string");
      expect(error.issue._tag).toBe("Composite");

      if (!isCompositeIssue(error.issue)) {
        return;
      }

      const pointerIssue = error.issue.issues[0];
      expect(pointerIssue?._tag).toBe("Pointer");

      if (!isPointerIssue(pointerIssue)) {
        return;
      }

      expect(pointerIssue.path).toEqual(["a"]);
      expect(pointerIssue.issue._tag).toBe("InvalidType");
    }),
  );

  it.effect(
    "captures missing keys as Pointer and MissingKey issues",
    Effect.fnUntraced(function* () {
      const error = yield* decodeFailure(Schema.Struct({ a: Schema.String }), {});

      expect(error.issue._tag).toBe("Composite");

      if (!isCompositeIssue(error.issue)) {
        return;
      }

      const pointerIssue = error.issue.issues[0];
      expect(pointerIssue?._tag).toBe("Pointer");

      if (!isPointerIssue(pointerIssue)) {
        return;
      }

      expect(pointerIssue.path).toEqual(["a"]);
      expect(pointerIssue.issue._tag).toBe("MissingKey");
    }),
  );

  it.effect(
    "captures filter failures as Filter issues with nested InvalidValue issues",
    Effect.fnUntraced(function* () {
      const error = yield* decodeFailure(Schema.NonEmptyString, "");

      expect(error.issue._tag).toBe("Composite");

      if (!isCompositeIssue(error.issue)) {
        return;
      }

      const filterIssue = error.issue.issues[0];
      expect(filterIssue?._tag).toBe("Filter");

      if (!isFilterIssue(filterIssue)) {
        return;
      }

      expect(filterIssue.issue._tag).toBe("InvalidValue");
    }),
  );

  it.effect(
    "captures union failures as AnyOf issues",
    Effect.fnUntraced(function* () {
      const error = yield* decodeFailure(Schema.Union([Schema.String, Schema.Number]), true);

      expect(error.issue._tag).toBe("AnyOf");
    }),
  );

  it.effect(
    "round-trips a converted SchemaError through the local schema",
    Effect.fnUntraced(function* () {
      const converted = yield* decodeFailure(Schema.Struct({ a: Schema.String }), { a: 1 }).pipe(
        Effect.orDie,
      );

      const encoded = yield* Schema.encodeUnknownEffect(SchemaError)(converted).pipe(Effect.orDie);
      const decoded = yield* Schema.decodeUnknownEffect(SchemaError)(encoded).pipe(Effect.orDie);

      expect(decoded).toBeInstanceOf(Schema.SchemaError);
      expect(decoded._tag).toBe(converted._tag);
      expect(decoded.message).toBe(converted.message);
      expect(decoded.issue).toEqual(converted.issue);
    }) as () => Effect.Effect<void, never, Scope.Scope>,
  );

  it.effect(
    "supports inline catchTag conversion and leaves non-schema errors alone",
    Effect.fnUntraced(function* () {
      const schemaFailure = yield* Effect.flip(
        Schema.decodeUnknownEffect(Schema.Struct({ a: Schema.String }))({ a: 1 }).pipe(
          Effect.catchTag("SchemaError", Effect.fail),
        ),
      );

      expect(schemaFailure).toBeInstanceOf(Schema.SchemaError);
      expect(schemaFailure._tag).toBe("SchemaError");

      const argumentFailureProgram: Effect.Effect<never, Schema.SchemaError | ArgumentError> =
        Effect.fail(new ArgumentError({ message: "boom" }));
      const argumentFailure = yield* Effect.flip(
        argumentFailureProgram.pipe(Effect.catchTag("SchemaError", Effect.fail)),
      );

      expect(argumentFailure).toBeInstanceOf(ArgumentError);
      expect(argumentFailure).not.toBeInstanceOf(Schema.SchemaError);
    }),
  );
});
