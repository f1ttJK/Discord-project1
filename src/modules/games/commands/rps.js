const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rps')
    .setDescription('Камінь-Ножиці-Папір 1v1 на ставку')
    .addUserOption(opt => opt.setName('opponent').setDescription('Суперник').setRequired(true))
    .addIntegerOption(opt => opt.setName('amount').setDescription('Ставка (Люміни)').setMinValue(1).setRequired(true)),
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

    client.games ??= {};
    client.games.rps ??= { challenges: new Map() };

    for (const ch of client.games.rps.challenges.values()) {
      if (ch.guildId === guildId && (ch.challengerId === challengerId || ch.opponentId === challengerId)) {
        return interaction.reply({ content: 'У вас вже є активний виклик RPS.', flags: MessageFlags.Ephemeral });
      }
      if (ch.guildId === guildId && (ch.challengerId === opponentId || ch.opponentId === opponentId)) {
        return interaction.reply({ content: 'У вашого опонента вже є активний виклик.', flags: MessageFlags.Ephemeral });
      }
    }

    const [balA, balB] = await Promise.all([
      client.prisma.economyBalance.findUnique({ where: { guildId_userId: { guildId, userId: challengerId } } }),
      client.prisma.economyBalance.findUnique({ where: { guildId_userId: { guildId, userId: opponentId } } })
    ]);
    if ((balA?.cur1 ?? 0) < amount) return interaction.reply({ content: 'У вас недостатньо Люмін.', flags: MessageFlags.Ephemeral });
    if ((balB?.cur1 ?? 0) < amount) return interaction.reply({ content: 'У опонента недостатньо Люмін.', flags: MessageFlags.Ephemeral });

    const challengeId = `${guildId}:${challengerId}:${opponentId}:${Date.now()}`;
    const expiresAt = Date.now() + 60_000;

    client.games.rps.challenges.set(challengeId, {
      id: challengeId,
      guildId,
      challengerId,
      opponentId,
      amount,
      aChoice: null,
      bChoice: null,
      expiresAt
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Камінь-Ножиці-Папір')
      .setDescription(`<@${challengerId}> кидає виклик <@${opponentId}> на ставку **${amount}** Люмін!\nУ вас є 60 сек, щоб прийняти.`);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`rps-accept-${challengeId}`).setLabel('Прийняти').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`rps-decline-${challengeId}`).setLabel('Відхилити').setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({ embeds: [embed], components: [row] });

    setTimeout(async () => {
      const ch = client.games.rps.challenges.get(challengeId);
      if (!ch) return;
      if (Date.now() >= ch.expiresAt) {
        client.games.rps.challenges.delete(challengeId);
        try { await interaction.editReply({ content: 'Час вичерпано. Виклик скасовано.', embeds: [], components: [] }); } catch {}
      }
    }, 61_000);
  }
};
