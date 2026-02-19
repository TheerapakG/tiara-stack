import { HttpApiMiddleware, HttpApiSecurity, OpenApi } from "@effect/platform";
import { Unauthorized } from "../error";
import { Context } from "effect";

export class SheetAuthUser extends Context.Tag("SheetAuthUser")<
  SheetAuthUser,
  {
    discordUserId: string;
  }
>() {}

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
