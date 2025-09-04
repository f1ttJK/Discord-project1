const { 
  MessageFlags, 
  PermissionFlagsBits 
} = require('discord.js');

module.exports = {
  customId: 'settings:duration',
  
  async execute(interaction, args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: 'Недостаточно прав для изменения настроек.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Parse args: adjust-{reasonId}-{operation}-{amount} or reset-{reasonId}
    const action = args[0]; // 'adjust' or 'reset'
    const reasonId = args[1];
    
    if (!reasonId) {
      return interaction.reply({
        content: '❌ Ошибка: не удалось определить ID правила.',
        flags: MessageFlags.Ephemeral
      });
    }

    const guildId = interaction.guildId;

    try {
      if (action === 'reset') {
        // Reset duration to 0 (null)
        await client.prisma.warnReason.update({
          where: { 
            id: parseInt(reasonId),
            guildId: guildId 
          },
          data: { 
            punishmentDurationMin: null 
          }
        });
      } else if (action === 'adjust') {
        const operation = args[2]; // 'inc' or 'dec'
        const amount = parseInt(args[3]); // 5, 15, 60, etc.

        if (!operation || !amount) {
          return interaction.reply({
            content: '❌ Ошибка: неверные параметры операции.',
            flags: MessageFlags.Ephemeral
          });
        }

        // Get current duration
        const warnReason = await client.prisma.warnReason.findUnique({
          where: { 
            id: parseInt(reasonId),
            guildId: guildId 
          }
        });

        if (!warnReason) {
          return interaction.reply({
            content: '❌ Ошибка: правило не найдено.',
            flags: MessageFlags.Ephemeral
          });
        }

        const currentDuration = warnReason.punishmentDurationMin || 0;
        let newDuration;

        if (operation === 'inc') {
          newDuration = Math.min(currentDuration + amount, 43200); // Max 30 days
        } else if (operation === 'dec') {
          newDuration = Math.max(currentDuration - amount, 0);
        }

        // Update duration
        await client.prisma.warnReason.update({
          where: { 
            id: parseInt(reasonId),
            guildId: guildId 
          },
          data: { 
            punishmentDurationMin: newDuration === 0 ? null : newDuration 
          }
        });
      }

      // Redirect back to duration edit page
      const durationHandler = client.components.get('settings:warn-edit-duration');
      if (durationHandler) {
        await durationHandler.execute(interaction, [reasonId], client);
      } else {
        await interaction.reply({
          content: '✅ Длительность обновлена.',
          flags: MessageFlags.Ephemeral
        });
      }

    } catch (error) {
      client.logs.error?.(`Duration update error: ${error.message}`);
      await interaction.reply({
        content: '❌ Ошибка при обновлении длительности.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};module.exports = {
    customId: 'buttonid',
    
    async execute(interaction, args, client) {
        await interaction.reply('Button clicked!');
    }
};