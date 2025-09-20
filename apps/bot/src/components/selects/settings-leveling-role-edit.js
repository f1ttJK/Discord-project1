const { PermissionFlagsBits, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  customId: 'settings:leveling-role-edit',

  async execute(interaction, _args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: 'У вас недостаточно прав для изменения настроек.', flags: MessageFlags.Ephemeral });
    }

    const guildId = interaction.guildId;
    const [selectedId] = interaction.values || [];
    if (!selectedId || selectedId === 'none') return interaction.deferUpdate();

    if (process.env.USE_API_DB === 'true') {
      // API mode: selected value is roleId
      const roleId = selectedId;
      try {
        const LevelingSettingsService = require('../../services/LevelingSettingsService');
        const svc = LevelingSettingsService();
        const s = await svc.get(guildId);
        const rewards = Array.isArray(s?.roleRewards) ? s.roleRewards : [];
        const reward = rewards.find(r => r.roleId === roleId);
        const currentLevel = reward?.level ?? reward?.minLevel ?? 1;

        const role = interaction.guild.roles.cache.get(roleId);
        const roleName = role ? role.name : `@unknown(${roleId})`;

        const modal = new ModalBuilder()
          .setCustomId(`settings:leveling-set-role-modal:${roleId}`)
          .setTitle(`  : ${roleName}`);

        const input = new TextInputBuilder()
          .setCustomId('minLevel')
          .setLabel('  (>=1)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setValue(String(currentLevel));

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      } catch (e) {
        client.logs?.warn?.(`Open role edit (API) failed: ${e.message}`);
        return interaction.deferUpdate();
      }
    }

    // Legacy Prisma path
    const id = Number.parseInt(selectedId, 10);
    if (!Number.isFinite(id)) return interaction.deferUpdate();
    const row = await client.prisma.levelingRole.findFirst({ where: { id, guildId } }).catch(() => null);
    if (!row) return interaction.deferUpdate();
    const role = interaction.guild.roles.cache.get(row.roleId);
    const roleName = role ? role.name : `@unknown(${row.roleId})`;
    const modal = new ModalBuilder()
      .setCustomId(`settings:leveling-set-role-modal:${id}`)
      .setTitle(`  : ${roleName}`);
    const input = new TextInputBuilder()
      .setCustomId('minLevel')
      .setLabel('  (>=1)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setValue(String(row.minLevel));
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }
};

