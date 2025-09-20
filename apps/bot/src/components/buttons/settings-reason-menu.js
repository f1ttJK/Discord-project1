"use strict";

const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, SectionBuilder, TextDisplayBuilder } = require("discord.js");

module.exports = {
  customId: "settings:reason-menu",

  /**
   * @param {import('discord.js').ButtonInteraction} interaction
   * @param {string[]} args
   * @param {any} client
   */
  async execute(interaction, args, client) {
    const guildId = interaction.guildId;
    const idRaw = args?.[0] ?? interaction.customId.split(":")[2];
    const pageArg = args?.[1] ?? interaction.customId.split(":")[4];
    const currentPage = Number.parseInt(String(pageArg || '1'), 10) || 1;
    const id = Number.parseInt(String(idRaw), 10);
    if (!Number.isFinite(id)) {
      return interaction.reply({ content: 'Некорректный ID.', flags: MessageFlags.Ephemeral });
    }

    try {
      const WarnService = require("../../services/WarnService");
      const svc = WarnService();
      const reasons = await svc.listReasons(guildId, { active: false });
      const r = (reasons || []).find(x => x.id === id);
      if (!r) {
        return interaction.reply({ content: 'Причина не найдена.', flags: MessageFlags.Ephemeral });
      }

      const container = new ContainerBuilder()
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel('Назад')
              .setCustomId(`settings:warn-config:page:${currentPage}`),
          ),
        )
        .addSectionComponents(
          new SectionBuilder()
            .setButtonAccessory(
              new ButtonBuilder()
                .setStyle(ButtonStyle.Secondary)
                .setLabel('Изменить')
                .setCustomId(`settings:reason-edit:${r.id}`)
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `- ${r.label}\n> ${r.description ? r.description : 'Описание отсутствует'}`
              ),
            ),
        )
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setStyle(r.active !== false ? ButtonStyle.Success : ButtonStyle.Secondary)
              .setLabel(r.active !== false ? 'Отключить' : 'Включить')
              .setCustomId(`settings:reason-toggle:${r.id}:p:${currentPage}`),
            new ButtonBuilder()
              .setStyle(ButtonStyle.Danger)
              .setLabel('Удалить')
              .setCustomId(`settings:reason-delete:${r.id}:p:${currentPage}`),
          ),
        );

      return interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch (e) {
      client.logs?.error?.(`Reason menu error: ${e.message}`);
      return interaction.reply({ content: 'Произошла ошибка при загрузке причины.', flags: MessageFlags.Ephemeral });
    }
  }
};

