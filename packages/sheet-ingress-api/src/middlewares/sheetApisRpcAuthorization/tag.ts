import { RpcMiddleware } from "effect/unstable/rpc";
import { SheetAuthUser } from "../../schemas/middlewares/sheetAuthUser";
import { Unauthorized } from "../../schemas/middlewares/unauthorized";

export class SheetApisRpcAuthorization extends RpcMiddleware.Service<
  SheetApisRpcAuthorization,
  {
    provides: SheetAuthUser;
    requires: never;
  }
>()("SheetApisRpcAuthorization", {
  requiredForClient: false,
  error: Unauthorized,
}) {}
