const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { apiRequest } = require('../../../services/ApiClient');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('exchange')
    .setDescription('Convert between coins and gems using the current price')
    .addIntegerOption(opt => opt
      .setName('gems')
      .setDescription('Amount of gems to sell for coins')
      .setMinValue(1)
      .setRequired(false)
    )
    .addIntegerOption(opt => opt
      .setName('coins')
      .setDescription('Amount of coins to spend on buying gems')
      .setMinValue(1)
      .setRequired(false)
    ),
  guildOnly: true,
  cooldown: 5,

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const gemsToSell = interaction.options.getInteger('gems');
    const coinsToSpend = interaction.options.getInteger('coins');

    if ((gemsToSell && coinsToSpend) || (!gemsToSell && !coinsToSpend)) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('Invalid usage')
        .setDescription('Specify either `gems` to sell gems for coins or `coins` to buy gems. Use exactly one option.');
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    let price = 0;
    let cur1 = 0;
    let cur2 = 0;
    try {
      const balance = await apiRequest(`/v1/economy/${guildId}/${userId}/balance`);
      price = Number(balance?.price ?? 0);
      cur1 = Number(balance?.cur1 ?? 0);
      cur2 = Number(balance?.cur2 ?? 0);
    } catch (e) {
      return interaction.reply({ content: `Unable to fetch balance: ${e.message}`, flags: MessageFlags.Ephemeral });
    }

    let direction;
    let amount;
    if (gemsToSell) {
      direction = 'cur2_to_cur1';
      amount = gemsToSell;
    } else {
      direction = 'cur1_to_cur2';
      amount = coinsToSpend;
    }

    try {
      const result = await apiRequest(`/v1/economy/${guildId}/${userId}/exchange`, {
        method: 'POST',
        body: { direction, amount },
      });

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('Exchange complete')
        .setDescription(direction === 'cur1_to_cur2'
          ? `Spent **${amount}** coins for gems.`
          : `Sold **${amount}** gems for coins.`)
        .addFields(
          { name: 'Coins', value: `${result.cur1 ?? 0}`, inline: true },
          { name: 'Gems', value: `${result.cur2 ?? 0}`, inline: true },
          { name: 'Current price', value: `1 gem = ${price.toFixed(2)} coins`, inline: true }
        );

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } catch (e) {
      const message = e?.code === 'INSUFFICIENT_CUR1' || e?.code === 'INSUFFICIENT_CUR2'
        ? 'Not enough balance for this exchange.'
        : `Failed to perform the exchange: ${e.message}`;
      return interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
    }
  }
};
