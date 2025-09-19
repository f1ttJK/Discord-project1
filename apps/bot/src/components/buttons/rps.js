const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const EconomyService = require('../../services/EconomyService');

const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

module.exports = {
  customId: 'rps',

  /**
   * @param {import('discord.js').ButtonInteraction} interaction
   * @param {string[]} args args[0]=action('accept'|'decline'|'choose'), args[1]=challengeId, args[2]=choice?
   * @param {import('discord.js').Client} client
   */
  async execute(interaction, args, client) {
    const action = args[0];

    client.games ??= {};
    client.games.rps ??= { challenges: new Map() };

    if (action === 'accept' || action === 'decline') {
      const challengeId = args[1];
      const challenge = client.games.rps.challenges.get(challengeId);
      if (!challenge) return interaction.reply({ content: 'This challenge no longer exists.', flags: MessageFlags.Ephemeral });

      if (interaction.user.id !== challenge.opponentId) {
        return interaction.reply({ content: 'Only the invited opponent can respond.', flags: MessageFlags.Ephemeral });
      }

      if (Date.now() >= challenge.expiresAt) {
        client.games.rps.challenges.delete(challengeId);
        try { await interaction.update({ content: 'The challenge expired.', components: [], embeds: [] }); } catch {}
        return;
      }

      if (action === 'decline') {
        client.games.rps.challenges.delete(challengeId);
        const embed = new EmbedBuilder().setColor(0xED4245).setTitle('Challenge declined').setDescription(`<@${challenge.opponentId}> declined the match from <@${challenge.challengerId}>.`);
        try { await interaction.update({ embeds: [embed], components: [] }); } catch {}
        return;
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rps-choose-${challengeId}-rock`).setLabel('Rock').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`rps-choose-${challengeId}-paper`).setLabel('Paper').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`rps-choose-${challengeId}-scissors`).setLabel('Scissors').setStyle(ButtonStyle.Secondary),
      );
      const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('Rock Paper Scissors').setDescription(`Stake: **${challenge.amount}** coins\nPlayers: <@${challenge.challengerId}> vs <@${challenge.opponentId}>`);
      try { await interaction.update({ embeds: [embed], components: [row] }); } catch {}
      return;
    }

    if (action === 'choose') {
      const challengeId = args[1];
      const choice = args[2];
      const challenge = client.games.rps.challenges.get(challengeId);
      if (!challenge) return interaction.reply({ content: 'This challenge no longer exists.', flags: MessageFlags.Ephemeral });
      if (![challenge.challengerId, challenge.opponentId].includes(interaction.user.id)) {
        return interaction.reply({ content: 'Only the duel participants can make a choice.', flags: MessageFlags.Ephemeral });
      }
      if (!['rock', 'paper', 'scissors'].includes(choice)) {
        return interaction.reply({ content: 'Unknown choice.', flags: MessageFlags.Ephemeral });
      }

      if (interaction.user.id === challenge.challengerId) {
        if (challenge.aChoice) return interaction.reply({ content: 'You already selected your move.', flags: MessageFlags.Ephemeral });
        challenge.aChoice = choice;
      } else {
        if (challenge.bChoice) return interaction.reply({ content: 'You already selected your move.', flags: MessageFlags.Ephemeral });
        challenge.bChoice = choice;
      }

      try { await interaction.deferUpdate(); } catch {}

      if (challenge.aChoice && challenge.bChoice) {
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
          client.logs?.error?.(`rps balance fetch failed: ${e.message}`);
          client.games.rps.challenges.delete(challengeId);
          return interaction.editReply({ content: 'Could not verify balances. Please try again later.', components: [], embeds: [] });
        }

        if ((balA?.cur1 ?? 0) < stake || (balB?.cur1 ?? 0) < stake) {
          client.games.rps.challenges.delete(challengeId);
          const embed = new EmbedBuilder().setColor(0xED4245).setTitle('Not enough coins').setDescription('One of the players no longer has enough coins for the stake.');
          try { await interaction.editReply({ embeds: [embed], components: [] }); } catch {}
          return;
        }

        const aChoice = challenge.aChoice;
        const bChoice = challenge.bChoice;
        client.games.rps.challenges.delete(challengeId);

        if (aChoice === bChoice) {
          const embed = new EmbedBuilder().setColor(0xFEE75C).setTitle('It is a draw').setDescription(`Both players picked **${aChoice}**.`);
          try { await interaction.editReply({ embeds: [embed], components: [] }); } catch {}
          return;
        }

        const aWins = beats[aChoice] === bChoice;
        const winnerId = aWins ? aId : bId;
        const loserId = aWins ? bId : aId;

        let balances;
        try {
          balances = await economy.transaction(guildId, [
            { userId: winnerId, delta: stake },
            { userId: loserId, delta: -stake },
          ]);
        } catch (e) {
          if (e?.code === 'INSUFFICIENT_FUNDS') {
            const embed = new EmbedBuilder().setColor(0xED4245).setTitle('Not enough coins').setDescription('One of the players no longer has enough coins for the stake.');
            try { await interaction.editReply({ embeds: [embed], components: [] }); } catch {}
            return;
          }
          client.logs?.error?.(`rps transaction failed: ${e?.message}`);
          return interaction.editReply({ content: 'Could not settle the duel. Please try again later.', components: [], embeds: [] });
        }

        const finalA = Number(balances?.[String(aId)]?.cur1 ?? 0);
        const finalB = Number(balances?.[String(bId)]?.cur1 ?? 0);

        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('Rock Paper Scissors result')
          .setDescription(`<@${aId}> picked **${aChoice}**, <@${bId}> picked **${bChoice}**. Winner: <@${winnerId}>`)
          .addFields(
            { name: 'Challenger balance', value: `${finalA}`, inline: true },
            { name: 'Opponent balance', value: `${finalB}`, inline: true }
          );
        try { await interaction.editReply({ embeds: [embed], components: [] }); } catch {}
      }
      return;
    }

    return interaction.reply({ content: 'Unknown RPS action.', flags: MessageFlags.Ephemeral });
  }
};
