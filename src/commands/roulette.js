const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

const REDS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function spinWheel() {
  // European single-zero 0..36 uniform
  return Math.floor(Math.random() * 37);
}

function outcomeColor(n) {
  if (n === 0) return 'green';
  return REDS.has(n) ? 'red' : 'black';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('Рулетка: зробіть ставку та крутіть колесо')
    .addStringOption(o => o.setName('bet')
      .setDescription('Тип ставки')
      .addChoices(
        { name: 'red', value: 'red' },
        { name: 'black', value: 'black' },
        { name: 'even', value: 'even' },
        { name: 'odd', value: 'odd' },
        { name: 'zero', value: 'zero' },
        { name: 'number', value: 'number' }
      )
      .setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Ставка (Люміни)').setMinValue(1).setRequired(true))
    .addIntegerOption(o => o.setName('number').setDescription('Число 0-36 (для ставки number)').setMinValue(0).setMaxValue(36)),
  guildOnly: true,
  cooldown: 3,

  async execute(interaction, client) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const betType = interaction.options.getString('bet', true);
    const num = interaction.options.getInteger('number');
    const amount = interaction.options.getInteger('amount', true);

    if (betType === 'number' && (num == null || num < 0 || num > 36)) {
      return interaction.reply({ content: 'Вкажіть коректне число 0-36 для ставки number.', flags: MessageFlags.Ephemeral });
    }
    if (betType !== 'number' && num != null) {
      return interaction.reply({ content: 'Поле number використовується лише для ставки "number".', flags: MessageFlags.Ephemeral });
    }

    const bal = await client.prisma.economyBalance.findUnique({ where: { guildId_userId: { guildId, userId } } });
    if ((bal?.cur1 ?? 0) < amount) return interaction.reply({ content: 'Недостатньо Люмін для цієї ставки.', flags: MessageFlags.Ephemeral });

    const roll = spinWheel();
    const color = outcomeColor(roll);

    let won = false;
    let payoutMultiplier = 0;

    switch (betType) {
      case 'red': won = (color === 'red'); payoutMultiplier = 1; break;
      case 'black': won = (color === 'black'); payoutMultiplier = 1; break;
      case 'even': won = (roll !== 0 && roll % 2 === 0); payoutMultiplier = 1; break;
      case 'odd': won = (roll % 2 === 1); payoutMultiplier = 1; break;
      case 'zero': won = (roll === 0); payoutMultiplier = 35; break;
      case 'number': won = (roll === num); payoutMultiplier = 35; break;
      default:
        return interaction.reply({ content: 'Невідомий тип ставки.', flags: MessageFlags.Ephemeral });
    }

    const delta = won ? amount * payoutMultiplier : -amount;

    try {
      await client.prisma.$transaction(async (tx) => {
        await tx.economyBalance.upsert({
          where: { guildId_userId: { guildId, userId } },
          create: {
            guildId,
            userId,
            cur1: 0, cur2: 0
          },
          update: {},
        });
        if (delta !== 0) {
          await tx.economyBalance.update({
            where: { guildId_userId: { guildId, userId } },
            data: { cur1: delta > 0 ? { increment: delta } : { decrement: -delta } }
          });
        }
      });
    } catch (e) {
      client.logs?.error?.(`roulette tx error: ${e.message}`);
      return interaction.reply({ content: 'Помилка при обробці ставки.', flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
      .setColor(won ? 0x57F287 : 0xED4245)
      .setTitle('Рулетка — результат')
      .addFields(
        { name: 'Випало', value: `${roll} (${color})`, inline: true },
        { name: 'Ваша ставка', value: betType === 'number' ? `number=${num}` : betType, inline: true },
        { name: 'Виграш', value: won ? `+${amount * payoutMultiplier}` : `-${amount}`, inline: true }
      );

    return interaction.reply({ embeds: [embed] });
  }
};
