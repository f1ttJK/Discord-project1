const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { apiRequest } = require('../../../services/ApiClient');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('weekly')
    .setDescription('Claim your weekly coin reward'),
  guildOnly: true,
  cooldown: 3,

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    try {
      const res = await apiRequest(`/v1/economy/${guildId}/${userId}/weekly`, { method: 'POST' });
      const added = Number(res?.added ?? 0);
      const cur1 = Number(res?.cur1 ?? 0);
      const cur2 = Number(res?.cur2 ?? 0);
      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('Weekly reward claimed')
        .setDescription(`You received **+${added}** coins.`)
        .addFields(
          { name: 'Coins', value: `${cur1}`, inline: true },
          { name: 'Gems', value: `${cur2}`, inline: true },
        );
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } catch (e) {
      if (e?.code === 'WEEKLY_COOLDOWN') {
        return interaction.reply({ content: 'Weekly reward is still on cooldown. Try again later.', flags: MessageFlags.Ephemeral });
      }
      return interaction.reply({ content: `Failed to claim the weekly reward: ${e.message}`, flags: MessageFlags.Ephemeral });
    }
  }
};
