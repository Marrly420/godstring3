require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

const { DISCORD_TOKEN, CLIENT_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error(
    "Missing required environment variables: DISCORD_TOKEN and CLIENT_ID must be set."
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
    console.warn(`Warning: ${file} is missing "data" or "execute", skipping.`);
    continue;
  }
  commands.push(command.data.toJSON());
}

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Registering ${commands.length} global command(s) ...`);

    const data = await rest.put(Routes.applicationCommands(CLIENT_ID), {
      body: commands,
    });

    console.log(
      `Successfully registered ${data.length} global command(s). Note: global commands can take up to an hour to propagate to all servers the first time.`
    );
  } catch (error) {
    console.error("Failed to register commands:", error);
    process.exit(1);
  }
})();
