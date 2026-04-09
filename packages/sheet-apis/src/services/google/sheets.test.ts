import { describe, expect, it } from "@effect/vitest";
import { Option, Schema } from "effect";
import { GoogleSheets, toCellOption } from "./sheets";

describe("GoogleSheets", () => {
  it("trims non-empty cells", () => {
    expect(toCellOption(" Alice ")).toEqual(Option.some("Alice"));
  });

  it("treats blank and whitespace-only cells as empty", () => {
    expect(toCellOption("")).toEqual(Option.none());
    expect(toCellOption("   ")).toEqual(Option.none());
    expect(toCellOption(null)).toEqual(Option.none());
  });

  it("decodes sparse row data cells from Google without requiring missing keys", () => {
    const decoded = Schema.decodeUnknownSync(GoogleSheets.rowDataCellToCellSchema)({
      effectiveValue: { numberValue: 18 },
      formattedValue: "18",
    });

    expect(decoded).toEqual(Option.some("18"));
  });

  it("decodes empty option cells for derived scalar parsers", () => {
    expect(Schema.decodeUnknownSync(GoogleSheets.cellToBooleanSchema)(Option.none())).toEqual(
      Option.none(),
    );
    expect(Schema.decodeUnknownSync(GoogleSheets.cellToNumberSchema)(Option.none())).toEqual(
      Option.none(),
    );
    expect(Schema.decodeUnknownSync(GoogleSheets.cellToStringArraySchema)(Option.none())).toEqual(
      Option.none(),
    );
  });

  it("decodes empty row-data cells to none", () => {
    expect(Schema.decodeUnknownSync(GoogleSheets.rowDataToCellSchema)([{}])).toEqual(Option.none());
  });
});
