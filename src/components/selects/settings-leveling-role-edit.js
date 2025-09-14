const { PermissionFlagsBits, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  customId: 'settings:leveling-role-edit',

  async execute(interaction, _args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: 'Недостаточно прав для изменения настроек.', flags: MessageFlags.Ephemeral });
    }

    const guildId = interaction.guildId;
    const [selectedId] = interaction.values || [];
    if (!selectedId || selectedId === 'none') return interaction.deferUpdate();

    const id = Number.parseInt(selectedId, 10);
    if (!Number.isFinite(id)) return interaction.deferUpdate();

    const row = await client.prisma.levelingRole.findFirst({ where: { id, guildId } }).catch(() => null);
    if (!row) return interaction.deferUpdate();

    const role = interaction.guild.roles.cache.get(row.roleId);
    const roleName = role ? role.name : `@unknown(${row.roleId})`;

    const modal = new ModalBuilder()
      .setCustomId(`settings:leveling-set-role-modal:${id}`)
      .setTitle(`Уровень для роли: ${roleName}`);

    const input = new TextInputBuilder()
      .setCustomId('minLevel')
      .setLabel('Минимальный уровень (>=1)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setValue(String(row.minLevel));

    modal.addComponents(new ActionRowBuilder().addComponents(input));

    return interaction.showModal(modal);
  }
};
