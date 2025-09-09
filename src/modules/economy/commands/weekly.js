const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

const WEEKLY_AMOUNT = 700; // base weekly reward in cur1
const WEEKLY_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

module.exports = {
  data: new SlashCommandBuilder()
    .setName('weekly')
    .setDescription('Отримати щотижневий бонус (Люміни)')
  ,
  guildOnly: true,
  cooldown: 3,

  async execute(interaction, client) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    // Ensure related Guild and User exist to satisfy FK constraints
    await client.prisma.guild.upsert({
      where: { id: guildId },
      update: {},
      create: { id: guildId },
    });
    await client.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    });

    const existing = await client.prisma.economyBalance.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });

    const now = new Date();
    const lastWeeklyAt = existing?.lastWeeklyAt ?? null;

    if (lastWeeklyAt && now - lastWeeklyAt < WEEKLY_COOLDOWN_MS) {
      const leftMs = WEEKLY_COOLDOWN_MS - (now - lastWeeklyAt);
      const days = Math.floor(leftMs / 86400000);
      const hours = Math.floor((leftMs % 86400000) / 3600000);
      const mins = Math.floor((leftMs % 3600000) / 60000);
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('Щотижневий бонус вже отримано')
        .setDescription(`Спробуйте знову через ${days}д ${hours}г ${mins}хв.`);
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    const updated = await client.prisma.economyBalance.upsert({
      where: { guildId_userId: { guildId, userId } },
      create: {
        guildId,
        userId,
        cur1: WEEKLY_AMOUNT,
        cur2: 0,
        lastWeeklyAt: now
      },
      update: { cur1: { increment: WEEKLY_AMOUNT }, lastWeeklyAt: now },
    });

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('Щотижневий бонус')
      .setDescription(`Ви отримали **+${WEEKLY_AMOUNT}** Люмінів.`)
      .addFields(
        { name: 'Люміни', value: `${updated.cur1}`, inline: true },
        { name: 'Русраб', value: `${updated.cur2}`, inline: true },
      );

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
