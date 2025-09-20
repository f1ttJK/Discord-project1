const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const EconomyService = require('../../../services/EconomyService');

function newShuffledDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const deck = [];
  for (const s of suits) for (const r of ranks) deck.push({ r, s });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

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

function fmtHand(cards, hideFirst = false) {
  if (hideFirst && cards.length > 0) {
    const tail = cards.slice(1).map(c => `${c.r}${c.s}`).join(' ');
    return `?? ${tail}`.trim();
  }
  return cards.map(c => `${c.r}${c.s}`).join(' ');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Play blackjack against the dealer')
    .addIntegerOption(o => o
      .setName('amount')
      .setDescription('Stake in coins')
      .setMinValue(1)
      .setRequired(true)
    ),
  guildOnly: true,
  cooldown: 3,

  async execute(interaction, client) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const bet = interaction.options.getInteger('amount', true);

    if (!client.games || typeof client.games !== 'object') client.games = {};
    if (!client.games.blackjack) client.games.blackjack = { sessions: new Map() };

    const key = `${guildId}:${userId}`;
    if (client.games.blackjack.sessions.has(key)) {
      return interaction.reply({ content: 'You already have an active blackjack game.', flags: MessageFlags.Ephemeral });
    }

    const economy = EconomyService();
    let balance;
    try {
      balance = await economy.getBalance(guildId, userId);
    } catch (e) {
      if (client.logs && typeof client.logs.error === 'function') {
        client.logs.error(`blackjack balance fetch failed: ${e && e.message ? e.message : String(e)}`);
      }
      return interaction.reply({ content: 'Could not verify your balance. Please try again later.', flags: MessageFlags.Ephemeral });
    }

    const balCur1 = (balance && balance.cur1 != null) ? balance.cur1 : 0;
    if (balCur1 < bet) {
      return interaction.reply({ content: 'You do not have enough coins for that bet.', flags: MessageFlags.Ephemeral });
    }

    const deck = newShuffledDeck();
    const player = [deck.pop(), deck.pop()];
    const dealer = [deck.pop(), deck.pop()];

    const sessionId = `${key}:${Date.now()}`;
    const session = { sessionId, guildId, userId, bet, deck, player, dealer, finished: false, doubled: false, createdAt: Date.now() };
    client.games.blackjack.sessions.set(key, session);

    const pVal = handValue(player);
    const dVal = handValue(dealer);
    const playerBlackjack = pVal === 21 && player.length === 2;
    const dealerBlackjack = dVal === 21 && dealer.length === 2;

    if (playerBlackjack || dealerBlackjack) {
      await settleAndRespond(interaction, client, session, { autoReveal: true });
      return;
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`blackjack-hit-${sessionId}`).setLabel('Hit').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`blackjack-stand-${sessionId}`).setLabel('Stand').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`blackjack-double-${sessionId}`).setLabel('Double').setStyle(ButtonStyle.Success)
    );

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Blackjack')
      .setDescription(`Stake: **${bet}** coins`)
      .addFields(
        { name: 'Your hand', value: `${fmtHand(player)} (= ${pVal})`, inline: true },
        { name: 'Dealer hand', value: fmtHand(dealer, true), inline: true }
      )
      .setImage('https://i.imgur.com/5PAAPj7.png');

    await interaction.reply({ embeds: [embed], components: [row] });

    setTimeout(async () => {
      const current = client.games.blackjack.sessions.get(key);
      if (!current || current.sessionId !== sessionId || current.finished) return;
      current.finished = true;
      client.games.blackjack.sessions.delete(key);
      try {
        row.components.forEach(btn => btn.setDisabled(true));
        const timeoutEmbed = new EmbedBuilder()
          .setColor(0x808080)
          .setTitle('Blackjack ended')
          .setDescription('Game aborted due to inactivity.');
        await interaction.editReply({ embeds: [timeoutEmbed], components: [row] });
      } catch {}
    }, 90000);
  }
};

async function settleAndRespond(interaction, client, session, options = {}) {
  const { guildId, userId, bet } = session;

  const pVal = handValue(session.player);
  let dVal = handValue(session.dealer);

  const playerBlackjack = pVal === 21 && session.player.length === 2;
  const dealerBlackjack = dVal === 21 && session.dealer.length === 2;

  if (!options.autoReveal && !dealerBlackjack) {
    while (dVal < 17) {
      session.dealer.push(session.deck.pop());
      dVal = handValue(session.dealer);
    }
  }

  let payout = 0;
  const effectiveBet = session.doubled ? bet * 2 : bet;

  if (playerBlackjack && !dealerBlackjack) payout = Math.floor(bet * 1.5);
  else if (dealerBlackjack && !playerBlackjack) payout = -bet;
  else {
    const p = handValue(session.player);
    const d = handValue(session.dealer);
    if (p > 21) payout = -effectiveBet;
    else if (d > 21) payout = effectiveBet;
    else if (p > d) payout = effectiveBet;
    else if (p < d) payout = -effectiveBet;
    else payout = 0;
  }

  if (payout !== 0) {
    const economy = EconomyService();
    try {
      await economy.transaction(guildId, [{ userId, delta: payout }]);
    } catch (e) {
      if (client.logs && typeof client.logs.error === 'function') {
        client.logs.error(`blackjack payout failed: ${e && e.message ? e.message : String(e)}`);
      }
    }
  }

  const finalP = handValue(session.player);
  const finalD = handValue(session.dealer);
  const color = payout > 0 ? 0x57F287 : payout < 0 ? 0xED4245 : 0xFEE75C;
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle('Blackjack result')
    .setDescription(`Stake: **${session.doubled ? bet * 2 : bet}** coins`)
    .addFields(
      { name: 'Your hand', value: `${fmtHand(session.player)} (= ${finalP})`, inline: true },
      { name: 'Dealer hand', value: `${fmtHand(session.dealer)} (= ${finalD})`, inline: true },
      { name: 'Outcome', value: payout > 0 ? `You won **${payout}**` : payout < 0 ? `You lost **${-payout}**` : 'Push', inline: false }
    )
    .setImage('https://i.imgur.com/5PAAPj7.png');

  try {
    const method = (interaction.deferred || interaction.replied) ? 'editReply' : 'reply';
    await interaction[method]({ embeds: [embed], components: [] });
  } catch {}

  session.finished = true;
  client.games.blackjack.sessions.delete(`${guildId}:${userId}`);
}

