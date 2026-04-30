import { HttpApiMiddleware } from "effect/unstable/httpapi";
import { Unauthorized } from "typhoon-core/error";
import { SheetAuthUser } from "../../schemas/middlewares/sheetAuthUser";

export class SheetApisServiceUserFallback extends HttpApiMiddleware.Service<
  SheetApisServiceUserFallback,
  {
    provides: SheetAuthUser;
    requires: never;
  }
>()("SheetApisServiceUserFallback", {
  requiredForClient: false,
  error: Unauthorized,
}) {}
