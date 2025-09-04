const { 
  MessageFlags, 
  PermissionFlagsBits 
} = require('discord.js');

module.exports = {
  customId: 'settings:toggle-warn-from',
  
  async execute(interaction, args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: 'Недостаточно прав для изменения настроек.',
        flags: MessageFlags.Ephemeral
      });
    }

    const guildId = interaction.guildId;
    const from = args?.[0]; // 'general'

    try {
      // Toggle warn system
      const cfg = await client.prisma.warnConfig.findUnique({
        where: { guildId }
      }).catch(() => null);
      
      const currentEnabled = cfg?.enabled !== false; // default true
      
      await client.prisma.warnConfig.upsert({
        where: { guildId },
        update: { enabled: !currentEnabled },
        create: { 
          guildId, 
          enabled: !currentEnabled 
        }
      });

      // Redirect to main settings handler to rebuild UI
      const settingsHandler = client.components.get('settings:select');
      if (settingsHandler) {
        // Simulate selecting the appropriate option based on 'from' parameter
        const option = from === 'general' ? 'general' : 'warn';
        const mockInteraction = { ...interaction, values: [option] };
        await settingsHandler.execute(mockInteraction, [], client);
      } else {
        await interaction.deferUpdate();
      }

    } catch (error) {
      client.logs.error?.(`Toggle warn error: ${error.message}`);
      await interaction.deferUpdate();
    }
  }
};