const { 
  MessageFlags, 
  PermissionFlagsBits 
} = require('discord.js');

module.exports = {
  customId: 'settings:toggle-mute-from',
  
  async execute(interaction, args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: '    .',
        flags: MessageFlags.Ephemeral
      });
    }

    const guildId = interaction.guildId;
    const from = args?.[0]; // 'general'

    try {
      // Toggle mute system
      const guildRow = await client.prisma.guild.findUnique({
        where: { id: guildId }
      }).catch(() => null);
      
      const currentEnabled = guildRow?.muteEnabled !== false; // default true
      
      await client.prisma.guild.upsert({
        where: { id: guildId },
        update: { muteEnabled: !currentEnabled },
        create: { 
          id: guildId, 
          muteEnabled: !currentEnabled 
        }
      });

      // Redirect to main settings handler to rebuild UI
      const settingsHandler = client.components.get('settings:select');
      if (settingsHandler) {
        // Simulate selecting the appropriate option based on 'from' parameter
        const option = from === 'general' ? 'general' : 'mute';
        const mockInteraction = { ...interaction, values: [option] };
        await settingsHandler.execute(mockInteraction, [], client);
      } else {
        await interaction.deferUpdate();
      }

    } catch (error) {
      client.logs.error?.(`Toggle mute error: ${error.message}`);
      await interaction.deferUpdate();
    }
  }
};
