const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const EconomyService = require('../../../services/EconomyService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gift')
    .setDescription('Send your wallet balance to another member')
    .addUserOption(opt => opt
      .setName('to')
      .setDescription('Member who should receive the gift')
      .setRequired(true)
    )
    .addIntegerOption(opt => opt
      .setName('amount')
      .setDescription('Amount of coins to send')
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
      return interaction.reply({ content: 'You cannot send a gift to yourself.', flags: MessageFlags.Ephemeral });
    }
    if (toUser.bot) {
      return interaction.reply({ content: 'Bots cannot receive gifts.', flags: MessageFlags.Ephemeral });
    }

    const economy = EconomyService();
    let balances;
    try {
      balances = await economy.transfer(guildId, fromId, toId, amount);
    } catch (e) {
      if (e?.code === 'INSUFFICIENT_FUNDS') {
        const available = Number(e?.details?.balance ?? 0);
        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('Not enough coins')
          .setDescription(`You tried to send **${amount}**, but only **${available}** is available.`);
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
      client.logs?.error?.(`gift transaction failed: ${e?.message}`);
      return interaction.reply({ content: 'Could not process the gift right now. Please try again later.', flags: MessageFlags.Ephemeral });
    }

    const updatedFrom = balances?.[String(fromId)] ?? {};
    const updatedTo = balances?.[String(toId)] ?? {};

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('Gift sent')
      .setDescription(`You sent **${amount}** coins to ${toUser}.`)
      .addFields(
        { name: 'Your balance', value: `${Number(updatedFrom.cur1 ?? 0)}`, inline: true },
        { name: `${toUser.username}'s balance`, value: `${Number(updatedTo.cur1 ?? 0)}`, inline: true },
      );

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
