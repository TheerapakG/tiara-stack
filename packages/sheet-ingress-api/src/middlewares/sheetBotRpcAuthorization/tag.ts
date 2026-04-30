import { RpcMiddleware } from "effect/unstable/rpc";
import { Unauthorized } from "typhoon-core/error";

export class SheetBotRpcAuthorization extends RpcMiddleware.Service<
  SheetBotRpcAuthorization,
  {
    provides: never;
    requires: never;
  }
>()("SheetBotRpcAuthorization", {
  error: Unauthorized,
  requiredForClient: true,
}) {}
