require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error(
    "ناقصة متغيرات البيئة: تأكد من وجود DISCORD_TOKEN و CLIENT_ID و GUILD_ID."
  );
  process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (!command?.data || !command?.execute) {
    console.warn(`تحذير: الملف ${file} ناقصه data أو execute، تم تجاهله.`);
    continue;
  }
  commands.push(command.data.toJSON());
}

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log(`جاري تسجيل ${commands.length} أمر على السيرفر ${GUILD_ID} ...`);

    const data = await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log(`تم تسجيل ${data.length} أمر بنجاح.`);
  } catch (error) {
    console.error("فشل تسجيل الأوامر:", error);
    process.exit(1);
  }
})();
