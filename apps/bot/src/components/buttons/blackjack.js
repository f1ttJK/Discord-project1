const { EmbedBuilder, MessageFlags } = require('discord.js');
const EconomyService = require('../../services/EconomyService');

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
  const economy = EconomyService();

  let dealerValue = handValue(session.dealer);
  while (dealerValue < 17) {
    const card = session.deck.pop();
    if (!card) break;
    session.dealer.push(card);
    dealerValue = handValue(session.dealer);
  }

  const effectiveBet = session.doubled ? bet * 2 : bet;
  const playerValue = handValue(session.player);
  const finalDealer = handValue(session.dealer);

  let payout = 0;
  if (playerValue > 21) payout = -effectiveBet;
  else if (finalDealer > 21) payout = effectiveBet;
  else if (playerValue > finalDealer) payout = effectiveBet;
  else if (playerValue < finalDealer) payout = -effectiveBet;

  if (payout !== 0) {
    try {
      await economy.transaction(guildId, [{ userId, delta: payout }]);
    } catch (e) {
      client.logs?.error?.(`blackjack button payout failed: ${e?.message}`);
    }
  }

  const color = payout > 0 ? 0x57F287 : payout < 0 ? 0xED4245 : 0xFEE75C;
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle('Blackjack result')
    .setImage('https://i.imgur.com/5PAAPj7.png')
    .addFields(
      { name: 'Your hand', value: `${fmtHand(session.player)} (= ${playerValue})`, inline: true },
      { name: 'Dealer hand', value: `${fmtHand(session.dealer)} (= ${finalDealer})`, inline: true },
      { name: 'Payout', value: payout > 0 ? `Won **${payout}**` : payout < 0 ? `Lost **${-payout}**` : 'Push', inline: false }
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

    const [guildId, userId] = sessionId.split(':');
    const key = `${guildId}:${userId}`;
    const session = client.games.blackjack.sessions.get(key);

    if (!session || session.sessionId !== sessionId) {
      return interaction.reply({ content: 'This blackjack game is no longer active.', flags: MessageFlags.Ephemeral });
    }

    if (interaction.user.id !== userId) {
      return interaction.reply({ content: 'Only the player who started this game can act.', flags: MessageFlags.Ephemeral });
    }

    if (session.finished) {
      return interaction.reply({ content: 'The game is already finished.', flags: MessageFlags.Ephemeral });
    }

    if (action === 'hit') {
      session.player.push(session.deck.pop());
      const playerValue = handValue(session.player);
      if (playerValue >= 21) {
        await settle(interaction, client, session);
      } else {
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('Blackjack')
          .setImage('https://i.imgur.com/5PAAPj7.png')
          .addFields(
            { name: 'Your hand', value: `${fmtHand(session.player)} (= ${playerValue})`, inline: true },
            { name: 'Dealer hand', value: `${fmtHand([session.dealer[0]])} ??`, inline: true }
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
        return interaction.reply({ content: 'You can only double on the first move.', flags: MessageFlags.Ephemeral });
      }
      const economy = EconomyService();
      try {
        const balance = await economy.getBalance(guildId, userId);
        if ((balance?.cur1 ?? 0) < session.bet * 2) {
          return interaction.reply({ content: 'Not enough coins to double the bet.', flags: MessageFlags.Ephemeral });
        }
      } catch (e) {
        client.logs?.error?.(`blackjack double balance failed: ${e.message}`);
        return interaction.reply({ content: 'Could not verify your balance. Please try again later.', flags: MessageFlags.Ephemeral });
      }
      session.doubled = true;
      session.player.push(session.deck.pop());
      await settle(interaction, client, session);
      return;
    }

    return interaction.reply({ content: 'Unknown blackjack action.', flags: MessageFlags.Ephemeral });
  }
};
