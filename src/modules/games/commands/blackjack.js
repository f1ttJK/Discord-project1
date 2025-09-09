const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

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
  if (hideFirst && cards.length > 0) return `?? ${cards.slice(1).map(c => `${c.r}${c.s}`).join(' ')}`.trim();
  return cards.map(c => `${c.r}${c.s}`).join(' ');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Блекджек проти дилера')
    .addIntegerOption(o => o.setName('amount').setDescription('Ставка (Люміни)').setMinValue(1).setRequired(true)),
  guildOnly: true,
  cooldown: 3,

  async execute(interaction, client) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const bet = interaction.options.getInteger('amount', true);

    client.games ??= {};
    client.games.blackjack ??= { sessions: new Map() };

    const key = `${guildId}:${userId}`;
    if (client.games.blackjack.sessions.has(key)) {
      return interaction.reply({ content: 'У вас вже є активна сесія блекджека.', flags: MessageFlags.Ephemeral });
    }

    const bal = await client.prisma.economyBalance.findUnique({ where: { guildId_userId: { guildId, userId } } });
    if ((bal?.cur1 ?? 0) < bet) return interaction.reply({ content: 'Недостатньо Люмін для цієї ставки.', flags: MessageFlags.Ephemeral });

    const deck = newShuffledDeck();
    const player = [deck.pop(), deck.pop()];
    const dealer = [deck.pop(), deck.pop()];

    const sessionId = `${key}:${Date.now()}`;
    const session = { sessionId, guildId, userId, bet, deck, player, dealer, finished: false, doubled: false, createdAt: Date.now() };
    client.games.blackjack.sessions.set(key, session);

    const pVal = handValue(player);
    const dVal = handValue(dealer);
    const isPlayerBJ = pVal === 21 && player.length === 2;
    const isDealerBJ = dVal === 21 && dealer.length === 2;

    if (isPlayerBJ || isDealerBJ) {
      // Immediate settle
      await settleAndRespond(interaction, client, session, { autoReveal: true });
      return;
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`blackjack-hit-${sessionId}`).setLabel('Взяти').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`blackjack-stand-${sessionId}`).setLabel('Досить').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`blackjack-double-${sessionId}`).setLabel('Подвоїти').setStyle(ButtonStyle.Success)
    );

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Блекджек')
      .setDescription(`Ставка: **${bet}** Люмін`)
      .addFields(
        { name: 'Ваші карти', value: `${fmtHand(player)} (=${pVal})`, inline: true },
        { name: 'Карти дилера', value: `${fmtHand(dealer, true)}`, inline: true }
      )
      .setImage('https://i.imgur.com/5PAAPj7.png');

    const imgEmbed = new EmbedBuilder()
      .setImage('https://cdn.discordapp.com/attachments/1407787950321827970/1408530939809890374/God3UE.gif?ex=68aa1429&is=68a8c2a9&hm=c2a1a3a2cc72a832c2c06df1efccf50370412fb2176f42b02fc1bb533352d39c');

    await interaction.reply({ embeds: [imgEmbed, embed], components: [row] });

    // Auto-timeout 1 min 30 sec
    setTimeout(async () => {
      const current = client.games.blackjack.sessions.get(key);
      if (!current || current.sessionId !== sessionId || current.finished) return;
      current.finished = true;
      client.games.blackjack.sessions.delete(key);
      try {
        // Disable buttons and end game
        row.components.forEach(btn => btn.setDisabled(true));
        const timeoutEmbed = new EmbedBuilder()
          .setColor(0x808080)
          .setTitle('Блекджек — завершено')
          .setDescription('Сесію завершено через неактивність.');
        await interaction.editReply({ embeds: [timeoutEmbed], components: [row] });
      } catch {}
    }, 90_000);
  }
};

async function settleAndRespond(interaction, client, session, options = {}) {
  const { guildId, userId, bet } = session;

  // Play out dealer if needed
  const pVal = handValue(session.player);
  let dVal = handValue(session.dealer);

  // If initial blackjack cases
  const playerBJ = pVal === 21 && session.player.length === 2;
  const dealerBJ = dVal === 21 && session.dealer.length === 2;

  if (!options.autoReveal && !dealerBJ) {
    // Continue dealer draw after Stand/Double if not already set
    while (dVal < 17) {
      session.dealer.push(session.deck.pop());
      dVal = handValue(session.dealer);
    }
  }

  // Determine outcome
  let result = 'push';
  let payout = 0;
  const effectiveBet = session.doubled ? bet * 2 : bet;

  if (playerBJ && !dealerBJ) { result = 'player_bj'; payout = Math.floor(bet * 1.5); }
  else if (dealerBJ && !playerBJ) { result = 'dealer_bj'; payout = -bet; }
  else {
    const p = handValue(session.player);
    const d = handValue(session.dealer);
    if (p > 21) { result = 'player_bust'; payout = -effectiveBet; }
    else if (d > 21) { result = 'dealer_bust'; payout = effectiveBet; }
    else if (p > d) { result = 'player_win'; payout = effectiveBet; }
    else if (p < d) { result = 'dealer_win'; payout = -effectiveBet; }
    else { result = 'push'; payout = 0; }
  }

  // Apply economy changes atomically
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
    client.logs?.error?.(`blackjack settle error: ${e.message}`);
  }

  // Build result embed
  const finalP = handValue(session.player);
  const finalD = handValue(session.dealer);
  const color = payout > 0 ? 0x57F287 : payout < 0 ? 0xED4245 : 0xFEE75C;
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle('Блекджек — результат')
    .setDescription(`Ставка: **${session.doubled ? bet * 2 : bet}** Люмін`)
    .addFields(
      { name: 'Ваші карти', value: `${fmtHand(session.player)} (=${finalP})`, inline: true },
      { name: 'Карти дилера', value: `${fmtHand(session.dealer)} (=${finalD})`, inline: true },
      { name: 'Підсумок', value: payout > 0 ? `Ви виграли +**${payout}**` : payout < 0 ? `Ви програли -**${-payout}**` : 'Пуш' }
    )
    .setImage('https://i.imgur.com/5PAAPj7.png');

  try {
    const method = (interaction.deferred || interaction.replied) ? 'editReply' : 'reply';
    const imgEmbed = new EmbedBuilder()
      .setImage('https://cdn.discordapp.com/attachments/1407787950321827970/1408530939809890374/God3UE.gif?ex=68aa1429&is=68a8c2a9&hm=c2a1a3a2cc72a832c2c06df1efccf50370412fb2176f42b02fc1bb533352d39c');
    await interaction[method]({ embeds: [imgEmbed, embed], components: [] });
  } catch {}

  // Cleanup session
  session.finished = true;
  client.games.blackjack.sessions.delete(`${guildId}:${userId}`);
}
