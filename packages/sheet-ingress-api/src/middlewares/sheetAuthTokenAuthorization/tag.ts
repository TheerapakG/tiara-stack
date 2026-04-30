import { HttpApiMiddleware, HttpApiSecurity, OpenApi } from "effect/unstable/httpapi";
import { Unauthorized } from "typhoon-core/error";
import { SheetAuthUser } from "../../schemas/middlewares/sheetAuthUser";

export class SheetAuthTokenAuthorization extends HttpApiMiddleware.Service<
  SheetAuthTokenAuthorization,
  {
    provides: SheetAuthUser;
    requires: never;
  }
>()("SheetAuthTokenAuthorization", {
  requiredForClient: false,
  error: Unauthorized,
  security: {
    sheetAuthToken: HttpApiSecurity.bearer.pipe(
      HttpApiSecurity.annotate(OpenApi.Description, "Require sheet-auth token for authorization"),
    ),
  },
}) {}
