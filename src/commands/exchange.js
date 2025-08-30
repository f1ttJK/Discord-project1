const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('exchange')
    .setDescription('Обміняти Люміни на Русраб за динамічною ціною')
    .addIntegerOption(opt => opt
      .setName('amount2')
      .setDescription('Скільки Русраб купити')
      .setMinValue(1)
      .setRequired(false)
    )
    .addIntegerOption(opt => opt
      .setName('amount1')
      .setDescription('Скільки Люмін витратити')
      .setMinValue(1)
      .setRequired(false)
    ),
  guildOnly: true,
  cooldown: 5,

  async execute(interaction, client) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const amount2Req = interaction.options.getInteger('amount2');
    const amount1Req = interaction.options.getInteger('amount1');

    if ((amount2Req && amount1Req) || (!amount2Req && !amount1Req)) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('Помилка')
        .setDescription('Вкажіть або `amount2` (скільки Русраб купити), або `amount1` (скільки Люмін витратити), але не обидва одразу.');
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Ensure Guild exists
    await client.prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });

    // Ensure config exists
    const cfg = await client.prisma.economyConfig.upsert({
      where: { guildId },
      create: {
        guildId,
      },
      update: {},
    });

    // Total cur1 in this guild affects price
    const agg = await client.prisma.economyBalance.aggregate({
      where: { guildId },
      _sum: { cur1: true },
    });
    const totalCur1 = agg._sum.cur1 ?? 0;

    const basePrice = cfg.basePrice; // price of 1 cur2 in cur1 when supply=0
    const slope = cfg.slope;         // price increases with total cur1
    const price = basePrice + slope * totalCur1; // current per-unit price

    // Fetch user balance
    const bal = await client.prisma.economyBalance.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });

    const cur1 = bal?.cur1 ?? 0;
    const cur2 = bal?.cur2 ?? 0;

    let buyAmount2 = 0;
    let costCur1 = 0;

    if (amount2Req) {
      buyAmount2 = amount2Req;
      costCur1 = Math.ceil(price * buyAmount2);
      if (cur1 < costCur1) {
        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('Недостатньо Люмін')
          .setDescription(`Потрібно **${costCur1}**, у вас **${cur1}**. Поточна ціна ≈ **${price.toFixed(2)}** Люмін за 1 Русраб.`);
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
    } else if (amount1Req) {
      costCur1 = amount1Req;
      buyAmount2 = Math.floor(costCur1 / price);
      if (buyAmount2 < 1) {
        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('Занадто мала сума')
          .setDescription(`За **${costCur1}** Люмін ви отримаєте менше 1 Русраб за поточною ціною (**${price.toFixed(2)}**). Збільште суму.`);
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
      // Spend only the necessary whole cost for the integer amount2 acquired
      costCur1 = Math.ceil(buyAmount2 * price);
      if (cur1 < costCur1) {
        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('Недостатньо Люмін')
          .setDescription(`Потрібно **${costCur1}**, у вас **${cur1}**.`);
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
    }

    // Apply exchange (snapshot price). Using a single update for atomicity.
    const updated = await client.prisma.economyBalance.upsert({
      where: { guildId_userId: { guildId, userId } },
      create: {
        guildId,
        userId,
        cur1: Math.max(0, cur1 - costCur1),
        cur2: cur2 + buyAmount2
      },
      update: { cur1: { decrement: costCur1 }, cur2: { increment: buyAmount2 } },
    });

    const success = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('Обмін успішний')
      .setDescription(`Ви придбали **${buyAmount2}** Русраб за **${costCur1}** Люмін.`)
      .addFields(
        { name: 'Поточна ціна', value: `${price.toFixed(2)} Люмін за 1 Русраб`, inline: false },
        { name: 'Люміни', value: `${updated.cur1}`, inline: true },
        { name: 'Русраб', value: `${updated.cur2}`, inline: true },
      );

    return interaction.reply({ embeds: [success], flags: MessageFlags.Ephemeral });
  }
};
