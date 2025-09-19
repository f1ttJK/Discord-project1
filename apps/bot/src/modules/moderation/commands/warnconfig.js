const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnconfig')
    .setDescription('Настройки системы предупреждений')
    .addSubcommand(sub => sub
      .setName('view')
      .setDescription('Показать текущие пороги наказаний'))
    .addSubcommand(sub => sub
      .setName('set')
      .setDescription('Настроить пороги наказаний')
      .addStringOption(o => o.setName('action').setDescription('Тип наказания').setRequired(true).addChoices(
        { name: 'Мут', value: 'mute' },
        { name: 'Кик', value: 'kick' },
        { name: 'Бан', value: 'ban' }
      ))
      .addIntegerOption(o => o.setName('count').setDescription('Количество предупреждений для срабатывания').setRequired(true))
      .addIntegerOption(o => o.setName('duration').setDescription('Длительность (минуты)').setRequired(false))),
  guildOnly: true,
  cooldown: 3,
  perms: [PermissionFlagsBits.ManageGuild],

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;
    if (!guild) {
      return interaction.reply({ content: 'Команда доступна только на сервере.', flags: MessageFlags.Ephemeral });
    }
    const guildId = guild.id;

    if (sub === 'view') {
      const cfg = await client.prisma.warnConfig.findUnique({ where: { guildId } }).catch(() => null);
      const muteThreshold = (cfg && cfg.muteThreshold != null) ? cfg.muteThreshold : 3;
      const muteDuration = (cfg && cfg.muteDurationMin != null) ? cfg.muteDurationMin : 60;
      const kickThreshold = (cfg && cfg.kickThreshold != null) ? cfg.kickThreshold : 5;
      const banThreshold = (cfg && cfg.banThreshold != null) ? cfg.banThreshold : 7;
      return interaction.reply({
        content: [
          `Мут: при ${muteThreshold} предупреждениях (на ${muteDuration} мин.)`,
          `Кик: при ${kickThreshold} предупреждениях`,
          `Бан: при ${banThreshold} предупреждениях`
        ].join('\n'),
        flags: MessageFlags.Ephemeral
      });
    }

    if (sub === 'set') {
      const action = interaction.options.getString('action', true);
      const count = interaction.options.getInteger('count', true);
      const duration = interaction.options.getInteger('duration');

      if (count <= 0) {
        return interaction.reply({ content: 'Число предупреждений должно быть > 0.', flags: MessageFlags.Ephemeral });
      }

      const data = {};
      if (action === 'mute') {
        data.muteThreshold = count;
        if (duration !== null) data.muteDurationMin = duration;
      } else if (action === 'kick') {
        data.kickThreshold = count;
      } else if (action === 'ban') {
        data.banThreshold = count;
      } else {
        return interaction.reply({ content: 'Неизвестный тип наказания.', flags: MessageFlags.Ephemeral });
      }

      await client.prisma.warnConfig.upsert({
        where: { guildId },
        update: data,
        create: { guildId, ...data }
      });

      return interaction.reply({ content: 'Настройки обновлены.', flags: MessageFlags.Ephemeral });
    }
  }
};

