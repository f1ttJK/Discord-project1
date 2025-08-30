const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

module.exports = {
  // Base ID used by ComponentHandler.parseCustomId (split by '-')
  customId: 'dice',

  /**
   * @param {import('discord.js').ButtonInteraction} interaction
   * @param {string[]} args args[0]=action('accept'|'decline'), args[1]=challengeId
   * @param {import('discord.js').Client} client
   */
  async execute(interaction, args, client) {
    const action = args[0];
    const challengeId = args[1];

    client.games ??= {};
    client.games.dice ??= { challenges: new Map() };
    const challenge = client.games.dice.challenges.get(challengeId);

    if (!challenge) {
      return interaction.reply({ content: 'Цей виклик вже неактивний або прострочений.', flags: MessageFlags.Ephemeral });
    }

    // Only the invited opponent can act
    if (interaction.user.id !== challenge.opponentId) {
      return interaction.reply({ content: 'Тільки запрошений гравець може відповісти на виклик.', flags: MessageFlags.Ephemeral });
    }

    // Expired?
    if (Date.now() >= challenge.expiresAt) {
      client.games.dice.challenges.delete(challengeId);
      try {
        await interaction.update({ content: 'Час вичерпано. Виклик скасовано.', embeds: [], components: [] });
      } catch {}
      return;
    }

    if (action === 'decline') {
      client.games.dice.challenges.delete(challengeId);
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('Відхилено')
        .setDescription(`<@${challenge.opponentId}> відхилив(ла) виклик у кості від <@${challenge.challengerId}>.`);
      try {
        await interaction.update({ embeds: [embed], components: [] });
      } catch {}
      return;
    }

    if (action !== 'accept') {
      return interaction.reply({ content: 'Невідома дія.', flags: MessageFlags.Ephemeral });
    }

    // Accept: run game within a transaction with final balance checks
    const guildId = challenge.guildId;
    const aId = challenge.challengerId;
    const bId = challenge.opponentId;
    const stake = challenge.amount;

    // Helper to roll dice until not tie (max 5 retries), otherwise draw
    const rollDuel = () => {
      let tries = 5;
      while (tries-- > 0) {
        const a = 1 + Math.floor(Math.random() * 6);
        const b = 1 + Math.floor(Math.random() * 6);
        if (a !== b) return { a, b, draw: false };
        if (tries === 0) return { a, b, draw: true };
      }
    };

    let result;
    try {
      result = await client.prisma.$transaction(async (tx) => {
        // Ensure rows and check balances
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

        const aCur1 = balA.cur1;
        const bCur1 = balB.cur1;
        if (aCur1 < stake || bCur1 < stake) {
          return { ok: false, reason: 'INSUFFICIENT', aCur1, bCur1 };
        }

        const duel = rollDuel();
        if (duel.draw) {
          return { ok: false, reason: 'DRAW', a: duel.a, b: duel.b };
        }

        const aWins = duel.a > duel.b;
        if (aWins) {
          await tx.economyBalance.update({
            where: { guildId_userId: { guildId, userId: aId } },
            data: { cur1: { increment: stake } }
          });
          await tx.economyBalance.update({
            where: { guildId_userId: { guildId, userId: bId } },
            data: { cur1: { decrement: stake } }
          });
        } else {
          await tx.economyBalance.update({
            where: { guildId_userId: { guildId, userId: aId } },
            data: { cur1: { decrement: stake } }
          });
          await tx.economyBalance.update({
            where: { guildId_userId: { guildId, userId: bId } },
            data: { cur1: { increment: stake } }
          });
        }

        const [finalA, finalB] = await Promise.all([
          tx.economyBalance.findUnique({ where: { guildId_userId: { guildId, userId: aId } } }),
          tx.economyBalance.findUnique({ where: { guildId_userId: { guildId, userId: bId } } })
        ]);

        return { ok: true, aWins, a: duel.a, b: duel.b, finalA, finalB };
      });
    } catch (e) {
      client.logs?.error?.(`dice duel tx error: ${e.message}`);
      return interaction.reply({ content: 'Сталася помилка під час обробки дуелі.', flags: MessageFlags.Ephemeral });
    }

    // Clear challenge and render result
    client.games.dice.challenges.delete(challengeId);

    if (!result.ok) {
      if (result.reason === 'INSUFFICIENT') {
        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('Дуель скасовано')
          .setDescription('Недостатньо Люмін у одного з гравців.');
        try { await interaction.update({ embeds: [embed], components: [] }); } catch {}
        return;
      }
      if (result.reason === 'DRAW') {
        const embed = new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle('Нічия')
          .addFields(
            { name: 'Кубик викликав', value: `${result.a}` },
            { name: 'Кубик опонента', value: `${result.b}` },
          );
        try { await interaction.update({ embeds: [embed], components: [] }); } catch {}
        return;
      }
      return;
    }

    const winnerId = result.aWins ? aId : bId;
    const loserId = result.aWins ? bId : aId;

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('Результат дуелі в кості')
      .setDescription(`<@${aId}> кинув(ла) **${result.a}**, <@${bId}> кинув(ла) **${result.b}**.\nПереможець: <@${winnerId}>\nВиграш: **${challenge.amount}** Люмін`)
      .addFields(
        { name: `Баланс ${aId === winnerId ? 'переможця' : 'гравця A'}`, value: `${result.finalA.cur1}`, inline: true },
        { name: `Баланс ${bId === winnerId ? 'переможця' : 'гравця B'}`, value: `${result.finalB.cur1}`, inline: true },
      );

    try {
      await interaction.update({ embeds: [embed], components: [] });
    } catch {}
  }
};
