import { UserSelectMenuComponentData } from "discord.js";
import { UserSelectMenuInteractionT } from "../../../services";
import {
  HandlerVariant,
  HandlerVariantT,
  handlerVariantMap,
} from "../handlerVariant";

export interface UserSelectMenuHandlerVariantT extends HandlerVariantT {
  readonly type: HandlerVariant<
    UserSelectMenuComponentData,
    UserSelectMenuInteractionT
  >;
}

export const userSelectMenuInteractionHandlerMap = <
  A = never,
  E = never,
  R = never,
>() =>
  handlerVariantMap<UserSelectMenuHandlerVariantT, A, E, R>(
    (data) => data.customId,
  );
