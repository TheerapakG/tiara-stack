import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  InteractionButtonComponentData,
  SharedSlashCommand,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";

export type HandlerVariant = {
  button: {
    data: InteractionButtonComponentData;
    interaction: ButtonInteraction;
  };
  chatInput: {
    data: SharedSlashCommand | SlashCommandSubcommandsOnlyBuilder;
    interaction: ChatInputCommandInteraction;
  };
  chatInputSubcommandGroup: {
    data: SlashCommandSubcommandGroupBuilder;
    interaction: ChatInputCommandInteraction;
  };
  chatInputSubcommand: {
    data: SlashCommandSubcommandBuilder;
    interaction: ChatInputCommandInteraction;
  };
};

export type HandlerVariantKey = keyof HandlerVariant;
export type HandlerVariantData<Variant extends HandlerVariantKey> =
  HandlerVariant[Variant]["data"];
export type HandlerVariantInteraction<Variant extends HandlerVariantKey> =
  HandlerVariant[Variant]["interaction"];
