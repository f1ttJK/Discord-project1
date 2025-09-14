const { PermissionFlagsBits, MessageFlags, ChannelType } = require('discord.js');

module.exports = {
  customId: 'settings:leveling-ignore-channels',

  async execute(interaction, _args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: 'Недостаточно прав для изменения настроек.', flags: MessageFlags.Ephemeral });
    }

    const guildId = interaction.guildId;
    const values = interaction.values || [];

    try {
      if (!client.prisma?.levelingIgnore?.findMany) {
        return interaction.reply({ content: '⚠️ Схема БД не обновлена. Выполните: npx prisma generate && npm run prisma:push', flags: MessageFlags.Ephemeral });
      }

      const existing = await client.prisma.levelingIgnore.findMany({ where: { guildId, kind: 'Channel' } });
      const selected = new Set(values);

      // delete removed
      const toDelete = existing.filter(r => !selected.has(r.targetId));
      if (toDelete.length) {
        await client.prisma.levelingIgnore.deleteMany({ where: { id: { in: toDelete.map(r => r.id) }, guildId } });
      }

      // add new
      for (const id of selected) {
        if (!existing.some(r => r.targetId === id)) {
          await client.prisma.levelingIgnore.create({ data: { guildId, kind: 'Channel', targetId: id } });
        }
      }

      // Rebuild panel
      const settingsHandler = client.components.get('settings:select');
      if (settingsHandler) {
        const mock = {
          ...interaction,
          values: ['leveling'],
          update: async (data) => {
            if (typeof interaction.update === 'function') return interaction.update(data);
            if (interaction.message && typeof interaction.message.edit === 'function') return interaction.message.edit(data);
          }
        };
        await settingsHandler.execute(mock, [], client);
      } else {
        await interaction.deferUpdate();
      }
    } catch (e) {
      client.logs?.error?.(`Leveling ignore channels error: ${e.message}`);
      await interaction.deferUpdate();
    }
  }
};
