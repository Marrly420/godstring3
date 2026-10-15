require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, Collection, Events } = require("discord.js");
const { LavalinkManager } = require("lavalink-client");

const { DISCORD_TOKEN, CLIENT_ID, LAVALINK_HOST, LAVALINK_PORT, LAVALINK_PASSWORD } =
  process.env;

if (!DISCORD_TOKEN || !CLIENT_ID || !LAVALINK_PASSWORD) {
  console.error(
    "ناقصة متغيرات بيئة أساسية (DISCORD_TOKEN / CLIENT_ID / LAVALINK_PASSWORD). راجع إعدادات البيئة."
  );
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

// ---------- تحميل الأوامر ----------
client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"))) {
  const command = require(path.join(commandsPath, file));
  if (command?.data && command?.execute) {
    client.commands.set(command.data.name, command);
  }
}

// ---------- إعداد Lavalink ----------
client.lavalink = new LavalinkManager({
  nodes: [
    {
      id: "main",
      authorization: LAVALINK_PASSWORD,
      host: LAVALINK_HOST || "lavalink",
      port: Number(LAVALINK_PORT) || 2333,
      secure: false,
      retryAmount: Infinity, // يحاول يرجع يتصل بدون ما يوقف البوت نهائي
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

// تمرير بيانات الـ Gateway الخام لمكتبة Lavalink (ضروري عشان تتبع حالة الصوت)
client.on("raw", (d) => client.lavalink.sendRawData(d));

// ---------- مراقبة حالة اتصال Lavalink ----------
client.lavalink.nodeManager.on("connect", (node) =>
  console.log(`[Lavalink] متصل بنجاح بالعقدة: ${node.id}`)
);
client.lavalink.nodeManager.on("disconnect", (node, reason) =>
  console.warn(`[Lavalink] انقطع الاتصال بالعقدة ${node.id}:`, reason)
);
client.lavalink.nodeManager.on("reconnecting", (node) =>
  console.warn(`[Lavalink] جاري محاولة إعادة الاتصال بالعقدة ${node.id} ...`)
);
client.lavalink.nodeManager.on("error", (node, error) =>
  console.error(`[Lavalink] خطأ بالعقدة ${node.id}:`, error)
);

// ---------- أحداث التشغيل ----------
client.lavalink.on("trackError", (player, track, payload) => {
  console.error(
    `[Player ${player.guildId}] خطأ بمقطع "${track?.info?.title}":`,
    payload?.exception?.message || payload
  );
  const channel = client.channels.cache.get(player.textChannelId);
  if (channel?.isTextBased()) {
    channel
      .send("صار خطأ بتشغيل هذا المقطع، راح أحاول أنتقل للي بعده.")
      .catch(() => {});
  }
});

client.lavalink.on("trackStuck", (player, track) => {
  console.warn(`[Player ${player.guildId}] المقطع "${track?.info?.title}" توقف (stuck)`);
});

client.lavalink.on("queueEnd", (player) => {
  const channel = client.channels.cache.get(player.textChannelId);
  if (channel?.isTextBased()) {
    channel.send("خلصت قائمة التشغيل.").catch(() => {});
  }
});

client.lavalink.on("playerDisconnect", (player) => {
  console.log(`[Player ${player.guildId}] طلع من الروم الصوتي`);
});

// ---------- جاهزية البوت ----------
client.once(Events.ClientReady, async (c) => {
  console.log(`تم تسجيل الدخول باسم ${c.user.tag}`);
  try {
    await client.lavalink.init({ id: c.user.id, username: c.user.username });
    console.log("تم تهيئة Lavalink بنجاح.");
  } catch (error) {
    console.error("فشل تهيئة Lavalink:", error);
  }
});

// ---------- معالجة الأوامر ----------
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(`خطأ أثناء تنفيذ الأمر ${interaction.commandName}:`, error);
    const payload = {
      content: "صار خطأ غير متوقع أثناء تنفيذ الأمر.",
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

// ---------- حماية من تعطل العملية كاملة ----------
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

// ---------- إغلاق نظيف عند إيقاف الحاوية ----------
async function shutdown(signal) {
  console.log(`استلمت إشارة ${signal}، جاري الإغلاق بشكل نظيف...`);
  try {
    for (const player of client.lavalink.players.values()) {
      await player.destroy().catch(() => {});
    }
  } catch (error) {
    console.error("خطأ أثناء تنظيف المشغلات:", error);
  }
  client.destroy();
  process.exit(0);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

client.login(DISCORD_TOKEN);
