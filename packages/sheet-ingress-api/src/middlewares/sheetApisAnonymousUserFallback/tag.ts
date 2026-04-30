import { HttpApiMiddleware } from "effect/unstable/httpapi";
import { SheetAuthUser } from "../../schemas/middlewares/sheetAuthUser";

export class SheetApisAnonymousUserFallback extends HttpApiMiddleware.Service<
  SheetApisAnonymousUserFallback,
  {
    provides: SheetAuthUser;
    requires: never;
  }
>()("SheetApisAnonymousUserFallback", {
  requiredForClient: false,
}) {}
