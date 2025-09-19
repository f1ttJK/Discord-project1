const { SlashCommandBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const { renderCard } = require('../../../utils/profileCard');
const { apiRequest } = require('../../../services/ApiClient');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile').setDescription('Display the economy profile card for yourself or another member')
    .addUserOption(opt => opt
      .setName('user')
      .setDescription(' (   )')
      .setRequired(false)
    ),
  guildOnly: true,
  cooldown: 5,

  async execute(interaction, client) {
    // Guard: command must be used in a guild
    var inGuildValue = false;
    try {
      var inGuildFn = interaction && interaction.inGuild;
      inGuildValue = (typeof inGuildFn === 'function') ? inGuildFn.call(interaction) : !!(interaction && interaction.guild);
    } catch (_) {
      inGuildValue = !!(interaction && interaction.guild);
    }
    if (!inGuildValue) {
      return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
    }

    const guild = interaction.guild;
    const guildId = interaction.guildId;
    const maybeUser = interaction.options.getUser('user');
    const target = (maybeUser === null || maybeUser === undefined) ? interaction.user : maybeUser;
    const userId = target.id;

    // Ensure guild member to get display name and avatar
    const member = await guild.members.fetch(userId).catch(function(){ return null; });
    const displayName = (member && member.displayName != null) ? member.displayName : target.username;
    // discord.js v14 ImageURLOptions supports `extension` field
    const avatarHolder = (member === null || member === undefined) ? target : member;
    const avatarUrl = avatarHolder.displayAvatarURL({ extension: 'png', size: 256 });
    // Highest role (exclude @everyone which has id == guildId). Pass even if colorless.
    let roleName = undefined;
    let roleColor = undefined;
    let roleIconUrl = undefined;
    let joinedTimestamp = undefined;
    if (member) {
      const highest = (member.roles && member.roles.highest != null) ? member.roles.highest : null;
      if (highest && highest.id !== guildId) {
        roleName = highest.name;
        roleColor = highest.hexColor; // '#000000' when the role has no color
        // role icon url if present
        try {
          if (typeof highest.iconURL === 'function') {
            var _tmpIcon = highest.iconURL({ size: 64, extension: 'png' });
            roleIconUrl = (_tmpIcon === null || _tmpIcon === undefined) ? undefined : _tmpIcon;
          }
        } catch (e) {}
      }
      if (member.joinedTimestamp != null) {
        joinedTimestamp = member.joinedTimestamp;
      } else if (member.joinedAt && typeof member.joinedAt.getTime === 'function') {
        joinedTimestamp = member.joinedAt.getTime();
      } else {
        joinedTimestamp = undefined;
      }
    }

    // Read stats via API (API-only)
    let voiceSeconds = 0;
    let msgCount = 0;
    let rusrab = 0;
    let lumini = 0;
    let rusrabTop = undefined;
    let voiceTop = 1;
    let msgTop = 1;

    try {
      const stats = await apiRequest(`/v1/leveling/${guildId}/member/${userId}`);
      voiceSeconds = Number((stats && stats.voiceSeconds != null) ? stats.voiceSeconds : 0);
      msgCount = Number((stats && stats.msgCount != null) ? stats.msgCount : 0);
    } catch (e) {
      if (client.logs && typeof client.logs.warn === 'function') {
        client.logs.warn(`profile: fetch leveling stats failed: ${e.message}`);
      }
    }

    try {
      const bal = await apiRequest(`/v1/economy/${guildId}/${userId}/balance`);
      lumini = Number((bal && bal.cur1 != null) ? bal.cur1 : 0);
      rusrab = Number((bal && bal.cur2 != null) ? bal.cur2 : 0);
    } catch (e) {
      if (client.logs && typeof client.logs.warn === 'function') {
        client.logs.warn(`profile: fetch economy balance failed: ${e.message}`);
      }
    }

    // Render card
    const buffer = await renderCard({
      displayName,
      avatarUrl,
      voiceSeconds,
      voiceTop,
      msgCount,
      msgTop,
      roleName,
      roleColor,
      roleIconUrl,
      joinedTimestamp,
      rusrab,
      lumini,
      rusrabTop,
    });

    const file = new AttachmentBuilder(buffer, { name: 'profile.png' });
    await interaction.reply({ files: [file] });
  }
};


