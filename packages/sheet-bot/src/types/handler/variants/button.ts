import { InteractionButtonComponentData } from "discord.js";
import { ButtonInteractionT } from "@/services";
import {
  HandlerVariant,
  HandlerVariantT,
  handlerVariantMap,
} from "@/types/handler/handlerVariant";

export interface ButtonHandlerVariantT extends HandlerVariantT {
  readonly type: HandlerVariant<
    InteractionButtonComponentData,
    ButtonInteractionT
  >;
}

export const buttonInteractionHandlerMap = <
  A = never,
  E = never,
  R = never,
>() =>
  handlerVariantMap<ButtonHandlerVariantT, A, E, R>((data) => data.customId);
