import { Effect, Layer, ServiceMap } from "effect";
import { createSheetAuthClient } from "sheet-auth/client";
import { config } from "@/config";

export class SheetAuthClient extends ServiceMap.Service<SheetAuthClient>()("SheetAuthClient", {
  make: Effect.gen(function* () {
    return createSheetAuthClient((yield* config.sheetAuthIssuer).replace(/\/$/, ""));
  }),
}) {
  static layer = Layer.effect(SheetAuthClient, this.make);
}
