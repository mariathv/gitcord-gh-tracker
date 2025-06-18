const { Client, GatewayIntentBits } = require("discord.js");
require("dotenv").config();
const express = require("express");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);

// === GitHub Webhook Listener ===
const app = express();
app.use(express.json());

app.post("/github-webhook", async (req, res) => {
  const event = req.headers["x-github-event"];
  const payload = req.body;

  const channel = await client.channels.fetch(process.env.LOG_CHANNEL_ID);
  if (!channel) {
    console.warn("⚠️ Could not find log channel.");
    return res.sendStatus(404);
  }

  if (event === "push") {
    const commits = payload.commits
      .map((c) => `- ${c.message} (${c.author.name})`)
      .join("\n");
    const message = `📦 **${payload.pusher.name}** pushed to **${payload.repository.name}**:\n${commits}`;
    await channel.send(message);
  }

  // Add more events like "issues", "pull_request", etc. if needed

  res.sendStatus(200);
});

app.listen(process.env.PORT, () => {
  console.log(`🌐 Webhook listener running on port ${process.env.PORT}`);
});
