const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { apiRequest } = require('../../../services/ApiClient');

const PAGE_SIZE = 10;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('top')
    .setDescription('Топ участников: уровни / voice / text')
    .addStringOption(opt => opt
      .setName('category')
      .setDescription('Категория рейтинга')
      .setRequired(true)
      .addChoices(
        { name: 'Уровни', value: 'levels' },
        { name: 'Голос', value: 'voice' },
        { name: 'Текст', value: 'text' },
      )
    )
    .addIntegerOption(opt => opt
      .setName('page')
      .setDescription('Номер страницы (по 10 записей)')
      .setMinValue(1)
      .setRequired(false)
    ),
  guildOnly: true,
  cooldown: 5,

  async execute(interaction, client) {
    const guild = interaction.guild;
    const guildId = interaction.guildId;
    const category = interaction.options.getString('category', true);
    let page = interaction.options.getInteger('page');
    page = Number.isInteger(page) ? page : 1;

    const skip = (page - 1) * PAGE_SIZE;

    let orderBy;
    let title;
    if (category === 'levels') {
      orderBy = { xp: 'desc' };
      title = 'Топ по уровню';
    } else if (category === 'voice') {
      orderBy = { voiceSeconds: 'desc' };
      title = 'Топ по голосовой активности';
    } else if (category === 'text') {
      orderBy = { msgCount: 'desc' };
      title = 'Топ по текстовой активности';
    } else {
      return interaction.reply({ content: 'Неизвестная категория.', flags: MessageFlags.Ephemeral });
    }

    // Fetch page data from API
    let total = 0;
    let rows = [];
    try {
      const res = await apiRequest(`/v1/leveling/${guildId}/top?category=${encodeURIComponent(category)}&page=${page}&pageSize=${PAGE_SIZE}`);
      if (res && typeof res.total !== 'undefined') total = Number(res.total);
      if (total !== total) total = 0; // NaN guard
      rows = (res && Array.isArray(res.rows)) ? res.rows : [];
    } catch (e) {
      return interaction.reply({ content: `Ошибка запроса к API: ${e.message}`, flags: MessageFlags.Ephemeral });
    }

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (page > totalPages) {
      return interaction.reply({ content: `Страница ${page} вне диапазона. Всего страниц: ${totalPages}.`, flags: MessageFlags.Ephemeral });
    }

    // Resolve usernames in bulk where possible
    const lines = [];
    let index = skip + 1;
    for (const r of rows) {
      const userMention = `<@${r.userId}>`;
      if (category === 'levels') {
        lines.push(`${index}. ${userMention} — L${r.level} — ${r.xp} EXP`);
      } else if (category === 'voice') {
        const vs = (r && r.voiceSeconds != null) ? r.voiceSeconds : 0;
        const hours = Math.floor(Math.max(0, vs) / 3600);
        const minutes = Math.floor((Math.max(0, vs) % 3600) / 60);
        lines.push(`${index}. ${userMention} — ${hours}h ${minutes}m`);
      } else if (category === 'text') {
        const mc = (r && r.msgCount != null) ? r.msgCount : 0;
        lines.push(`${index}. ${userMention} — ${mc} msgs`);
      }
      index++;
    }

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle(title)
      .setDescription(lines.length ? lines.join('\n') : 'Нет данных для отображения')
      .setFooter({ text: `Стр. ${page}/${totalPages} • Сервер: ${guild.name}` });

    await interaction.reply({ embeds: [embed] });
  }
};

