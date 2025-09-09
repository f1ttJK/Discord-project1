const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gift')
    .setDescription('Подарувати Люмін(и) іншому користувачу')
    .addUserOption(opt => opt
      .setName('to')
      .setDescription('Кому подарувати')
      .setRequired(true)
    )
    .addIntegerOption(opt => opt
      .setName('amount')
      .setDescription('Скільки Люмін передати')
      .setMinValue(1)
      .setRequired(true)
    ),
  guildOnly: true,
  cooldown: 5,

  async execute(interaction, client) {
    const guildId = interaction.guildId;
    const fromId = interaction.user.id;
    const toUser = interaction.options.getUser('to', true);
    const toId = toUser.id;
    const amount = interaction.options.getInteger('amount', true);

    if (toId === fromId) {
      return interaction.reply({ content: 'Не можна дарувати самому собі.', flags: MessageFlags.Ephemeral });
    }
    if (toUser.bot) {
      return interaction.reply({ content: 'Ботам дарувати заборонено.', flags: MessageFlags.Ephemeral });
    }

    // Ensure both rows exist and check balance atomically
    const result = await client.prisma.$transaction(async (tx) => {
      // Ensure FK targets exist
      await tx.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });
      await tx.user.upsert({ where: { id: fromId }, update: {}, create: { id: fromId } });
      await tx.user.upsert({ where: { id: toId },   update: {}, create: { id: toId } });

      const fromBal = await tx.economyBalance.findUnique({
        where: { guildId_userId: { guildId, userId: fromId } },
      });
      const fromCur1 = fromBal?.cur1 ?? 0;
      if (fromCur1 < amount) {
        return { ok: false, reason: 'INSUFFICIENT', from: fromCur1 };
      }

      await tx.economyBalance.upsert({
        where: { guildId_userId: { guildId, userId: fromId } },
        create: {
          guildId,
          userId: fromId,
          cur1: 0,
          cur2: 0
        },
        update: { cur1: { decrement: amount } },
      });
      const updatedTo = await tx.economyBalance.upsert({
        where: { guildId_userId: { guildId, userId: toId } },
        create: {
          guildId,
          userId: toId,
          cur1: amount,
          cur2: 0
        },
        update: { cur1: { increment: amount } },
      });
      const updatedFrom = await tx.economyBalance.findUnique({
        where: { guildId_userId: { guildId, userId: fromId } },
      });
      return { ok: true, updatedFrom, updatedTo };
    });

    if (!result.ok) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('Недостатньо Люмін')
        .setDescription(`Потрібно **${amount}**, у вас **${result.from}**.`);
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('Переказ виконано')
      .setDescription(`Ви передали **${amount}** Люмін(ів) користувачу ${toUser} `)
      .addFields(
        { name: 'Ваші Люміни', value: `${result.updatedFrom.cur1}`, inline: true },
        { name: 'Люміни отримувача', value: `${result.updatedTo.cur1}`, inline: true },
      );

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
