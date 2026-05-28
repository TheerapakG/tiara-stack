import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { ServicesStatusResponse } from "./schema";

describe("ServicesStatusResponse", () => {
  it("decodes omitted service errors as null", () => {
    const decoded = Schema.decodeUnknownSync(ServicesStatusResponse)({
      overallStatus: "ok",
      checkedAt: Date.now(),
      services: [
        {
          name: "sheet-apis",
          url: "http://sheet-apis-service:3000/ready",
          status: "ok",
          httpStatus: 200,
          latencyMs: 3,
          checkedAt: Date.now(),
        },
      ],
    });

    expect(decoded.services).toHaveLength(1);
    expect(decoded.services[0]!.error).toBe(null);
  });
});
