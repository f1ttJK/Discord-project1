const {
  PermissionFlagsBits,
  MessageFlags,
  ButtonStyle,
  ButtonBuilder,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require('discord.js');

module.exports = {
  customId: 'settings:warnedit',
  async execute(interaction, args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: 'Недостаточно прав для изменения настроек.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }

    const guildId = interaction.guildId;

    const getArg = (prefix) => {
      const item = (args || []).find(a => String(a).startsWith(prefix + ':'));
      return item ? String(item).slice(prefix.length + 1) : null;
    };

    const field = getArg('field'); // muteThreshold|kickThreshold|banThreshold|muteDurationMin|expiryDays
    const op = getArg('op'); // inc|dec
    const from = getArg('from'); // warn|mute|general

    if (!field || !op) return interaction.deferUpdate();

    try {
      const cfg = await client.prisma.warnConfig.upsert({
        where: { guildId },
        create: { guildId },
        update: {},
      });

      const current = cfg[field];
      let next = current;
      const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

      switch (field) {
        case 'muteThreshold': {
          const step = 1; next = clamp((Number(current ?? 3) + (op === 'inc' ? step : -step)), 0, 20); break;
        }
        case 'kickThreshold': {
          const step = 1; next = clamp((Number(current ?? 5) + (op === 'inc' ? step : -step)), 0, 50); break;
        }
        case 'banThreshold': {
          const step = 1; next = clamp((Number(current ?? 7) + (op === 'inc' ? step : -step)), 0, 100); break;
        }
        case 'muteDurationMin': {
          const step = 5; next = clamp((Number(current ?? 60) + (op === 'inc' ? step : -step)), 1, 10080); break;
        }
        case 'expiryDays': {
          if (current == null) { next = op === 'inc' ? 7 : null; }
          else { const step = 1; const val = Number(current) + (op === 'inc' ? step : -step); next = val <= 0 ? null : clamp(val, 1, 365); }
          break;
        }
        default: return await interaction.deferUpdate();
      }

      await client.prisma.warnConfig.update({ where: { guildId }, data: { [field]: next } });
    } catch (e) {
      client.logs.warn?.(`Warn edit error: ${e.message}`);
    }

    // Rebuild UI (same look as in select/toggle handlers)
    try {
      const SELECT_ID = 'settings:select';
      const REFRESH_BUTTON_ID = 'settings:refresh';
      const TOGGLE_BUTTON_ID = 'settings:toggle';

      const buildBase = () => {
        const select = new StringSelectMenuBuilder()
          .setCustomId(SELECT_ID)
          .setPlaceholder('Select a parameter')
          .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('Warn').setValue('warn'),
            new StringSelectMenuOptionBuilder().setLabel('Mute').setValue('mute'),
            new StringSelectMenuOptionBuilder().setLabel('General').setValue('general'),
          );
        const refreshBtn = new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel('Refresh Menu').setCustomId(REFRESH_BUTTON_ID);
        return new ContainerBuilder()
          .addActionRowComponents(row => row.setComponents(select))
          .addActionRowComponents(row => row.setComponents(refreshBtn));
      };

      const base = buildBase();
      const components = [base];
      const cfg2 = await client.prisma.warnConfig.findUnique({ where: { guildId } }).catch(() => null);

      if (from === 'warn') {
        const isEnabled = cfg2?.enabled !== false;
        const section = new SectionBuilder()
          .setButtonAccessory(btn => btn
            .setStyle(isEnabled ? ButtonStyle.Success : ButtonStyle.Danger)
            .setLabel(isEnabled ? 'Enabled' : 'Disabled')
            .setCustomId(`${TOGGLE_BUTTON_ID}-warn-from:warn`)
          )
          .addTextDisplayComponents(text => text.setContent('> ### Warn'));
        components.push(new ContainerBuilder().addSectionComponents(section));
        const cfgText = [
          `- Mute Threshold: ${cfg2?.muteThreshold ?? 3}`,
          `- Kick Threshold: ${cfg2?.kickThreshold ?? 5}`,
          `- Ban Threshold: ${cfg2?.banThreshold ?? 7}`,
          `- Mute Duration (min): ${cfg2?.muteDurationMin ?? 60}`,
          `- Warn Expiry (days): ${cfg2?.expiryDays ?? 'none'}`,
        ].join('\n');
        components.push(new ContainerBuilder().addSectionComponents(
          new SectionBuilder()
            .setButtonAccessory(btn => btn
              .setStyle(ButtonStyle.Secondary)
              .setLabel('Info')
              .setCustomId('settings:info-warn')
              .setDisabled(true)
            )
            .addTextDisplayComponents(text => text.setContent(cfgText))
        ));
        components.push(
          new ContainerBuilder()
            .addActionRowComponents(row => row.setComponents(
              new ButtonBuilder().setCustomId('settings:warnedit-field:muteThreshold-op:dec-from:warn').setStyle(ButtonStyle.Secondary).setLabel('- MuteT'),
              new ButtonBuilder().setCustomId('settings:warnedit-field:muteThreshold-op:inc-from:warn').setStyle(ButtonStyle.Secondary).setLabel('+ MuteT'),
              new ButtonBuilder().setCustomId('settings:warnedit-field:kickThreshold-op:dec-from:warn').setStyle(ButtonStyle.Secondary).setLabel('- KickT'),
              new ButtonBuilder().setCustomId('settings:warnedit-field:kickThreshold-op:inc-from:warn').setStyle(ButtonStyle.Secondary).setLabel('+ KickT'),
              new ButtonBuilder().setCustomId('settings:warnedit-field:banThreshold-op:dec-from:warn').setStyle(ButtonStyle.Secondary).setLabel('- BanT'),
            ))
            .addActionRowComponents(row => row.setComponents(
              new ButtonBuilder().setCustomId('settings:warnedit-field:banThreshold-op:inc-from:warn').setStyle(ButtonStyle.Secondary).setLabel('+ BanT'),
              new ButtonBuilder().setCustomId('settings:warnedit-field:muteDurationMin-op:dec-from:warn').setStyle(ButtonStyle.Secondary).setLabel('- Duration'),
              new ButtonBuilder().setCustomId('settings:warnedit-field:muteDurationMin-op:inc-from:warn').setStyle(ButtonStyle.Secondary).setLabel('+ Duration'),
              new ButtonBuilder().setCustomId('settings:warnedit-field:expiryDays-op:dec-from:warn').setStyle(ButtonStyle.Secondary).setLabel('- Expiry'),
              new ButtonBuilder().setCustomId('settings:warnedit-field:expiryDays-op:inc-from:warn').setStyle(ButtonStyle.Secondary).setLabel('+ Expiry'),
            ))
        );
      } else if (from === 'mute') {
        const guildRow = await client.prisma.guild.findUnique({ where: { id: guildId } }).catch(() => null);
        const isEnabled = guildRow?.muteEnabled !== false;
        const section = new SectionBuilder()
          .setButtonAccessory(btn => btn
            .setStyle(isEnabled ? ButtonStyle.Success : ButtonStyle.Danger)
            .setLabel(isEnabled ? 'Enabled' : 'Disabled')
            .setCustomId(`${TOGGLE_BUTTON_ID}-mute-from:mute`)
          )
          .addTextDisplayComponents(text => text.setContent('> ### Mute'));
        components.push(new ContainerBuilder().addSectionComponents(section));
        const cfgText = [`- Mute Duration (min): ${cfg2?.muteDurationMin ?? 60}`].join('\n');
        components.push(new ContainerBuilder().addSectionComponents(
          new SectionBuilder()
            .setButtonAccessory(btn => btn
              .setStyle(ButtonStyle.Secondary)
              .setLabel('Info')
              .setCustomId('settings:info-mute')
              .setDisabled(true)
            )
            .addTextDisplayComponents(text => text.setContent(cfgText))
        ));
        components.push(new ContainerBuilder().addActionRowComponents(row => row.setComponents(
          new ButtonBuilder().setCustomId('settings:warnedit-field:muteDurationMin-op:dec-from:mute').setStyle(ButtonStyle.Secondary).setLabel('- Duration'),
          new ButtonBuilder().setCustomId('settings:warnedit-field:muteDurationMin-op:inc-from:mute').setStyle(ButtonStyle.Secondary).setLabel('+ Duration'),
        )));
      }

      await interaction.update({ components, flags: MessageFlags.IsComponentsV2 });
    } catch {
      await interaction.deferUpdate();
    }
  },
};
