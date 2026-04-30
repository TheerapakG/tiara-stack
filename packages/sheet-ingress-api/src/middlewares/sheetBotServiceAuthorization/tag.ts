import { HttpApiMiddleware, HttpApiSecurity, OpenApi } from "effect/unstable/httpapi";
import { Unauthorized } from "typhoon-core/error";

export class SheetBotServiceAuthorization extends HttpApiMiddleware.Service<
  SheetBotServiceAuthorization,
  {
    provides: never;
    requires: never;
  }
>()("SheetBotServiceAuthorization", {
  requiredForClient: false,
  error: Unauthorized,
  security: {
    sheetBotServiceToken: HttpApiSecurity.bearer.pipe(
      HttpApiSecurity.annotate(OpenApi.Description, "Require sheet-auth service token"),
    ),
  },
}) {}
