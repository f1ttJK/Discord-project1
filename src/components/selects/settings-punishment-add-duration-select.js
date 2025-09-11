const {
  MessageFlags,
  PermissionFlagsBits,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder
} = require('discord.js');

module.exports = {
  customId: 'settings:punishment-add-duration',

  async execute(interaction, args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: 'Недостаточно прав для изменения настроек.',
        flags: MessageFlags.Ephemeral
      });
    }

    const [messageId, warnCountStr, type] = args;
    const warnCount = parseInt(warnCountStr, 10);
    const durationStr = interaction.values?.[0];
    const duration = parseInt(durationStr, 10);

    if (!messageId || !warnCount || !type || !duration) {
      return interaction.reply({
        content: '❌ Ошибка: не удалось определить параметры.',
        flags: MessageFlags.Ephemeral
      });
    }

    const guildId = interaction.guildId;

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
        const container = new ContainerBuilder().addSectionComponents(
          new SectionBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent('❌ Правило с таким количеством предупреждений уже существует.')
          )
        );
        return interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }
      const container = new ContainerBuilder().addSectionComponents(
        new SectionBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent('❌ Ошибка при сохранении правила.')
        )
      );
      return interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }

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

    const successContainer = new ContainerBuilder().addSectionComponents(
      new SectionBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`✅ Правило добавлено: **${type} (${duration} мин.)**`)
      )
    );

    return interaction.update({ components: [successContainer], flags: MessageFlags.IsComponentsV2 });
  }
};
