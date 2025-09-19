const { 
  MessageFlags, 
  PermissionFlagsBits,
  ButtonStyle,
  ButtonBuilder,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder
} = require('discord.js');

module.exports = {
  customId: 'settings:economy-field',
  
  async execute(interaction, args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: '    .',
        flags: MessageFlags.Ephemeral
      });
    }

    const guildId = interaction.guildId;
    
    // Parse args: field:basePrice-op:inc or field:slope-op:dec
    const getArg = (prefix) => {
      const item = (args || []).find(a => String(a).startsWith(prefix + ':'));
      return item ? String(item).slice(prefix.length + 1) : null;
    };

    const field = getArg('field'); // basePrice | slope
    const op = getArg('op'); // inc | dec

    if (!field || !op) {
      return interaction.deferUpdate();
    }

    try {
      // Get current config
      const economyConfig = await client.prisma.economyConfig.findUnique({
        where: { guildId }
      }).catch(() => null);

      const currentBasePrice = economyConfig?.basePrice ?? 100;
      const currentSlope = economyConfig?.slope ?? 0.001;

      let newBasePrice = currentBasePrice;
      let newSlope = currentSlope;

      // Update field based on operation
      if (field === 'basePrice') {
        if (op === 'inc') {
          newBasePrice = Math.min(currentBasePrice + 10, 1000); // Max 1000
        } else if (op === 'dec') {
          newBasePrice = Math.max(currentBasePrice - 10, 10); // Min 10
        }
      } else if (field === 'slope') {
        if (op === 'inc') {
          newSlope = Math.min(currentSlope + 0.0001, 0.01); // Max 0.01
        } else if (op === 'dec') {
          newSlope = Math.max(currentSlope - 0.0001, 0.0001); // Min 0.0001
        }
      }

      // Update database
      await client.prisma.economyConfig.upsert({
        where: { guildId },
        update: { 
          basePrice: newBasePrice,
          slope: newSlope
        },
        create: { 
          guildId,
          basePrice: newBasePrice,
          slope: newSlope
        }
      });

      // Redirect to main settings handler to rebuild UI
      const settingsHandler = client.components.get('settings:select');
      if (settingsHandler) {
        // Simulate selecting economy option to rebuild the economy containers
        const mockInteraction = { ...interaction, values: ['economy'] };
        await settingsHandler.execute(mockInteraction, [], client);
      } else {
        await interaction.deferUpdate();
      }

    } catch (error) {
      client.logs.error?.(`Economy field update error: ${error.message}`);
      await interaction.deferUpdate();
    }
  }
};
