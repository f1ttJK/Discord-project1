const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

const DAILY_AMOUNT = 100; // base daily reward in cur1
const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Отримати щоденний бонус (Люміни)')
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
    const lastDailyAt = existing?.lastDailyAt ?? null;

    if (lastDailyAt && now - lastDailyAt < DAILY_COOLDOWN_MS) {
      const leftMs = DAILY_COOLDOWN_MS - (now - lastDailyAt);
      const hours = Math.floor(leftMs / 3600000);
      const mins = Math.floor((leftMs % 3600000) / 60000);
      const secs = Math.floor((leftMs % 60000) / 1000);
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('Щоденний бонус вже отримано')
        .setDescription(`Спробуйте знову через ${hours}г ${mins}хв ${secs}с.`);
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    const updated = await client.prisma.economyBalance.upsert({
      where: { guildId_userId: { guildId, userId } },
      create: {
        guildId,
        userId,
        cur1: DAILY_AMOUNT,
        cur2: 0,
        lastDailyAt: now
      },
      update: { cur1: { increment: DAILY_AMOUNT }, lastDailyAt: now },
    });

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('Щоденний бонус')
      .setDescription(`Ви отримали **+${DAILY_AMOUNT}** Люмінів.`)
      .addFields(
        { name: 'Люміни', value: `${updated.cur1}`, inline: true },
        { name: 'Русраб', value: `${updated.cur2}`, inline: true },
      );

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
