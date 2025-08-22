import { SlashCommandSubcommandGroupBuilder } from "discord.js";
import { ChatInputCommandInteractionT } from "../../../services";
import {
  HandlerVariant,
  HandlerVariantT,
  handlerVariantMap,
} from "../handlerVariant";

export interface ChatInputSubcommandGroupHandlerVariantT
  extends HandlerVariantT {
  readonly type: HandlerVariant<
    SlashCommandSubcommandGroupBuilder,
    ChatInputCommandInteractionT
  >;
}

export const chatInputSubcommandGroupInteractionHandlerMap = <
  A = never,
  E = never,
  R = never,
>() =>
  handlerVariantMap<ChatInputSubcommandGroupHandlerVariantT, A, E, R>(
    (data) => data.name,
  );
