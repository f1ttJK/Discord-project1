const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dice')
    .setDescription('Дуель у кості 1v1 на ставку')
    .addUserOption(opt => opt
      .setName('opponent')
      .setDescription('Суперник')
      .setRequired(true)
    )
    .addIntegerOption(opt => opt
      .setName('amount')
      .setDescription('Ставка (Люміни)')
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
      return interaction.reply({ content: 'Неможливо викликати самого себе.', flags: MessageFlags.Ephemeral });
    }
    if (opponent.bot) {
      return interaction.reply({ content: 'Не можна кидати виклик ботам.', flags: MessageFlags.Ephemeral });
    }

    // In-memory store for pending dice challenges
    client.games ??= {};
    client.games.dice ??= { challenges: new Map() };

    // Prevent multiple pending challenges per user in this guild
    for (const ch of client.games.dice.challenges.values()) {
      if (ch.guildId === guildId && (ch.challengerId === challengerId || ch.opponentId === challengerId)) {
        return interaction.reply({ content: 'У вас вже є активний виклик у кості.', flags: MessageFlags.Ephemeral });
      }
      if (ch.guildId === guildId && (ch.challengerId === opponentId || ch.opponentId === opponentId)) {
        return interaction.reply({ content: 'У вашого опонента вже є активний виклик.', flags: MessageFlags.Ephemeral });
      }
    }

    // Check both have enough balance (soft check; final check happens on accept inside transaction)
    const [balA, balB] = await Promise.all([
      client.prisma.economyBalance.findUnique({ where: { guildId_userId: { guildId, userId: challengerId } } }),
      client.prisma.economyBalance.findUnique({ where: { guildId_userId: { guildId, userId: opponentId } } })
    ]);
    if ((balA?.cur1 ?? 0) < amount) {
      return interaction.reply({ content: 'У вас недостатньо Люмін для цієї ставки.', flags: MessageFlags.Ephemeral });
    }
    if ((balB?.cur1 ?? 0) < amount) {
      return interaction.reply({ content: 'У опонента недостатньо Люмін для цієї ставки (або баланс ще не створено).', flags: MessageFlags.Ephemeral });
    }

    // Create challenge
    const challengeId = `${guildId}:${challengerId}:${opponentId}:${Date.now()}`;
    const expiresAt = Date.now() + 60_000; // 60s

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
      .setTitle('Дуель у кості')
      .setDescription(`<@${challengerId}> кидає виклик <@${opponentId}> на ставку **${amount}** Люмін!\nУ вас є 60 сек, щоб прийняти.`);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`dice-accept-${challengeId}`).setLabel('Прийняти').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`dice-decline-${challengeId}`).setLabel('Відхилити').setStyle(ButtonStyle.Danger)
    );

    const reply = await interaction.reply({ embeds: [embed], components: [row] });
    const saved = client.games.dice.challenges.get(challengeId);
    if (saved) saved.messageId = reply.id ?? (await interaction.fetchReply()).id;

    // Auto-expire
    setTimeout(async () => {
      const ch = client.games.dice.challenges.get(challengeId);
      if (!ch) return;
      if (Date.now() >= ch.expiresAt) {
        client.games.dice.challenges.delete(challengeId);
        try {
          await interaction.editReply({ content: 'Час вичерпано. Виклик скасовано.', embeds: [], components: [] });
        } catch {}
      }
    }, 61_000);
  }
};
