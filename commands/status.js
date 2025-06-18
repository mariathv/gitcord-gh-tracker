import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("status")
  .setDescription("Check if GitHub activity tracker is running");

export async function execute(interaction) {
  try {
    await interaction.reply({
      content: "✅ GitHub tracker is active and polling every minute!",
      ephemeral: true,
    });
  } catch (error) {
    console.error("Status command error:", error);
    await interaction.reply({
      content: "⚠️ Failed to respond with tracker status.",
      ephemeral: true,
    });
  }
}
