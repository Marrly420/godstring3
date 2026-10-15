const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop playback, clear the queue, and leave the voice channel"),

  async execute(interaction, client) {
    const player = client.lavalink.getPlayer(interaction.guildId);

    if (!player) {
      return interaction.reply({
        content: "Nothing is currently playing.",
        ephemeral: true,
      });
    }

    const member = interaction.member;
    const voiceChannel = member.voice?.channel;

    if (!voiceChannel || voiceChannel.id !== player.voiceChannelId) {
      return interaction.reply({
        content: "You need to be in the same voice channel as the bot to stop playback.",
        ephemeral: true,
      });
    }

    try {
      await player.destroy();
      return interaction.reply({ content: "Playback stopped and queue cleared." });
    } catch (error) {
      console.error("Error in /stop command:", error);
      return interaction.reply({
        content: "Something went wrong while trying to stop playback.",
        ephemeral: true,
      });
    }
  },
};
