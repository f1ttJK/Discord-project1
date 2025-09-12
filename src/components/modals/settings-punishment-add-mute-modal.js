const {
  MessageFlags,
  PermissionFlagsBits
} = require('discord.js');

module.exports = {
  customId: 'settings:punishment-add-mute-modal',

  async execute(interaction, args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: 'Недостаточно прав для изменения настроек.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Validate database connection
    if (!client?.prisma) {
      client.logs?.error?.('Database client not available in punishment add mute modal');
      return interaction.reply({
        content: '❌ Ошибка подключения к базе данных.',
        flags: MessageFlags.Ephemeral
      });
    }

    const [messageId, warnCountStr] = args;
    const warnCount = parseInt(warnCountStr, 10);
    const durationStr = interaction.fields.getTextInputValue('mute-duration').trim();
    const duration = parseInt(durationStr, 10);

    if (!warnCount || !Number.isFinite(duration) || duration <= 0) {
      return interaction.reply({
        content: '❌ Неверная длительность или количество предупреждений.',
        flags: MessageFlags.Ephemeral
      });
    }

    const guildId = interaction.guildId;

    try {
      await client.prisma.guild.upsert({
        where: { id: guildId },
        update: {},
        create: { id: guildId }
      });

      await client.prisma.warnPunishmentRule.create({
        data: {
          guildId,
          warnCount,
          punishmentType: 'Mute',
          punishmentDurationMin: duration
        }
      });
    } catch (err) {
      client.logs?.error?.(`Failed to create mute punishment rule: ${err.message}`);
      if (err?.code === 'P2002') {
        return interaction.reply({
          content: '❌ Правило с таким количеством предупреждений уже существует.',
          flags: MessageFlags.Ephemeral
        });
      }
      return interaction.reply({
        content: '❌ Ошибка при сохранении правила.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Rule created successfully - update original settings message
    try {
      const originalMessage = await interaction.channel?.messages.fetch(messageId).catch(() => null);
      if (originalMessage) {
        await client.components.get('settings:punishment-config')?.execute(
          {
            guildId,
            update: (data) => originalMessage.edit(data).catch(() => {})
          },
          [],
          client
        );
      }
    } catch (e) {
      // ignore message update errors
    }

    return interaction.reply({
      content: `✅ Правило добавлено: **Mute (${duration} мин.)** для ${warnCount} предупреждений`,
      flags: MessageFlags.Ephemeral
    });
  }
};
