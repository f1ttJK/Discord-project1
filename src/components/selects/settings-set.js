module.exports = {
  customId: 'settings:set',
  async execute(interaction, args, client) {
    const { PermissionFlagsBits, MessageFlags } = require('discord.js');
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: 'Недостаточно прав для изменения настроек.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    const guildId = interaction.guildId;
    const action = args?.[0]; // 'log' | 'muteRole'

    try {
      if (action === 'log') {
        const channelId = interaction.values?.[0];
        if (channelId) {
          await client.prisma.warnConfig.upsert({
            where: { guildId },
            update: { logChannelId: channelId },
            create: { guildId, logChannelId: channelId },
          });
        }
      } else if (action === 'muteRole') {
        const roleId = interaction.values?.[0];
        if (roleId) {
          await client.prisma.guild.upsert({
            where: { id: guildId },
            update: { globalMuteRoleId: roleId },
            create: { id: guildId, globalMuteRoleId: roleId },
          });
        }
      }
    } catch (e) {
      client.logs.warn?.(`Settings set error: ${e.message}`);
    }

    // Acknowledge without changing the UI
    await interaction.deferUpdate();
  },
};
