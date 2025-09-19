module.exports = {
  customId: 'settings:set',
  async execute(interaction, args, client) {
    const { PermissionFlagsBits, MessageFlags } = require('discord.js');
    const WarnService = require('../../services/WarnService');
    const GuildConfigService = require('../../services/GuildConfigService');

    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: ???????????????????? ???????? ???>?? ?????????????? ??????????????.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    const guildId = interaction.guildId;
    const action = args?.[0]; // 'log' | 'muteRole'

    try {
      if (action === 'log') {
        const channelId = interaction.values?.[0];
        if (channelId) {
          const warnSvc = WarnService();
          const current = await warnSvc.getSettings(guildId).catch(() => ({})) || {};
          await warnSvc.setSettings(guildId, { ...current, auditChannelId: channelId });
        }
      } else if (action === 'muteRole') {
        const roleId = interaction.values?.[0];
        if (roleId) {
          const cfgSvc = GuildConfigService();
          await cfgSvc.patchConfig(guildId, { muteRole: roleId });
        }
      }
    } catch (e) {
      client.logs.warn?.(`Settings set error: ${e.message}`);
    }

    await interaction.deferUpdate();
  },
};

