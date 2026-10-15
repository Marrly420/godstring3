require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, Collection, Events } = require("discord.js");
const { LavalinkManager } = require("lavalink-client");

const { DISCORD_TOKEN, CLIENT_ID, LAVALINK_HOST, LAVALINK_PORT, LAVALINK_PASSWORD } =
  process.env;

if (!DISCORD_TOKEN || !CLIENT_ID || !LAVALINK_PASSWORD) {
  console.error(
    "Missing required environment variables (DISCORD_TOKEN / CLIENT_ID / LAVALINK_PASSWORD). Check your environment settings."
  );
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

// ---------- Load commands ----------
client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"))) {
  const command = require(path.join(commandsPath, file));
  if (command?.data && command?.execute) {
    client.commands.set(command.data.name, command);
  }
}

// ---------- Lavalink setup ----------
client.lavalink = new LavalinkManager({
  nodes: [
    {
      id: "main",
      authorization: LAVALINK_PASSWORD,
      host: LAVALINK_HOST || "lavalink",
      port: Number(LAVALINK_PORT) || 2333,
      secure: false,
      retryAmount: Infinity, // keep retrying forever instead of giving up
      retryDelay: 5000,
    },
  ],
  sendToShard: (guildId, payload) =>
    client.guilds.cache.get(guildId)?.shard?.send(payload),
  client: {
    id: CLIENT_ID,
    username: "godstring3",
  },
  autoSkip: true,
  playerOptions: {
    defaultSearchPlatform: "ytsearch",
    onDisconnect: { autoReconnect: true, destroyPlayer: false },
    onEmptyQueue: { destroyAfterMs: 60000 },
  },
});

// Forward raw gateway data to Lavalink (required for voice state tracking)
client.on("raw", (d) => client.lavalink.sendRawData(d));

// ---------- Lavalink connection monitoring ----------
client.lavalink.nodeManager.on("connect", (node) =>
  console.log(`[Lavalink] Connected to node: ${node.id}`)
);
client.lavalink.nodeManager.on("disconnect", (node, reason) =>
  console.warn(`[Lavalink] Disconnected from node ${node.id}:`, reason)
);
client.lavalink.nodeManager.on("reconnecting", (node) =>
  console.warn(`[Lavalink] Reconnecting to node ${node.id} ...`)
);
client.lavalink.nodeManager.on("error", (node, error) =>
  console.error(`[Lavalink] Error on node ${node.id}:`, error)
);

// ---------- Playback events ----------
client.lavalink.on("trackError", (player, track, payload) => {
  console.error(
    `[Player ${player.guildId}] Error on track "${track?.info?.title}":`,
    payload?.exception?.message || payload
  );
  const channel = client.channels.cache.get(player.textChannelId);
  if (channel?.isTextBased()) {
    channel
      .send("There was an error playing that track, skipping to the next one.")
      .catch(() => {});
  }
});

client.lavalink.on("trackStuck", (player, track) => {
  console.warn(`[Player ${player.guildId}] Track "${track?.info?.title}" got stuck`);
});

client.lavalink.on("queueEnd", (player) => {
  const channel = client.channels.cache.get(player.textChannelId);
  if (channel?.isTextBased()) {
    channel.send("Queue finished.").catch(() => {});
  }
});

client.lavalink.on("playerDisconnect", (player) => {
  console.log(`[Player ${player.guildId}] left the voice channel`);
});

// ---------- Bot ready ----------
client.once(Events.ClientReady, async (c) => {
  console.log(`Logged in as ${c.user.tag}`);
  try {
    await client.lavalink.init({ id: c.user.id, username: c.user.username });
    console.log("Lavalink initialized successfully.");
  } catch (error) {
    console.error("Failed to initialize Lavalink:", error);
  }
});

// ---------- Command handling ----------
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(`Error executing command ${interaction.commandName}:`, error);
    const payload = {
      content: "An unexpected error occurred while running this command.",
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

// ---------- Prevent total process crashes ----------
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

// ---------- Graceful shutdown on container stop ----------
async function shutdown(signal) {
  console.log(`Received ${signal}, shutting down gracefully...`);
  try {
    for (const player of client.lavalink.players.values()) {
      await player.destroy().catch(() => {});
    }
  } catch (error) {
    console.error("Error while cleaning up players:", error);
  }
  client.destroy();
  process.exit(0);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

client.login(DISCORD_TOKEN);
