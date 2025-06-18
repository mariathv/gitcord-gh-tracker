const { Client, GatewayIntentBits, Collection } = require("discord.js");
require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const { Octokit } = require("@octokit/rest");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

// === Load Slash Commands ===
client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.warn(`[WARNING] Command ${file} missing "data" or "execute"`);
  }
}

// === GitHub Activity Polling ===
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
let lastEventId = null;

async function pollGitHubActivity() {
  try {
    const events = await octokit.activity.listEventsForUser({
      username: process.env.GITHUB_USERNAME,
      per_page: 5,
    });

    const channel = await client.channels.fetch(process.env.LOG_CHANNEL_ID);

    for (const event of events.data.reverse()) {
      if (lastEventId && event.id <= lastEventId) continue;

      let msg = `📣 **${event.type}** in \`${event.repo.name}\``;

      if (event.type === "PushEvent" && event.payload.commits) {
        msg +=
          "\n" +
          event.payload.commits
            .map((c) => `- ${c.message} (${c.author.name})`)
            .join("\n");
      } else if (event.type === "IssuesEvent") {
        msg += `\n📝 ${event.payload.action} issue #${event.payload.issue.number}: ${event.payload.issue.title}`;
      } else if (event.type === "PullRequestEvent") {
        msg += `\n🔀 ${event.payload.action} pull request #${event.payload.pull_request.number}: ${event.payload.pull_request.title}`;
      }

      await channel.send(msg);
      lastEventId = event.id;
    }
  } catch (error) {
    console.error("GitHub polling error:", error.message);
  }
}

// === Discord Events ===
client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  setInterval(pollGitHubActivity, 60 * 1000); // poll every 1 min
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Error with ${interaction.commandName}:`, err);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "⚠️ Error running command.",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "⚠️ Error running command.",
        ephemeral: true,
      });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

// === Webhook Listener (Optional for repo-based events) ===
const app = express();
app.use(express.json());

app.post("/github-webhook", async (req, res) => {
  const event = req.headers["x-github-event"];
  const payload = req.body;

  const channel = await client.channels.fetch(process.env.LOG_CHANNEL_ID);
  if (!channel) return res.sendStatus(404);

  if (event === "push") {
    const commits = payload.commits
      .map((c) => `- ${c.message} (${c.author.name})`)
      .join("\n");
    const msg = `📦 **${payload.pusher.name}** pushed to \`${payload.repository.name}\`:\n${commits}`;
    await channel.send(msg);
  }

  res.sendStatus(200);
});

app.listen(process.env.PORT, () => {
  console.log(`🌐 Webhook listener running on port ${process.env.PORT}`);
});
