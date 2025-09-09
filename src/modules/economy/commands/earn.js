const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('earn')
    .setDescription('Отримати Люміни (із затримкою)')
    .addIntegerOption(opt => opt
      .setName('amount')
      .setDescription('Скільки отримати (за замовчуванням 10)')
      .setMinValue(1)
      .setRequired(false)
    ),
  guildOnly: true,
  cooldown: 3600, // 1 час кулдаун на пользователя (используется вашим InteractionHandler)

  async execute(interaction, client) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const amount = interaction.options.getInteger('amount') ?? 10;

    // Ensure FK targets exist
    await client.prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });
    await client.prisma.user.upsert({ where: { id: userId }, update: {}, create: { id: userId } });

    // get or create balance row
    const balance = await client.prisma.economyBalance.upsert({
      where: { guildId_userId: { guildId, userId } },
      create: {
        guildId,
        userId,
        cur1: amount,
        cur2: 0
      },
      update: { cur1: { increment: amount } },
    });

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('Нарахування')
      .setDescription(`Ви отримали **+${amount}** Люмінів.`)
      .addFields(
        { name: 'Люміни', value: `${balance.cur1}`, inline: true },
        { name: 'Русраб', value: `${balance.cur2}`, inline: true },
      );

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
