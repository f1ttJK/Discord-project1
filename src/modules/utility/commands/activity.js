const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

function formatHMS(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec]
    .map(v => String(v).padStart(2, '0'))
    .join(':');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('activity')
    .setDescription('Показати активність користувача (повідомлення та час у голосі)')
    .addUserOption(opt => opt
      .setName('user')
      .setDescription('Кого переглянути (за замовчуванням — ви)')
      .setRequired(false)
    ),
  guildOnly: true,
  cooldown: 3,

  async execute(interaction, client) {
    const guildId = interaction.guildId;
    const targetUser = interaction.options.getUser('user') ?? interaction.user;
    const userId = targetUser.id;

    // Читаємо активність із моделі Member (унікальна пара guildId+userId)
    const memberRow = await client.prisma.member.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });

    const msgCount = memberRow?.msgCount ?? 0;
    const voiceSeconds = memberRow?.voiceSeconds ?? 0;

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('Активність користувача')
      .setDescription(`Для: <@${userId}>`)
      .addFields(
        { name: 'Повідомлень', value: String(msgCount), inline: true },
        { name: 'Час у голосі', value: formatHMS(voiceSeconds), inline: true },
      );

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
