const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

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
    const challengeId = args[1];
    const choice = args[2];

    client.games ??= {};
    client.games.rps ??= { challenges: new Map() };
    const challenge = client.games.rps.challenges.get(challengeId);

    if (!challenge) return interaction.reply({ content: 'Цей виклик вже неактивний.', flags: MessageFlags.Ephemeral });

    // Accept/Decline phase
    if (action === 'accept' || action === 'decline') {
      if (interaction.user.id !== challenge.opponentId) {
        return interaction.reply({ content: 'Тільки запрошений гравець може відповісти на виклик.', flags: MessageFlags.Ephemeral });
      }
      if (Date.now() >= challenge.expiresAt) {
        client.games.rps.challenges.delete(challengeId);
        try { await interaction.update({ content: 'Час вичерпано. Виклик скасовано.', components: [], embeds: [] }); } catch {}
        return;
      }
      if (action === 'decline') {
        client.games.rps.challenges.delete(challengeId);
        const embed = new EmbedBuilder().setColor(0xED4245).setTitle('Відхилено').setDescription(`<@${challenge.opponentId}> відхилив(ла) виклик RPS від <@${challenge.challengerId}>.`);
        try { await interaction.update({ embeds: [embed], components: [] }); } catch {}
        return;
      }
      // Accepted -> show choice buttons
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rps-choose-${challengeId}-rock`).setLabel('Камінь').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`rps-choose-${challengeId}-paper`).setLabel('Папір').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`rps-choose-${challengeId}-scissors`).setLabel('Ножиці').setStyle(ButtonStyle.Secondary),
      );
      const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('RPS: Зробіть вибір').setDescription(`Ставка: **${challenge.amount}** Люмін\nГравці: <@${challenge.challengerId}> vs <@${challenge.opponentId}>`);
      try { await interaction.update({ embeds: [embed], components: [row] }); } catch {}
      return;
    }

    // Choosing phase
    if (action === 'choose') {
      if (![challenge.challengerId, challenge.opponentId].includes(interaction.user.id)) {
        return interaction.reply({ content: 'Ви не учасник цього матчу.', flags: MessageFlags.Ephemeral });
      }
      if (!['rock', 'paper', 'scissors'].includes(choice)) {
        return interaction.reply({ content: 'Невірний вибір.', flags: MessageFlags.Ephemeral });
      }

      // Record choice
      if (interaction.user.id === challenge.challengerId) {
        if (challenge.aChoice) return interaction.reply({ content: 'Ви вже зробили вибір.', flags: MessageFlags.Ephemeral });
        challenge.aChoice = choice;
      } else {
        if (challenge.bChoice) return interaction.reply({ content: 'Ви вже зробили вибір.', flags: MessageFlags.Ephemeral });
        challenge.bChoice = choice;
      }

      // Update message to indicate that a choice was made (without revealing)
      try { await interaction.deferUpdate(); } catch {}

      // If both chosen -> settle
      if (challenge.aChoice && challenge.bChoice) {
        const guildId = challenge.guildId;
        const aId = challenge.challengerId;
        const bId = challenge.opponentId;
        const stake = challenge.amount;

        let result;
        try {
          result = await client.prisma.$transaction(async (tx) => {
            // Ensure FK targets exist
            await tx.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });
            await tx.user.upsert({ where: { id: aId }, update: {}, create: { id: aId } });
            await tx.user.upsert({ where: { id: bId }, update: {}, create: { id: bId } });
            const [balA, balB] = await Promise.all([
              tx.economyBalance.upsert({
                where: { guildId_userId: { guildId, userId: aId } },
                create: {
                  guildId,
                  userId: aId,
                  cur1: 0, cur2: 0
                },
                update: {},
              }),
              tx.economyBalance.upsert({
                where: { guildId_userId: { guildId, userId: bId } },
                create: {
                  guildId,
                  userId: bId,
                  cur1: 0, cur2: 0
                },
                update: {},
              })
            ]);

            if (balA.cur1 < stake || balB.cur1 < stake) {
              return { ok: false, reason: 'INSUFFICIENT' };
            }

            const aC = challenge.aChoice;
            const bC = challenge.bChoice;
            if (aC === bC) {
              return { ok: false, reason: 'DRAW', aC, bC };
            }

            const aWins = beats[aC] === bC;
            if (aWins) {
              await tx.economyBalance.update({ where: { guildId_userId: { guildId, userId: aId } }, data: { cur1: { increment: stake } } });
              await tx.economyBalance.update({ where: { guildId_userId: { guildId, userId: bId } }, data: { cur1: { decrement: stake } } });
            } else {
              await tx.economyBalance.update({ where: { guildId_userId: { guildId, userId: aId } }, data: { cur1: { decrement: stake } } });
              await tx.economyBalance.update({ where: { guildId_userId: { guildId, userId: bId } }, data: { cur1: { increment: stake } } });
            }

            const [finalA, finalB] = await Promise.all([
              tx.economyBalance.findUnique({ where: { guildId_userId: { guildId, userId: aId } } }),
              tx.economyBalance.findUnique({ where: { guildId_userId: { guildId, userId: bId } } })
            ]);

            return { ok: true, aWins, aC, bC, finalA, finalB };
          });
        } catch (e) {
          client.logs?.error?.(`rps tx error: ${e.message}`);
          return;
        }

        client.games.rps.challenges.delete(challengeId);

        if (!result.ok) {
          if (result.reason === 'INSUFFICIENT') {
            const embed = new EmbedBuilder().setColor(0xED4245).setTitle('Матч скасовано').setDescription('Недостатньо Люмін у одного з гравців.');
            try { await interaction.editReply({ embeds: [embed], components: [] }); } catch {}
            return;
          }
          if (result.reason === 'DRAW') {
            const embed = new EmbedBuilder().setColor(0xFEE75C).setTitle('Нічия').setDescription(`Вибори: <@${aId}> — ${result.aC}, <@${bId}> — ${result.bC}`);
            try { await interaction.editReply({ embeds: [embed], components: [] }); } catch {}
            return;
          }
        }

        const winnerId = result.aWins ? aId : bId;
        const loserId = result.aWins ? bId : aId;
        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('RPS: Результат')
          .setDescription(`<@${aId}> обрав(ла) **${result.aC}**, <@${bId}> обрав(ла) **${result.bC}**\nПереможець: <@${winnerId}>\nВиграш: **${stake}** Люмін`)
          .addFields(
            { name: `Баланс A`, value: `${result.finalA.cur1}`, inline: true },
            { name: `Баланс B`, value: `${result.finalB.cur1}`, inline: true }
          );
        try { await interaction.editReply({ embeds: [embed], components: [] }); } catch {}
      }
    }
  }
};
