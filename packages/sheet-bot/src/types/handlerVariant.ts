import {
  InteractionButtonComponentData,
  SharedSlashCommand,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import {
  ButtonInteractionT,
  ChatInputCommandInteractionT,
} from "../services/interaction/interactionContext";

export type HandlerVariant = {
  button: {
    data: InteractionButtonComponentData;
    interaction: ButtonInteractionT;
  };
  chatInput: {
    data: SharedSlashCommand | SlashCommandSubcommandsOnlyBuilder;
    interaction: ChatInputCommandInteractionT;
  };
  chatInputSubcommandGroup: {
    data: SlashCommandSubcommandGroupBuilder;
    interaction: ChatInputCommandInteractionT;
  };
  chatInputSubcommand: {
    data: SlashCommandSubcommandBuilder;
    interaction: ChatInputCommandInteractionT;
  };
};

export type HandlerVariantKey = keyof HandlerVariant;
export type HandlerVariantData<Variant extends HandlerVariantKey> =
  HandlerVariant[Variant]["data"];
export type HandlerVariantInteraction<Variant extends HandlerVariantKey> =
  HandlerVariant[Variant]["interaction"];
