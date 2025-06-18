const { SlashCommandBuilder } = require("discord.js");
const { Octokit } = require("@octokit/rest");

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

module.exports = {
  data: new SlashCommandBuilder()
    .setName("createwebhook")
    .setDescription("Add GitHub webhook for a repo")
    .addStringOption((option) =>
      option
        .setName("repo")
        .setDescription("The full repo name (e.g., user/repo)")
        .setRequired(true)
    ),

  async execute(interaction) {
    const repoFullName = interaction.options.getString("repo"); // user/repo
    const [owner, repo] = repoFullName.split("/");

    if (!owner || !repo) {
      return interaction.reply({
        content: "❌ Invalid repo format. Use `owner/repo`.",
        ephemeral: true,
      });
    }

    try {
      await octokit.repos.createWebhook({
        owner,
        repo,
        config: {
          url: `${process.env.PUBLIC_WEBHOOK_URL}/github-webhook`,
          content_type: "json",
          secret: process.env.GITHUB_WEBHOOK_SECRET,
          insecure_ssl: "0", // set "1" if using HTTP
        },
        events: ["push", "issues", "pull_request"],
      });

      await interaction.reply({
        content: `✅ Webhook created for \`${repoFullName}\`!`,
        ephemeral: true,
      });
    } catch (err) {
      console.error("Webhook creation error:", err);
      await interaction.reply({
        content: `⚠️ Failed to create webhook: ${err.message}`,
        ephemeral: true,
      });
    }
  },
};
