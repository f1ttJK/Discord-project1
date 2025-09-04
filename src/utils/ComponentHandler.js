const fs = require('node:fs');
const path = require('node:path');

function parseCustomId(customId) {
    // First try to split by '-' for backward compatibility with game components
    if (customId.includes('-') && !customId.includes(':')) {
        const [baseId, ...args] = customId.split('-');
        return { baseId, args };
    }
    
    // For settings components and others that use ':' separator
    if (customId.includes(':')) {
        const parts = customId.split(':');
        
        // For simple patterns like 'settings:warn-config', the whole string is the baseId
        if (parts.length <= 2) {
            // Check if the second part contains a dash (indicating parameters)
            if (parts.length === 2 && parts[1].includes('-')) {
                // Split the second part by dash
                const [secondPart, ...dashArgs] = parts[1].split('-');
                const baseId = `${parts[0]}:${secondPart}`;
                return { baseId, args: dashArgs };
            }
            return { baseId: customId, args: [] };
        }
        
        // For complex patterns, first two parts form the base, rest are args
        const baseId = `${parts[0]}:${parts[1]}`;
        const args = parts.slice(2);
        return { baseId, args };
    }
    
    // Fallback: treat the whole customId as baseId
    return { baseId: customId, args: [] };
}

function setupComponentHandler(client) {
    client.components = new Map();
    client.componentsByType = new Map();
    client.components.parseCustomId = parseCustomId;

    const componentsPath = path.join(__dirname, '..', 'components');
    const componentTypes = fs.readdirSync(componentsPath).filter(file => fs.statSync(path.join(componentsPath, file)).isDirectory());

    const usedCustomIds = new Set();
    let totalComponents = 0;

    for (const type of componentTypes) {
        const typePath = path.join(componentsPath, type);
        const componentFiles = fs.readdirSync(typePath).filter(file => file.endsWith('.js'));
        totalComponents += componentFiles.length;

        if (!client.componentsByType.has(type)) {
            client.componentsByType.set(type, new Map());
        }

        for (const file of componentFiles) {
            const component = require(path.join(typePath, file));

            if (!component.customId) {
                client.logs.error(`The ${type} component at ${path.join(typePath, file)} is missing a required "customId" property.`);
                continue;
            }

            if (!component.execute) {
                client.logs.error(`The ${type} component at ${path.join(typePath, file)} is missing a required "execute" property.`);
                continue;
            }

            if (usedCustomIds.has(component.customId)) {
                client.logs.error(`Duplicate customId "${component.customId}" found in ${file}. Component IDs must be unique across all component types.`);
                continue;
            }
            
            component.type = type;
            usedCustomIds.add(component.customId);
            client.components.set(component.customId, component);
            client.componentsByType.get(type).set(component.customId, component);
        }
    }
    client.logs.component(`Loaded ${totalComponents} component(s)`);
}

module.exports = setupComponentHandler;