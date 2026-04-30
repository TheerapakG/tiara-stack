import { RpcMiddleware } from "effect/unstable/rpc";
import { SheetAuthUser } from "../../schemas/middlewares/sheetAuthUser";
import { Unauthorized } from "typhoon-core/error";

export class SheetApisRpcAuthorization extends RpcMiddleware.Service<
  SheetApisRpcAuthorization,
  {
    provides: SheetAuthUser;
    requires: never;
  }
>()("SheetApisRpcAuthorization", {
  requiredForClient: true,
  error: Unauthorized,
}) {}
