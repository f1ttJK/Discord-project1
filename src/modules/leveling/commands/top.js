const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const PAGE_SIZE = 10;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('top')
    .setDescription('Таблиці лідерів: рівні/voice/text у межах гільдії')
    .addStringOption(opt => opt
      .setName('category')
      .setDescription('Категорія рейтингу')
      .setRequired(true)
      .addChoices(
        { name: 'Рівні', value: 'levels' },
        { name: 'Voice', value: 'voice' },
        { name: 'Text', value: 'text' },
      )
    )
    .addIntegerOption(opt => opt
      .setName('page')
      .setDescription('Номер сторінки (по 10 записів)')
      .setMinValue(1)
      .setRequired(false)
    ),
  guildOnly: true,
  cooldown: 5,

  async execute(interaction, client) {
    const guild = interaction.guild;
    const guildId = interaction.guildId;
    const category = interaction.options.getString('category', true);
    const page = interaction.options.getInteger('page') ?? 1;

    const skip = (page - 1) * PAGE_SIZE;

    let orderBy;
    let title;
    if (category === 'levels') {
      orderBy = { xp: 'desc' };
      title = 'Топ за рівнями';
    } else if (category === 'voice') {
      orderBy = { voiceSeconds: 'desc' };
      title = 'Топ за голосовою активністю';
    } else if (category === 'text') {
      orderBy = { msgCount: 'desc' };
      title = 'Топ за текстовою активністю';
    } else {
      return interaction.reply({ content: 'Невідома категорія', ephemeral: true });
    }

    // Fetch total count and page data
    const [total, rows] = await Promise.all([
      client.prisma.member.count({ where: { guildId } }),
      client.prisma.member.findMany({
        where: { guildId },
        orderBy,
        take: PAGE_SIZE,
        skip,
        select: { userId: true, xp: true, level: true, msgCount: true, voiceSeconds: true },
      })
    ]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (page > totalPages) {
      return interaction.reply({ content: `Сторінка ${page} не існує. Всього сторінок: ${totalPages}.`, ephemeral: true });
    }

    // Resolve usernames in bulk where possible
    const lines = [];
    let index = skip + 1;
    for (const r of rows) {
      const userMention = `<@${r.userId}>`;
      if (category === 'levels') {
        lines.push(`${index}. ${userMention} — L${r.level} • ${r.xp} EXP`);
      } else if (category === 'voice') {
        const hours = Math.floor((r.voiceSeconds ?? 0) / 3600);
        const minutes = Math.floor(((r.voiceSeconds ?? 0) % 3600) / 60);
        lines.push(`${index}. ${userMention} — ${hours}h ${minutes}m`);
      } else if (category === 'text') {
        lines.push(`${index}. ${userMention} — ${r.msgCount ?? 0} msgs`);
      }
      index++;
    }

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle(title)
      .setDescription(lines.length ? lines.join('\n') : 'Поки що немає даних')
      .setFooter({ text: `Сторінка ${page}/${totalPages} • Гільдія: ${guild.name}` });

    await interaction.reply({ embeds: [embed] });
  }
};
