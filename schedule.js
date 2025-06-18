const cron = require("node-cron");
const { getUserStats } = require("./services/githubService");
const { Client, TextChannel } = require("discord.js");

function startScheduler(client) {
  cron.schedule("0 10 * * *", async () => {
    const stats = await getUserStats(process.env.GITHUB_USERNAME);
    const channel = client.channels.cache.get("your_channel_id");
    if (channel instanceof TextChannel) {
      channel.send(
        `Daily GitHub stats: ⭐ ${stats.publicRepos} repos, 👥 ${stats.followers} followers.`
      );
    }
  });
}

module.exports = { startScheduler };
