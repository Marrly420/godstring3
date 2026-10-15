const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song from YouTube by name or link")
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("Song name or YouTube link")
        .setRequired(true)
    ),

  async execute(interaction, client) {
    const query = interaction.options.getString("query", true);
    const member = interaction.member;
    const voiceChannel = member.voice?.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content: "You need to be in a voice channel to use this command.",
        ephemeral: true,
      });
    }

    const botMember = interaction.guild.members.me;
    const permissions = voiceChannel.permissionsFor(botMember);
    if (
      !permissions.has(PermissionFlagsBits.Connect) ||
      !permissions.has(PermissionFlagsBits.Speak)
    ) {
      return interaction.reply({
        content: "I don't have permission to join or speak in that voice channel.",
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    let player = client.lavalink.getPlayer(interaction.guildId);

    try {
      if (!player) {
        player = client.lavalink.createPlayer({
          guildId: interaction.guildId,
          voiceChannelId: voiceChannel.id,
          textChannelId: interaction.channelId,
          selfDeaf: true,
          selfMute: false,
          volume: 80,
        });
      }

      if (!player.connected) {
        await player.connect();
      }

      const result = await player.search(
        { query, source: "ytsearch" },
        interaction.user
      );

      if (!result || !result.tracks?.length) {
        return interaction.editReply({
          content: "No results found for that search. Try a different name or a direct link.",
        });
      }

      const isPlaylist = result.loadType === "playlist";
      const embed = new EmbedBuilder().setColor(0x5865f2);

      if (isPlaylist) {
        await player.queue.add(result.tracks);
        embed
          .setTitle("Playlist added")
          .setDescription(
            `**${result.playlist?.name || "Playlist"}**\nTracks: ${result.tracks.length}`
          );
      } else {
        const track = result.tracks[0];
        await player.queue.add(track);
        embed
          .setTitle(player.playing || player.queue.tracks.length > 1 ? "Added to queue" : "Now playing")
          .setDescription(`**${track.info.title}**\nBy: ${track.info.author}`)
          .setThumbnail(track.info.artworkUrl || null);
      }

      if (!player.playing && !player.paused) {
        await player.play();
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in /play command:", error);
      const message = "Something went wrong while trying to play that. Please try again.";
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({ content: message });
      }
      return interaction.reply({ content: message, ephemeral: true });
    }
  },
};
