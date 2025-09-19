const { EmbedBuilder, MessageFlags } = require('discord.js');
const EconomyService = require('../../services/EconomyService');

module.exports = {
  customId: 'dice',

  /**
   * @param {import('discord.js').ButtonInteraction} interaction
   * @param {string[]} args args[0]=action('accept'|'decline'), args[1]=challengeId
   * @param {import('discord.js').Client} client
   */
  async execute(interaction, args, client) {
    const action = args[0];
    const challengeId = args[1];

    if (!client.games || typeof client.games !== 'object') client.games = {};
    if (!client.games.dice) client.games.dice = { challenges: new Map() };
    const challenge = client.games.dice.challenges.get(challengeId);

    if (!challenge) {
      return interaction.reply({ content: 'This dice challenge no longer exists.', flags: MessageFlags.Ephemeral });
    }

    if (interaction.user.id !== challenge.opponentId) {
      return interaction.reply({ content: 'Only the invited opponent can respond.', flags: MessageFlags.Ephemeral });
    }

    if (Date.now() >= challenge.expiresAt) {
      client.games.dice.challenges.delete(challengeId);
      try {
        await interaction.update({ content: 'The challenge expired.', embeds: [], components: [] });
      } catch {}
      return;
    }

    if (action === 'decline') {
      client.games.dice.challenges.delete(challengeId);
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('Challenge declined')
        .setDescription(`<@${challenge.opponentId}> declined the duel from <@${challenge.challengerId}>.`);
      try {
        await interaction.update({ embeds: [embed], components: [] });
      } catch {}
      return;
    }

    if (action !== 'accept') {
      return interaction.reply({ content: 'Unknown action.', flags: MessageFlags.Ephemeral });
    }

    const guildId = challenge.guildId;
    const aId = challenge.challengerId;
    const bId = challenge.opponentId;
    const stake = challenge.amount;
    const economy = EconomyService();

    let balA;
    let balB;
    try {
      [balA, balB] = await Promise.all([
        economy.getBalance(guildId, aId),
        economy.getBalance(guildId, bId),
      ]);
    } catch (e) {
      client.logs.error(`dice balance fetch (accept) failed: ${e.message}`);
      return interaction.reply({ content: 'Could not verify balances. Please try again later.', flags: MessageFlags.Ephemeral });
    }

    const balACur1 = (balA && balA.cur1 != null) ? balA.cur1 : 0;
    const balBCur1 = (balB && balB.cur1 != null) ? balB.cur1 : 0;
    if (balACur1 < stake || balBCur1 < stake) {
      client.games.dice.challenges.delete(challengeId);
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('Insufficient balance')
        .setDescription('The challenge was cancelled due to insufficient balance.');
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    const rollDuel = () => {
      let tries = 5;
      while (tries-- > 0) {
        const a = 1 + Math.floor(Math.random() * 6);
        const b = 1 + Math.floor(Math.random() * 6);
        if (a !== b) return { a, b, draw: false };
        if (tries === 0) return { a, b, draw: true };
      }
    };

    const duel = rollDuel();
    client.games.dice.challenges.delete(challengeId);

    if (duel.draw) {
      const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('It is a draw')
        .setDescription(`Both players rolled **${duel.a}**.`);
      try { await interaction.update({ embeds: [embed], components: [] }); } catch {}
      return;
    }

    const winnerId = duel.a > duel.b ? aId : bId;
    const loserId = duel.a > duel.b ? bId : aId;
    const economyResult = await economy.transaction(guildId, [
      { userId: winnerId, delta: stake },
      { userId: loserId, delta: -stake },
    ]).catch(e => e);

    if (economyResult instanceof Error || economyResult?.code === 'INSUFFICIENT_FUNDS') {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('Not enough coins')
        .setDescription('One of the players no longer has enough coins for the stake.');
      try { await interaction.update({ embeds: [embed], components: [] }); } catch {}
      return;
    }

    const balances = economyResult;
    const aObj = balances && balances[String(aId)] ? balances[String(aId)] : {};
    const bObj = balances && balances[String(bId)] ? balances[String(bId)] : {};
    const finalA = Number(aObj.cur1 != null ? aObj.cur1 : 0);
    const finalB = Number(bObj.cur1 != null ? bObj.cur1 : 0);

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('Dice duel result')
      .setDescription(`<@${aId}> rolled **${duel.a}**, <@${bId}> rolled **${duel.b}**. Winner: <@${winnerId}>.`)
      .addFields(
        { name: 'Challenger balance', value: `${finalA}`, inline: true },
        { name: 'Opponent balance', value: `${finalB}`, inline: true }
      );

    try {
      await interaction.update({ embeds: [embed], components: [] });
    } catch {}
  }
};
