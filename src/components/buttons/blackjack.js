const { EmbedBuilder, MessageFlags } = require('discord.js');

function handValue(cards) {
  let total = 0, aces = 0;
  for (const c of cards) {
    if (c.r === 'A') { aces++; total += 11; }
    else if (['K','Q','J'].includes(c.r)) total += 10;
    else total += parseInt(c.r, 10);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function fmtHand(cards) {
  return cards.map(c => `${c.r}${c.s}`).join(' ');
}

async function settle(interaction, client, session) {
  const { guildId, userId, bet } = session;

  // Dealer draws to 17+
  let dVal = handValue(session.dealer);
  while (dVal < 17) {
    const card = session.deck.pop();
    if (!card) break;
    session.dealer.push(card);
    dVal = handValue(session.dealer);
  }

  const effectiveBet = session.doubled ? bet * 2 : bet;
  const p = handValue(session.player);
  const d = handValue(session.dealer);

  let payout = 0;
  if (p > 21) payout = -effectiveBet;
  else if (d > 21) payout = effectiveBet;
  else if (p > d) payout = effectiveBet;
  else if (p < d) payout = -effectiveBet;
  else payout = 0;

  try {
    await client.prisma.$transaction(async (tx) => {
      await tx.economyBalance.upsert({
        where: { guildId_userId: { guildId, userId } },
        create: {
          guildId,
          userId,
          cur1: 0, cur2: 0
        },
        update: {},
      });
      if (payout !== 0) {
        await tx.economyBalance.update({
          where: { guildId_userId: { guildId, userId } },
          data: { cur1: payout > 0 ? { increment: payout } : { decrement: -payout } }
        });
      }
    });
  } catch (e) {
    client.logs?.error?.(`blackjack button settle error: ${e.message}`);
  }

  const color = payout > 0 ? 0x57F287 : payout < 0 ? 0xED4245 : 0xFEE75C;
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle('Блекджек — результат')
    .setImage('https://i.imgur.com/5PAAPj7.png')
    .addFields(
      { name: 'Ваші карти', value: `${fmtHand(session.player)} (=${handValue(session.player)})`, inline: true },
      { name: 'Карти дилера', value: `${fmtHand(session.dealer)} (=${handValue(session.dealer)})`, inline: true },
      { name: 'Підсумок', value: payout > 0 ? `Ви виграли | +**${payout}** Люміни` : payout < 0 ? `Ви програли | -**${-payout}** Люміни` : 'Пуш' }
    );

  try { await interaction.update({ embeds: [embed], components: [] }); } catch {}

  session.finished = true;
  client.games.blackjack.sessions.delete(`${guildId}:${userId}`);
}

module.exports = {
  customId: 'blackjack',
  /**
   * @param {import('discord.js').ButtonInteraction} interaction
   * @param {string[]} args args[0]=action('hit'|'stand'|'double'), args[1]=sessionId
   * @param {import('discord.js').Client} client
   */
  async execute(interaction, args, client) {
    const action = args[0];
    const sessionId = args[1];

    client.games ??= {};
    client.games.blackjack ??= { sessions: new Map() };

    // sessionId format `${guildId}:${userId}:${ts}`
    const [guildId, userId] = sessionId.split(':');
    const key = `${guildId}:${userId}`;
    const session = client.games.blackjack.sessions.get(key);

    if (!session || session.sessionId !== sessionId) {
      return interaction.reply({ content: 'Сесія не знайдена або завершена.', flags: MessageFlags.Ephemeral });
    }

    if (interaction.user.id !== userId) {
      return interaction.reply({ content: 'Це не ваша сесія.', flags: MessageFlags.Ephemeral });
    }

    if (session.finished) {
      return interaction.reply({ content: 'Сесія вже завершена.', flags: MessageFlags.Ephemeral });
    }

    if (action === 'hit') {
      session.player.push(session.deck.pop());
      const p = handValue(session.player);
      if (p >= 21) {
        // Bust or 21 -> settle
        await settle(interaction, client, session);
      } else {
        // Update view with current hands (dealer first hidden card still hidden on buttons; but we can't edit original command embed structure easily here without context). Keep simple: show both current fully.
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('Блекджек')
          .setImage('https://i.imgur.com/5PAAPj7.png')
          .addFields(
            { name: 'Ваші карти', value: `${fmtHand(session.player)} (=${handValue(session.player)})`, inline: true },
            { name: 'Карти дилера', value: `${fmtHand([session.dealer[0]])} ??`, inline: true }
          );
        try { await interaction.update({ embeds: [embed] }); } catch {}
      }
      return;
    }

    if (action === 'stand') {
      await settle(interaction, client, session);
      return;
    }

    if (action === 'double') {
      if (session.player.length !== 2 || session.doubled) {
        return interaction.reply({ content: 'Подвоєння можливе лише на перших двох картах і один раз.', flags: MessageFlags.Ephemeral });
      }
      // Soft balance check for double
      try {
        const bal = await client.prisma.economyBalance.findUnique({ where: { guildId_userId: { guildId, userId } } });
        if ((bal?.cur1 ?? 0) < session.bet * 2) {
          return interaction.reply({ content: 'Недостатньо Люмін для подвоєння.', flags: MessageFlags.Ephemeral });
        }
      } catch {}
      session.doubled = true;
      session.player.push(session.deck.pop());
      await settle(interaction, client, session);
      return;
    }

    return interaction.reply({ content: 'Невідома дія.', flags: MessageFlags.Ephemeral });
  }
};
