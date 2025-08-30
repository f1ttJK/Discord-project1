const fs = require("node:fs");
const path = require("node:path");

const validEvents = [
  "ready",
  "error",
  "warn",
  "debug",
  "invalidated",
  "rateLimit",
  "applicationCommandCreate",
  "applicationCommandDelete",
  "applicationCommandUpdate",
  "autoModerationActionExecution",
  "autoModerationRuleCreate",
  "autoModerationRuleDelete",
  "autoModerationRuleUpdate",
  "channelCreate",
  "channelDelete",
  "channelPinsUpdate",
  "channelUpdate",
  "webhookUpdate",
  "guildAvailable",
  "guildBanAdd",
  "guildBanRemove",
  "guildCreate",
  "guildDelete",
  "guildIntegrationsUpdate",
  "guildMemberAdd",
  "guildMemberAvailable",
  "guildMemberRemove",
  "guildMembersChunk",
  "guildMemberUpdate",
  "guildScheduledEventCreate",
  "guildScheduledEventDelete",
  "guildScheduledEventUpdate",
  "guildScheduledEventUserAdd",
  "guildScheduledEventUserRemove",
  "guildUnavailable",
  "guildUpdate",
  "interactionCreate",
  "inviteCreate",
  "inviteDelete",
  "messageCreate",
  "messageDelete",
  "messageUpdate",
  "messageDeleteBulk",
  "messageReactionAdd",
  "messageReactionRemove",
  "messageReactionRemoveAll",
  "messageReactionRemoveEmoji",
  "presenceUpdate",
  "roleCreate",
  "roleDelete",
  "roleUpdate",
  "stageInstanceCreate",
  "stageInstanceDelete",
  "stageInstanceUpdate",
  "threadCreate",
  "threadDelete",
  "threadListSync",
  "threadMemberUpdate",
  "threadMembersUpdate",
  "threadUpdate",
  "typingStart",
  "userUpdate",
  "voiceStateUpdate",
  "webhooksUpdate",
];

module.exports = (client) => {
  const eventsPath = path.join(__dirname, "..", "events");
  function getFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.flatMap(entry => {
      const res = path.join(dir, entry.name);
      if (entry.isDirectory()) return getFiles(res);
      return entry.name.endsWith('.js') ? [res] : [];
    });
  }
  const eventFiles = getFiles(eventsPath);

  let loadedEvents = 0;
  for (const filePath of eventFiles) {
    const relative = path.relative(eventsPath, filePath);
    const eventModule = require(filePath);

    const checks = {
      event: "event",
      execute: "execute",
    };

    const missingProperty = Object.entries(checks).find(
      ([key]) => !eventModule[key]
    );

    if (missingProperty) {
      client.logs.warn(
        `The event at ${relative} is missing a required "${missingProperty[0]}" ${missingProperty[1]}.`
      );
      continue;
    }

    if (!validEvents.includes(eventModule.event)) {
        client.logs.warn(
            `The event at ${relative} has an invalid event name: ${eventModule.event}`
        );
        continue;
    }

    loadedEvents++;

    if (eventModule.once) {
      client.once(eventModule.event, (...args) =>
        eventModule.execute(...args, client)
      );
    } else {
      client.on(eventModule.event, (...args) =>
        eventModule.execute(...args, client)
      );
    }
  }

  client.logs.event(`Loaded ${loadedEvents} event(s)`);
};
