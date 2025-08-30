// src/commands/m.js
const { AttachmentBuilder, SlashCommandBuilder } = require('discord.js')
const { renderCard } = require('../utils/profileCard')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('card')
    .setDescription('Показать карточку профиля с аватаром'),
  async execute(interaction) {
    await interaction.deferReply()
    const avatarUrl = interaction.user.displayAvatarURL({ extension: 'png', size: 256 })
    const displayName = (interaction.member && interaction.member.displayName) || interaction.user.username
    const png = await renderCard({ avatarUrl, displayName })
    const att = new AttachmentBuilder(png, { name: 'card.png' })
    await interaction.editReply({ files: [att] })
  }
}