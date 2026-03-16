import { HttpApiMiddleware, HttpApiSecurity, OpenApi } from "@effect/platform";
import { Unauthorized } from "../../schemas/middlewares/unauthorized";
import { SheetAuthUser } from "../../schemas/middlewares/sheetAuthUser";

export class SheetAuthTokenAuthorization extends HttpApiMiddleware.Tag<SheetAuthTokenAuthorization>()(
  "SheetAuthTokenAuthorization",
  {
    provides: SheetAuthUser,
    failure: Unauthorized,
    security: {
      sheetAuthToken: HttpApiSecurity.bearer.pipe(
        HttpApiSecurity.annotate(OpenApi.Description, "Require sheet-auth token for authorization"),
      ),
    },
  },
) {}
