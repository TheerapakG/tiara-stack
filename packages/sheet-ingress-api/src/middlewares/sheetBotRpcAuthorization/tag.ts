import { RpcMiddleware } from "effect/unstable/rpc";
import { Unauthorized } from "dfx-discord-utils/discord/schema";

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
