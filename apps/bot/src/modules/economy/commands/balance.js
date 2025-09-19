const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { apiRequest } = require('../../../services/ApiClient');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Show your wallet balances and the current exchange price'),
  guildOnly: true,
  cooldown: 3,

  async execute(interaction, client) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    let cur1 = 0;
    let cur2 = 0;
    let price = 100;
    try {
      const data = await apiRequest(`/v1/economy/${guildId}/${userId}/balance`);
      cur1 = Number(data?.cur1 ?? 0);
      cur2 = Number(data?.cur2 ?? 0);
      price = Number(data?.price ?? 100);
    } catch (e) {
      return interaction.reply({ content: `Could not fetch your balance from the API: ${e.message}`, flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Wallet balance')
      .setDescription(`Coins: ${cur1}\nGems: ${cur2}`)
      .setFooter({ text: `Current price: 1 gem = ${price.toFixed(2)} coins` });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
