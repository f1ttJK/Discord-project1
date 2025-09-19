const { MessageFlags } = require('discord.js');

module.exports = {
  customId: 'settings:warn-duration-set',

  async execute(interaction, args, client) {
    const [reasonId, minutes] = args;

    if (!reasonId || !minutes) {
      return interaction.reply({
        content: ' :  .',
        flags: MessageFlags.Ephemeral
      });
    }

    const duration = parseInt(minutes, 10);
    if (isNaN(duration) || duration <= 0) {
      return interaction.reply({
        content: '  .',
        flags: MessageFlags.Ephemeral
      });
    }

    const guildId = interaction.guildId;

    try {
      await client.prisma.warnReason.update({
        where: {
          id: parseInt(reasonId),
          guildId
        },
        data: {
          punishmentDurationMin: duration
        }
      });

      const editRule = client.components.get('settings:warn-edit-rule');
      if (editRule) {
        await editRule.execute(interaction, [reasonId], client);
      } else {
        await interaction.reply({
          content: '  .',
          flags: MessageFlags.Ephemeral
        });
      }
    } catch (error) {
      client.logs.error?.(`Duration set error: ${error.message}`);
      await interaction.reply({
        content: '    .',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};


