import {
  SharedSlashCommand,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import { ChatInputCommandInteractionT } from "../../../services";
import {
  HandlerVariant,
  HandlerVariantT,
  handlerVariantMap,
} from "../handlerVariant";

export interface ChatInputHandlerVariantT extends HandlerVariantT {
  readonly type: HandlerVariant<
    SharedSlashCommand | SlashCommandSubcommandsOnlyBuilder,
    ChatInputCommandInteractionT
  >;
}

export const chatInputInteractionHandlerMap = <
  A = never,
  E = never,
  R = never,
>() =>
  handlerVariantMap<ChatInputHandlerVariantT, A, E, R>((data) => data.name);
