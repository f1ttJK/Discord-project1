const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rps')
    .setDescription('Challenge another member to Rock Paper Scissors')
    .addUserOption(opt => opt.setName('opponent').setDescription('Member you want to challenge').setRequired(true))
    .addIntegerOption(opt => opt.setName('amount').setDescription('Stake for the match').setMinValue(1).setRequired(true)),
  guildOnly: true,
  cooldown: 5,

  async execute(interaction, client) {
    const guildId = interaction.guildId;
    const challengerId = interaction.user.id;
    const opponent = interaction.options.getUser('opponent', true);
    const opponentId = opponent.id;
    const amount = interaction.options.getInteger('amount', true);

    if (opponentId === challengerId) {
      return interaction.reply({ content: 'You cannot challenge yourself.', flags: MessageFlags.Ephemeral });
    }
    if (opponent.bot) {
      return interaction.reply({ content: 'Bots cannot play Rock Paper Scissors.', flags: MessageFlags.Ephemeral });
    }

    if (!client.games || typeof client.games !== 'object') client.games = {};
    if (!client.games.rps) client.games.rps = { challenges: new Map() };

    for (const ch of client.games.rps.challenges.values()) {
      if (ch.guildId === guildId && (ch.challengerId === challengerId || ch.opponentId === challengerId)) {
        return interaction.reply({ content: 'You already have a pending Rock Paper Scissors challenge.', flags: MessageFlags.Ephemeral });
      }
      if (ch.guildId === guildId && (ch.challengerId === opponentId || ch.opponentId === opponentId)) {
        return interaction.reply({ content: 'That member already has a pending Rock Paper Scissors challenge.', flags: MessageFlags.Ephemeral });
      }
    }

    const challengeId = `${guildId}:${challengerId}:${opponentId}:${Date.now()}`;
    const expiresAt = Date.now() + 60000;

    client.games.rps.challenges.set(challengeId, {
      id: challengeId,
      guildId,
      challengerId,
      opponentId,
      amount,
      messageId: null,
      channelId: interaction.channel.id,
      expiresAt,
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Rock Paper Scissors')
      .setDescription(`<@${challengerId}> challenged <@${opponentId}> for **${amount}** coins. You have 60 seconds to respond.`);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`rps-accept-${challengeId}`).setLabel('Accept').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`rps-decline-${challengeId}`).setLabel('Decline').setStyle(ButtonStyle.Danger),
    );

    const reply = await interaction.reply({ embeds: [embed], components: [row] });
    const saved = client.games.rps.challenges.get(challengeId);
    if (saved) saved.messageId = (reply && reply.id) ? reply.id : (await interaction.fetchReply()).id;

    setTimeout(async () => {
      const ch = client.games.rps.challenges.get(challengeId);
      if (!ch) return;
      if (Date.now() >= ch.expiresAt) {
        client.games.rps.challenges.delete(challengeId);
        try { await interaction.editReply({ content: 'The challenge expired.', components: [], embeds: [] }); } catch {}
      }
    }, 61000);
  }
};

