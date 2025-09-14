const { MessageFlags, PermissionFlagsBits } = require('discord.js');

module.exports = {
  customId: 'settings:leveling-set-role-modal',

  async execute(interaction, args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: 'Недостаточно прав для изменения настроек.', flags: MessageFlags.Ephemeral });
    }

    const guildId = interaction.guildId;
    const [idRaw] = args || [];
    const id = Number.parseInt(idRaw, 10);
    if (!Number.isFinite(id)) return interaction.reply({ content: '❌ Неверный ID записи.', flags: MessageFlags.Ephemeral });

    const minLevelRaw = interaction.fields.getTextInputValue('minLevel');
    const minLevel = Number.parseInt(String(minLevelRaw).trim(), 10);
    if (!Number.isFinite(minLevel) || minLevel < 1 || minLevel > 10000) {
      return interaction.reply({ content: '❌ Введите целое число ≥ 1 и ≤ 10000.', flags: MessageFlags.Ephemeral });
    }

    try {
      const exists = await client.prisma.levelingRole.findFirst({ where: { id, guildId } });
      if (!exists) return interaction.reply({ content: '❌ Роль не найдена или принадлежит другой гильдии.', flags: MessageFlags.Ephemeral });

      await client.prisma.levelingRole.update({ where: { id }, data: { minLevel } });

      // For modal submits there is no original message to update reliably.
      // Just confirm success ephemerally; the admin can re-open the Leveling tab.
      await interaction.reply({ content: '✅ Минимальный уровень обновлён.', flags: MessageFlags.Ephemeral });
    } catch (e) {
      client.logs?.error?.(`Leveling set role modal error: ${e.message}`);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: '❌ Ошибка при сохранении.', flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ content: '❌ Ошибка при сохранении.', flags: MessageFlags.Ephemeral });
        }
      } catch {}
    }
  }
};
