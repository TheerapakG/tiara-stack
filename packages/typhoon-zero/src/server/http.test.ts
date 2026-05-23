import { describe, expect, it } from "@effect/vitest";
import { hasZeroHandlerFn, removeUndefinedFields } from "./http";

describe("Zero server HTTP helpers", () => {
  it("removes undefined object fields and normalizes undefined array entries to null", () => {
    expect(
      removeUndefinedFields({
        keep: "value",
        drop: undefined,
        nested: {
          keep: 1,
          drop: undefined,
        },
        array: ["value", undefined, { keep: true, drop: undefined }],
      } as any),
    ).toEqual({
      keep: "value",
      nested: {
        keep: 1,
      },
      array: ["value", null, { keep: true }],
    });
  });

  it("accepts Zero handler definitions stored as functions with fn metadata", () => {
    const query = Object.assign(() => undefined, {
      fn: () => undefined,
    });

    expect(typeof query).toBe("function");
    expect(hasZeroHandlerFn(query)).toBe(true);
  });
});
