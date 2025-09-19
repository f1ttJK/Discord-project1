const { 
  MessageFlags, 
  PermissionFlagsBits 
} = require('discord.js');

module.exports = {
  customId: 'settings:warnedit-field',
  
  async execute(interaction, args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: '    .',
        flags: MessageFlags.Ephemeral
      });
    }

    const guildId = interaction.guildId;
    
    // Parse args: field:muteDurationMin-op:inc-from:mute
    const getArg = (prefix) => {
      const item = (args || []).find(a => String(a).startsWith(prefix + ':'));
      return item ? String(item).slice(prefix.length + 1) : null;
    };

    const field = getArg('field'); // muteDurationMin | muteThreshold | kickThreshold | banThreshold | expiryDays
    const op = getArg('op'); // inc | dec
    const from = getArg('from'); // warn | mute | general

    if (!field || !op) {
      return interaction.deferUpdate();
    }

    try {
      // Get current config
      const cfg = await client.prisma.warnConfig.upsert({
        where: { guildId },
        create: { guildId },
        update: {}
      });

      const current = cfg[field] ?? getDefaultValue(field);
      let next = current;

      // Update field based on operation
      if (op === 'inc') {
        next = Math.min(current + getIncrement(field), getMaxValue(field));
      } else if (op === 'dec') {
        next = Math.max(current - getIncrement(field), getMinValue(field));
      }

      // Update database
      await client.prisma.warnConfig.update({
        where: { guildId },
        data: { [field]: next }
      });

      // Redirect to main settings handler to rebuild UI
      const settingsHandler = client.components.get('settings:select');
      if (settingsHandler) {
        // Simulate selecting the appropriate option based on 'from' parameter
        const option = from === 'general' ? 'general' : (from === 'mute' ? 'mute' : 'warn');
        const mockInteraction = { ...interaction, values: [option] };
        await settingsHandler.execute(mockInteraction, [], client);
      } else {
        await interaction.deferUpdate();
      }

    } catch (error) {
      client.logs.error?.(`Warn edit field error: ${error.message}`);
      await interaction.deferUpdate();
    }
  }
};

function getDefaultValue(field) {
  const defaults = {
    muteDurationMin: 60,
    muteThreshold: 3,
    kickThreshold: 5,
    banThreshold: 7,
    expiryDays: 30
  };
  return defaults[field] ?? 0;
}

function getIncrement(field) {
  const increments = {
    muteDurationMin: 15, // 15 minutes
    muteThreshold: 1,
    kickThreshold: 1,
    banThreshold: 1,
    expiryDays: 1
  };
  return increments[field] ?? 1;
}

function getMinValue(field) {
  const mins = {
    muteDurationMin: 5,
    muteThreshold: 1,
    kickThreshold: 1,
    banThreshold: 1,
    expiryDays: 1
  };
  return mins[field] ?? 1;
}

function getMaxValue(field) {
  const maxs = {
    muteDurationMin: 43200, // 30 days in minutes
    muteThreshold: 20,
    kickThreshold: 20,
    banThreshold: 20,
    expiryDays: 365
  };
  return maxs[field] ?? 100;
}
