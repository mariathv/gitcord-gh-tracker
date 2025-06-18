const { SlashCommandBuilder } = require("discord.js");
const { getUserStats } = require("../services/githubService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("githubstats")
    .setDescription("Show GitHub user stats"),
  async execute(interaction) {
    const stats = await getUserStats(process.env.GITHUB_USERNAME);
    await interaction.reply(
      `GitHub Stats:\nFollowers: ${stats.followers}\nRepos: ${stats.publicRepos}`
    );
  },
};
