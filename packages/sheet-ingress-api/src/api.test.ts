import { describe, expect, it } from "vitest";
import { Api, SheetApisApi } from "./api";

describe("Api", () => {
  it("keeps sheet-apis health endpoints off ingress", () => {
    expect(SheetApisApi.groups).toHaveProperty("health");
    expect(Api.groups).not.toHaveProperty("health");
  });

  it("exposes every non-health sheet API group on ingress", () => {
    const sheetApiGroups = Object.keys(SheetApisApi.groups).filter((group) => group !== "health");

    for (const group of sheetApiGroups) {
      expect(Api.groups).toHaveProperty(group);
    }
  });
});
