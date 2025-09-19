const { MessageFlags } = require('discord.js');
const WarnService = require('../../services/WarnService');

module.exports = {
  customId: 'settings:warn-edit-name-modal',

  async execute(interaction, args, client) {
    const [messageId, reasonId] = args;
    const guildId = interaction.guildId;

    const label = interaction.fields.getTextInputValue('label').trim();
    const description = interaction.fields.getTextInputValue('description').trim();

    if (!label) {
      return interaction.reply({
        content: '      .',
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      const svc = WarnService();
      await svc.updateReason(guildId, reasonId, { label, description: description || null });
    } catch (error) {
      if (error?.code === 'DUPLICATE' || (typeof error?.message === 'string' && /DUPLICATE/i.test(error.message))) {
        return interaction.reply({ content: '    .', flags: MessageFlags.Ephemeral });
      }
      if (error?.message !== 'Unknown Message') {
        client.logs?.error && client.logs.error(`Warn reason update error: ${error.message}`);
        return interaction.reply({ content: '    .', flags: MessageFlags.Ephemeral });
      }
    }

    if (messageId) {
      try {
        const message = await interaction.channel?.messages.fetch(messageId).catch(() => null);
        if (message) {
          const fakeInteraction = {
            guildId,
            update: (data) => message.edit(data).catch(() => null)
          };
          const editRule = client.components.get('settings:warn-edit-rule');
          if (editRule) {
            await editRule.execute(fakeInteraction, [reasonId], client);
          }
        }
      } catch (err) {
        // ignore message update errors
      }
    }

    return interaction.reply({
      content: '  .',
      flags: MessageFlags.Ephemeral
    });
  }
};

