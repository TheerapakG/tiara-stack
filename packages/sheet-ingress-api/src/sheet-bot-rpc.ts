import { DiscordRpcs } from "dfx-discord-utils/discord/rpc";
import { SheetBotRpcAuthorization } from "./middlewares/sheetBotRpcAuthorization/tag";

export const SheetBotRpcs = DiscordRpcs.middleware(SheetBotRpcAuthorization);
