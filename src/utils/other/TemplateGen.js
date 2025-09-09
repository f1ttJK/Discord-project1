const fs = require('node:fs');
const path = require('node:path');

const templates = {
    commands: `const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('commandname')
        .setDescription('Command description'),
        
    async execute(interaction, client) {
        await interaction.reply('Hello!');
    }
};`,

    buttons: `module.exports = {
    customId: 'buttonid',
    
    async execute(interaction, args, client) {
        await interaction.reply('Button clicked!');
    }
};`,

    menus: `module.exports = {
    customId: 'menuid',
    
    async execute(interaction, args, client) {
        const selected = interaction.values[0];
        await interaction.reply(\`Selected: \${selected}\`);
    }
};`,

    modals: `module.exports = {
    customId: 'modalid',
    
    async execute(interaction, args, client) {
        const input = interaction.fields.getTextInputValue('inputid');
        await interaction.reply(\`Received: \${input}\`);
    }
};`,

    events: `module.exports = {
    event: 'eventName',
    once: false,
    
    async execute(client, ...args) {
        // Your event code here
    }
};`
};

function setupTemplateGenerator(client) {
    const componentsPath = path.join(__dirname, '..', '..', 'components');
    const modulesPath = path.join(__dirname, '..', '..', 'modules');
    const eventsPath = path.join(__dirname, '..', '..', 'events');

    const watchPaths = {
        commands: modulesPath,
        buttons: path.join(componentsPath, 'buttons'),
        menus: path.join(componentsPath, 'menus'),
        modals: path.join(componentsPath, 'modals'),
        events: eventsPath
    };

    for (const [type, dir] of Object.entries(watchPaths)) {
        fs.mkdirSync(dir, { recursive: true });

        const watchOptions = type === 'commands' ? { recursive: true } : undefined;
        fs.watch(dir, watchOptions, (eventType, filename) => {
            if (eventType === 'rename' && filename?.endsWith('.js')) {
                const filePath = path.join(dir, filename);

                if (!fs.existsSync(filePath)) return;

                if (type === 'commands' && !filePath.includes(`${path.sep}commands${path.sep}`)) {
                    return;
                }

                const stats = fs.statSync(filePath);
                if (stats.size === 0) {
                    fs.writeFileSync(filePath, templates[type]);
                    client.logs.system(`Generated ${type} template for ${filename}`);
                }
            }
        });
    }
}

module.exports = setupTemplateGenerator;