const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const EconomyService = require('../../../services/EconomyService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dice')
    .setDescription('Challenge another member to a dice duel')
    .addUserOption(opt => opt
      .setName('opponent')
      .setDescription('Member you want to challenge')
      .setRequired(true)
    )
    .addIntegerOption(opt => opt
      .setName('amount')
      .setDescription('Stake for the duel')
      .setMinValue(1)
      .setRequired(true)
    ),
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
      return interaction.reply({ content: 'Bots cannot join this game.', flags: MessageFlags.Ephemeral });
    }

    const economy = EconomyService();

    if (!client.games || typeof client.games !== 'object') client.games = {};
    if (!client.games.dice) client.games.dice = { challenges: new Map() };

    for (const ch of client.games.dice.challenges.values()) {
      if (ch.guildId === guildId && (ch.challengerId === challengerId || ch.opponentId === challengerId)) {
        return interaction.reply({ content: 'You already have a pending dice challenge.', flags: MessageFlags.Ephemeral });
      }
      if (ch.guildId === guildId && (ch.challengerId === opponentId || ch.opponentId === opponentId)) {
        return interaction.reply({ content: 'That member already has a pending dice challenge.', flags: MessageFlags.Ephemeral });
      }
    }

    let balA;
    let balB;
    try {
      [balA, balB] = await Promise.all([
        economy.getBalance(guildId, challengerId),
        economy.getBalance(guildId, opponentId),
      ]);
    } catch (e) {
      if (client.logs && typeof client.logs.error === 'function') {
        client.logs.error(`dice balance fetch failed: ${e && e.message ? e.message : String(e)}`);
      }
      return interaction.reply({ content: 'Could not verify balances. Please try again later.', flags: MessageFlags.Ephemeral });
    }
    const balACur1 = (balA && balA.cur1 != null) ? balA.cur1 : 0;
    if (balACur1 < amount) {
      return interaction.reply({ content: 'You do not have enough coins for that stake.', flags: MessageFlags.Ephemeral });
    }
    const balBCur1 = (balB && balB.cur1 != null) ? balB.cur1 : 0;
    if (balBCur1 < amount) {
      return interaction.reply({ content: 'Your opponent does not have enough coins for that stake.', flags: MessageFlags.Ephemeral });
    }

    const challengeId = `${guildId}:${challengerId}:${opponentId}:${Date.now()}`;
    const expiresAt = Date.now() + 60000;

    client.games.dice.challenges.set(challengeId, {
      id: challengeId,
      guildId,
      challengerId,
      opponentId,
      amount,
      messageId: null,
      channelId: interaction.channel.id,
      expiresAt
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Dice duel')
      .setDescription(`<@${challengerId}> challenged <@${opponentId}> for **${amount}** coins. You have 60 seconds to respond.`);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`dice-accept-${challengeId}`).setLabel('Accept').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`dice-decline-${challengeId}`).setLabel('Decline').setStyle(ButtonStyle.Danger)
    );

    const reply = await interaction.reply({ embeds: [embed], components: [row] });
    const saved = client.games.dice.challenges.get(challengeId);
    if (saved) {
      saved.messageId = (reply && reply.id) ? reply.id : (await interaction.fetchReply()).id;
    }

    setTimeout(async () => {
      const ch = client.games.dice.challenges.get(challengeId);
      if (!ch) return;
      if (Date.now() >= ch.expiresAt) {
        client.games.dice.challenges.delete(challengeId);
        try {
          await interaction.editReply({ content: 'The challenge expired.', embeds: [], components: [] });
        } catch {}
      }
    }, 61000);
  }
};

