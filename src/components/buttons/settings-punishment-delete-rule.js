const {
  MessageFlags,
  PermissionFlagsBits
} = require('discord.js');

module.exports = {
  customId: 'settings:punishment-delete-rule',

  async execute(interaction, args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: 'Недостаточно прав для изменения настроек.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (!client?.prisma) {
      client.logs?.error?.('Database client not available in punishment delete rule');
      return interaction.reply({
        content: '❗ Ошибка подключения к базе данных.',
        flags: MessageFlags.Ephemeral
      });
    }

    const [warnCountStr] = args;
    const warnCount = parseInt(warnCountStr, 10);
    const guildId = interaction.guildId;

    try {
      await client.prisma.warnPunishmentRule.delete({
        where: {
          guildId_warnCount: {
            guildId,
            warnCount
          }
        }
      });
    } catch (err) {
      client.logs?.error?.(`Failed to delete punishment rule: ${err.message}`);
      return interaction.reply({
        content: '❌ Ошибка при удалении правила.',
        flags: MessageFlags.Ephemeral
      });
    }

    const config = client.components.get('settings:punishment-config');
    const components = await config.buildComponents(guildId, client);
    await interaction.update({
      components,
      flags: MessageFlags.IsComponentsV2
    });
  }
};
