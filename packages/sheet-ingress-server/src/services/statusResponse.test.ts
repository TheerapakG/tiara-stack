import { describe, expect, it } from "vitest";
import type { ServicesStatusResponse } from "sheet-ingress-api/sheet-apis-rpc";
import { normalizeServicesStatusResponse } from "./statusResponse";

describe("normalizeServicesStatusResponse", () => {
  it("normalizes omitted service errors to null before ingress response encoding", () => {
    const response = {
      overallStatus: "ok",
      checkedAt: new Date(),
      services: [
        {
          name: "sheet-apis",
          url: "http://sheet-apis-service:3000/ready",
          status: "ok",
          httpStatus: 200,
          latencyMs: 3,
          checkedAt: new Date(),
        },
      ],
    } as unknown as ServicesStatusResponse;

    expect(normalizeServicesStatusResponse(response).services[0]!.error).toBe(null);
  });
});
