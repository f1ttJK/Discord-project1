const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const EconomyService = require('../../../services/EconomyService');

const REDS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function spinWheel() {
  return Math.floor(Math.random() * 37);
}

function outcomeColor(n) {
  if (n === 0) return 'green';
  return REDS.has(n) ? 'red' : 'black';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('Spin the roulette wheel for coins')
    .addStringOption(o => o.setName('bet')
      .setDescription('What you want to bet on')
      .addChoices(
        { name: 'red', value: 'red' },
        { name: 'black', value: 'black' },
        { name: 'even', value: 'even' },
        { name: 'odd', value: 'odd' },
        { name: 'zero', value: 'zero' },
        { name: 'exact number', value: 'number' }
      )
      .setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Stake in coins').setMinValue(1).setRequired(true))
    .addIntegerOption(o => o.setName('number').setDescription('Exact number 0-36 (required for number bet)').setMinValue(0).setMaxValue(36)),
  guildOnly: true,
  cooldown: 3,

  async execute(interaction, client) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const betType = interaction.options.getString('bet', true);
    const num = interaction.options.getInteger('number');
    const amount = interaction.options.getInteger('amount', true);

    if (betType === 'number' && (num == null || num < 0 || num > 36)) {
      return interaction.reply({ content: 'Please provide a number between 0 and 36 for this bet.', flags: MessageFlags.Ephemeral });
    }
    if (betType !== 'number' && num != null) {
      return interaction.reply({ content: 'The number option is only used for the "exact number" bet.', flags: MessageFlags.Ephemeral });
    }

    const economy = EconomyService();
    let balance;
    try {
      balance = await economy.getBalance(guildId, userId);
    } catch (e) {
      if (client.logs && typeof client.logs.error === 'function') {
        client.logs.error(`roulette balance fetch failed: ${e && e.message ? e.message : String(e)}`);
      }
      return interaction.reply({ content: 'Could not verify your balance. Please try again later.', flags: MessageFlags.Ephemeral });
    }

    const balCur1 = (balance && balance.cur1 != null) ? balance.cur1 : 0;
    if (balCur1 < amount) {
      return interaction.reply({ content: 'You do not have enough coins for that bet.', flags: MessageFlags.Ephemeral });
    }

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
        return interaction.reply({ content: 'Unsupported bet type.', flags: MessageFlags.Ephemeral });
    }

    const delta = won ? amount * payoutMultiplier : -amount;
    if (delta !== 0) {
      try {
        await economy.transaction(guildId, [{ userId, delta }]);
      } catch (e) {
        if (e && e.code === 'INSUFFICIENT_FUNDS') {
          return interaction.reply({ content: 'Balance changed during the spin. Bet cancelled.', flags: MessageFlags.Ephemeral });
        }
        if (client.logs && typeof client.logs.error === 'function') {
          client.logs.error(`roulette transaction failed: ${e && e.message ? e.message : String(e)}`);
        }
        return interaction.reply({ content: 'Could not settle the bet. Please try again later.', flags: MessageFlags.Ephemeral });
      }
    }

    const embed = new EmbedBuilder()
      .setColor(won ? 0x57F287 : 0xED4245)
      .setTitle('Roulette spin result')
      .addFields(
        { name: 'Number', value: `${roll} (${color})`, inline: true },
        { name: 'Your bet', value: betType === 'number' ? `number=${num}` : betType, inline: true },
        { name: 'Payout', value: won ? `+${amount * payoutMultiplier}` : `-${amount}`, inline: true }
      );

    return interaction.reply({ embeds: [embed] });
  }
};
