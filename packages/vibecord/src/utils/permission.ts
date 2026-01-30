import { ChatInputCommandInteraction } from "discord.js";

export async function isOwner(interaction: ChatInputCommandInteraction): Promise<boolean> {
  await interaction.client.application?.fetch();
  const ownerId = interaction.client.application?.owner?.id;
  if (!ownerId) {
    return false;
  }
  return interaction.user.id === ownerId;
}
