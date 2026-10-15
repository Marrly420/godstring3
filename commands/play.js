const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("يشغل أغنية من يوتيوب بالاسم أو بالرابط")
    .addStringOption((option) =>
      option
        .setName("اسم")
        .setDescription("اسم الأغنية أو رابط يوتيوب")
        .setRequired(true)
    ),

  async execute(interaction, client) {
    const query = interaction.options.getString("اسم", true);
    const member = interaction.member;
    const voiceChannel = member.voice?.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content: "لازم تكون داخل روم صوتي أول عشان تستخدم هذا الأمر.",
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
        content: "ماكو عندي صلاحية الدخول أو التحدث بهذا الروم الصوتي.",
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
          content: "ما لقيت نتيجة لهذا البحث، جرب اسم ثاني أو رابط مباشر.",
        });
      }

      const isPlaylist = result.loadType === "playlist";
      const embed = new EmbedBuilder().setColor(0x5865f2);

      if (isPlaylist) {
        await player.queue.add(result.tracks);
        embed
          .setTitle("تمت إضافة قائمة تشغيل")
          .setDescription(
            `**${result.playlist?.name || "قائمة تشغيل"}**\nعدد المقاطع: ${result.tracks.length}`
          );
      } else {
        const track = result.tracks[0];
        await player.queue.add(track);
        embed
          .setTitle(player.playing || player.queue.tracks.length > 1 ? "تمت الإضافة إلى قائمة الانتظار" : "جاري التشغيل الآن")
          .setDescription(`**${track.info.title}**\nبواسطة: ${track.info.author}`)
          .setThumbnail(track.info.artworkUrl || null);
      }

      if (!player.playing && !player.paused) {
        await player.play();
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("خطأ بأمر /play:", error);
      const message = "صار خطأ أثناء محاولة التشغيل، جرب مرة ثانية.";
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({ content: message });
      }
      return interaction.reply({ content: message, ephemeral: true });
    }
  },
};
