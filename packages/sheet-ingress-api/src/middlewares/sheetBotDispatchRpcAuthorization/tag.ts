import { RpcMiddleware } from "effect/unstable/rpc";
import { SheetAuthUser } from "../../schemas/middlewares/sheetAuthUser";
import { Unauthorized } from "typhoon-core/error";

export class SheetBotDispatchRpcAuthorization extends RpcMiddleware.Service<
  SheetBotDispatchRpcAuthorization,
  {
    provides: SheetAuthUser;
    requires: never;
  }
>()("SheetBotDispatchRpcAuthorization", {
  error: Unauthorized,
  requiredForClient: true,
}) {}
