const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { apiRequest } = require('../../../services/ApiClient');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('earn')
    .setDescription('Earn a configurable amount of coins')
    .addIntegerOption(opt => opt
      .setName('amount')
      .setDescription('Amount of coins to request (default 10)')
      .setMinValue(1)
      .setRequired(false)
    ),
  guildOnly: true,
  cooldown: 3600,

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const amount = interaction.options.getInteger('amount') ?? 10;
    let result;
    try {
      result = await apiRequest(`/v1/economy/${guildId}/${userId}/earn`, {
        method: 'POST',
        body: { amount },
      });
    } catch (e) {
      return interaction.reply({ content: `Unable to earn coins right now: ${e.message}`, flags: MessageFlags.Ephemeral });
    }

    const added = Number(result?.added ?? amount);
    const cur1 = Number(result?.cur1 ?? 0);
    const cur2 = Number(result?.cur2 ?? 0);

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('Coins earned')
      .setDescription(`You received **+${added}** coins.`)
      .addFields(
        { name: 'Coins', value: `${cur1}`, inline: true },
        { name: 'Gems', value: `${cur2}`, inline: true }
      );

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
