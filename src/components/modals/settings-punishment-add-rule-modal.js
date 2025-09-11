const {
  MessageFlags,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  WebhookClient
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

    const [messageId] = args;

    const warnCountStr = interaction.fields.getTextInputValue('warn-count').trim();
    const warnCount = parseInt(warnCountStr, 10);
    if (!Number.isFinite(warnCount) || warnCount <= 0) {
      return interaction.reply({ content: '❌ Неверное количество предупреждений.', flags: MessageFlags.Ephemeral });
    }

    const typeSelect = new StringSelectMenuBuilder()
      .setCustomId(`settings:punishment-add-type:${messageId}:${warnCount}`)
      .setPlaceholder('Выберите тип наказания')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Timeout').setValue('Timeout'),
        new StringSelectMenuOptionBuilder().setLabel('Mute').setValue('Mute'),
        new StringSelectMenuOptionBuilder().setLabel('Kick').setValue('Kick'),
        new StringSelectMenuOptionBuilder().setLabel('Ban').setValue('Ban')
      );

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const container = new ContainerBuilder()
      .addSectionComponents(
        new SectionBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent('Выберите тип наказания:')
        )
      )
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(typeSelect)
      );

    try {
      const tokenData = interaction.client.ExpiryMap.get(`punishment-add-rule:${messageId}`);
      if (tokenData) {
        const webhook = new WebhookClient({ id: tokenData.applicationId, token: tokenData.token });
        await webhook.editMessage(messageId, {
          components: [container],
          flags: MessageFlags.IsComponentsV2
        });
        interaction.client.ExpiryMap.delete(`punishment-add-rule:${messageId}`);
      } else {
        const targetMessage = await interaction.channel?.messages.fetch(messageId);
        await targetMessage.edit({
          components: [container],
          flags: MessageFlags.IsComponentsV2
        });
      }
      await interaction.deleteReply().catch(() => {});
    } catch {
      await interaction.editReply({
        content: '❌ Не удалось обновить сообщение.',
        components: []
      });
    }
  }
};
