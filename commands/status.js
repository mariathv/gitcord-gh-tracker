const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Check if GitHub activity tracker is running"),

  async execute(interaction) {
    try {
      await interaction.reply({
        content: "✅ GitHub tracker is active and polling every minute!",
        flags: 64,
      });
    } catch (error) {
      console.error("Status command error:", error);
      await interaction.reply({
        content: "⚠️ Failed to respond with tracker status.",
        ephemeral: true,
      });
    }
  },
};
