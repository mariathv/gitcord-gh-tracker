import { Client, GatewayIntentBits, Collection } from "discord.js";
import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import path from "path";
import { Octokit } from "@octokit/rest";
import crypto from "crypto";
import { fileURLToPath } from "url";

// Setup __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// === Discord Client ===
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
  const command = await import(path.join(commandsPath, file));
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.warn(`[WARNING] Command ${file} missing "data" or "execute"`);
  }
}

// === Persistent Last Event ID ===
const LAST_ID_FILE = "lastEventId.json";

function saveLastEventId(id) {
  fs.writeFileSync(LAST_ID_FILE, JSON.stringify({ id }), "utf-8");
}

function loadLastEventId() {
  if (!fs.existsSync(LAST_ID_FILE)) return null;
  try {
    const data = fs.readFileSync(LAST_ID_FILE, "utf-8");
    return JSON.parse(data).id || null;
  } catch (err) {
    console.error("Failed to read lastEventId:", err);
    return null;
  }
}

// === GitHub Activity Polling ===
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
let lastEventId = loadLastEventId();

async function pollGitHubActivity(client) {
  try {
    const { data: events } = await octokit.request(
      "GET /users/{username}/events/public",
      {
        username: process.env.GITHUB_USERNAME,
      }
    );

    const channel = await client.channels.fetch(process.env.LOG_CHANNEL_ID);
    for (const event of events.reverse()) {
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
        msg += `\n🔃 ${event.payload.action} pull request #${event.payload.pull_request.number}: ${event.payload.pull_request.title}`;
      }

      await channel.send(msg);
      lastEventId = event.id;
      saveLastEventId(lastEventId);
    }
  } catch (error) {
    console.error("GitHub polling error:", error.message);
  }
}

// === Discord Events ===
client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  console.log("✅ GitHub tracker is active and polling every minute!");

  pollGitHubActivity(client); // Run immediately on boot
  setInterval(() => pollGitHubActivity(client), 60 * 1000); // Run every 1 minute
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Error with ${interaction.commandName}:`, err);
    const msg = { content: "⚠️ Error running command.", ephemeral: true };
    interaction.replied || interaction.deferred
      ? await interaction.followUp(msg)
      : await interaction.reply(msg);
  }
});

client.login(process.env.DISCORD_TOKEN);

// === GitHub Webhook Listener ===
const app = express();
const PORT = process.env.PORT || 3000;

// GitHub signature verification
function verifySignature(req, res, buf) {
  const signature = req.headers["x-hub-signature-256"];
  const hmac = crypto.createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET);
  const digest = "sha256=" + hmac.update(buf).digest("hex");

  if (signature !== digest) {
    console.warn("⚠️ Webhook signature mismatch!");
    throw new Error("Invalid signature.");
  }
}

// Apply secure body parser
app.use(
  express.json({
    verify: verifySignature,
  })
);

// GitHub Webhook Endpoint
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
  } else {
    const msg = `📣 GitHub event: \`${event}\` from \`${
      payload.repository?.full_name || "unknown"
    }\``;
    await channel.send(msg);
  }

  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`🌐 Webhook listener running on port ${PORT}`);
});
