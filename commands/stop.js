const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("يوقف التشغيل ويفرغ قائمة الانتظار ويطلع من الروم الصوتي"),

  async execute(interaction, client) {
    const player = client.lavalink.getPlayer(interaction.guildId);

    if (!player) {
      return interaction.reply({
        content: "ماكو شي شغال حاليًا.",
        ephemeral: true,
      });
    }

    const member = interaction.member;
    const voiceChannel = member.voice?.channel;

    if (!voiceChannel || voiceChannel.id !== player.voiceChannelId) {
      return interaction.reply({
        content: "لازم تكون بنفس الروم الصوتي مال البوت عشان توقف التشغيل.",
        ephemeral: true,
      });
    }

    try {
      await player.destroy();
      return interaction.reply({ content: "تم إيقاف التشغيل وتفريغ القائمة." });
    } catch (error) {
      console.error("خطأ بأمر /stop:", error);
      return interaction.reply({
        content: "صار خطأ أثناء محاولة الإيقاف.",
        ephemeral: true,
      });
    }
  },
};
