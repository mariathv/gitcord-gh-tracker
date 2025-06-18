import { SlashCommandBuilder } from "discord.js";
import { getUserStats } from "../services/githubService.js";

export const data = new SlashCommandBuilder()
  .setName("githubstats")
  .setDescription("Show GitHub user stats");

export async function execute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: false });

    const stats = await getUserStats(process.env.GITHUB_USERNAME);

    await interaction.editReply(
      `📊 **GitHub Stats for \`${process.env.GITHUB_USERNAME}\`**\n👥 Followers: ${stats.followers}\n📁 Public Repos: ${stats.publicRepos}`
    );
  } catch (error) {
    console.error("GitHub stats error:", error);
    await interaction.editReply("⚠️ Failed to fetch GitHub stats.");
  }
}
