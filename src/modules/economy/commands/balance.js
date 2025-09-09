const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Показати баланс: Люміни та Русраб'),
  guildOnly: true,
  cooldown: 3,

  async execute(interaction, client) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const bal = await client.prisma.economyBalance.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });

    const cur1 = bal?.cur1 ?? 0;
    const cur2 = bal?.cur2 ?? 0;

    // compute current price for reference
    const cfg = await client.prisma.economyConfig.findUnique({ where: { guildId } });
    const basePrice = cfg?.basePrice ?? 100;
    const slope = cfg?.slope ?? 0.001;
    const agg = await client.prisma.economyBalance.aggregate({
      where: { guildId },
      _sum: { cur1: true },
    });
    const totalCur1 = agg._sum.cur1 ?? 0;
    const price = basePrice + slope * totalCur1;

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Ваш баланс')
      .setDescription(`Люміни: ${cur1}\nРусраб: ${cur2}`)
      .setFooter({ text: `Поточна ціна 1 Русраб ≈ ${price.toFixed(2)} Люмінів` });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
