import { SlashCommandSubcommandBuilder } from "discord.js";
import { ChatInputCommandInteractionT } from "../../../services";
import {
  HandlerVariant,
  HandlerVariantT,
  handlerVariantMap,
} from "../handlerVariant";

export interface ChatInputSubcommandHandlerVariantT extends HandlerVariantT {
  readonly type: HandlerVariant<
    SlashCommandSubcommandBuilder,
    ChatInputCommandInteractionT
  >;
}

export const chatInputSubcommandInteractionHandlerMap = <
  A = never,
  E = never,
  R = never,
>() =>
  handlerVariantMap<ChatInputSubcommandHandlerVariantT, A, E, R>(
    (data) => data.name,
  );
