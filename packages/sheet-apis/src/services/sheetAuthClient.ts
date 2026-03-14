import { Effect } from "effect";
import { createSheetAuthClient } from "sheet-auth/client";
import { config } from "@/config";

export class SheetAuthClient extends Effect.Service<SheetAuthClient>()("SheetAuthClient", {
  effect: Effect.gen(function* () {
    return createSheetAuthClient((yield* config.sheetAuthIssuer).replace(/\/$/, ""));
  }),
}) {}
