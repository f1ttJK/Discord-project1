const {
  MessageFlags,
  PermissionFlagsBits
} = require('discord.js');

module.exports = {
  customId: 'settings:punishment-add-rule-modal',

  async execute(interaction, args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: 'Недостаточно прав для изменения настроек.',
        flags: MessageFlags.Ephemeral
      });
    }

    const guildId = interaction.guildId;
    const warnCountStr = interaction.fields.getTextInputValue('warn-count').trim();
    const typeInput = interaction.fields.getTextInputValue('type').trim();
    const durationStr = interaction.fields.getTextInputValue('duration')?.trim();

    const warnCount = parseInt(warnCountStr, 10);
    if (!Number.isFinite(warnCount) || warnCount <= 0) {
      return interaction.reply({ content: '❌ Неверное количество предупреждений.', flags: MessageFlags.Ephemeral });
    }

    const type = typeInput.charAt(0).toUpperCase() + typeInput.slice(1).toLowerCase();
    const allowed = ['Timeout', 'Kick', 'Ban', 'Mute'];
    if (!allowed.includes(type)) {
      return interaction.reply({ content: '❌ Неверный тип наказания.', flags: MessageFlags.Ephemeral });
    }

    let duration = null;
    if (type === 'Timeout' || type === 'Mute') {
      duration = parseInt(durationStr, 10);
      if (!Number.isFinite(duration) || duration <= 0) {
        return interaction.reply({ content: '❌ Укажите положительную длительность в минутах.', flags: MessageFlags.Ephemeral });
      }
    }

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
          punishmentType: type,
          punishmentDurationMin: duration
        }
      });
    } catch (err) {
      if (err?.code === 'P2002') {
        return interaction.reply({ content: '❌ Правило с таким количеством предупреждений уже существует.', flags: MessageFlags.Ephemeral });
      }
      return interaction.reply({ content: '❌ Ошибка при сохранении правила.', flags: MessageFlags.Ephemeral });
    }

    const messageId = args[0];
    try {
      let targetMessage = interaction.message;
      if (!targetMessage && messageId) {
        targetMessage = await interaction.channel?.messages.fetch(messageId).catch(() => null);
      }
      if (targetMessage) {
        const fakeInteraction = {
          guildId,
          update: (data) => targetMessage.edit(data)
        };
        await client.components.get('settings:punishment-config').execute(fakeInteraction, [], client);
      }
    } catch (e) {
      // ignore
    }

    return interaction.reply({ content: '✅ Правило добавлено.', flags: MessageFlags.Ephemeral });
  }
};
