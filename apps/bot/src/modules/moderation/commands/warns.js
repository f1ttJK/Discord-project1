const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warns')
    .setDescription('Управление предупреждениями пользователя')
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('Показать все предупреждения пользователя')
      .addUserOption(o => o.setName('user').setDescription('Пользователь для просмотра предупреждений').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('clear')
      .setDescription('Очистить все предупреждения пользователя')
      .addUserOption(o => o.setName('user').setDescription('Пользователь, чьи предупреждения будут удалены').setRequired(true))),
  guildOnly: true,
  cooldown: 3,
  perms: [PermissionFlagsBits.ModerateMembers],

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;
    if (!guild) {
      return interaction.reply({ content: 'Команда доступна только на сервере.', flags: MessageFlags.Ephemeral });
    }
    const guildId = guild.id;
    const targetUser = interaction.options.getUser('user', true);

    if (sub === 'list') {
      const warns = await client.prisma.warn.findMany({
        where: { guildId, userId: targetUser.id },
        orderBy: { id: 'asc' }
      }).catch(() => []);

      if (!warns.length) {
        return interaction.reply({ content: 'У пользователя нет предупреждений.', flags: MessageFlags.Ephemeral });
      }

      const embed = new EmbedBuilder()
        .setColor(0x2F3136)
        .setTitle(`Предупреждения: ${targetUser.tag}`)
        .setDescription(warns.map((w, i) => `${i + 1}. ${w.reason} — <t:${Math.floor(w.createdAt.getTime() / 1000)}:R>`).join('\n'))
        .setFooter({ text: `Всего: ${warns.length}` });

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (sub === 'clear') {
      await client.prisma.warn.deleteMany({ where: { guildId, userId: targetUser.id } }).catch(() => null);
      return interaction.reply({ content: 'Предупреждения пользователя очищены.', flags: MessageFlags.Ephemeral });
    }
  }
};

