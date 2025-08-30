const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

module.exports = (client) => {
    const baseWatchPaths = ['commands', 'events', 'components'];
    const fileHashes = new Map();
    const watchers = new Map();
    let reloadLock = false;

    const getFileHash = filePath => {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            return Buffer.from(content).toString('base64');
        } catch {
            return null;
        }
    };

    const loadCommand = async (filePath) => {
        const command = require(filePath);
        if (!command.data || !command.execute) return;

        const rest = new REST().setToken(client.config.token);
        const commandData = command.data.toJSON();

        const oldCommand = client.commands.get(command.data.name);
        if (oldCommand?.alias) {
            oldCommand.alias.forEach(alias => {
                client.commands.delete(alias);
            });
        }
        client.commands.delete(command.data.name);

        client.commands.set(command.data.name, command);

        if (command.alias?.length) {
            command.alias.forEach(alias => {
                if (client.commands.has(alias)) {
                    client.logs.warn(`Duplicate alias "${alias}" for command "${command.data.name}"`);
                    return;
                }
                client.commands.set(alias, command);
                client.logs.command(`Reloaded alias "${alias}" for command "${command.data.name}"`);
            });
        }

        const upsert = async (name, data) => {
            const isGuild = Boolean(command.devGuild);
            const fetchRoute = isGuild
                ? Routes.applicationGuildCommands(client.config.botID, client.config.devGuild)
                : Routes.applicationCommands(client.config.botID);
            const commands = await rest.get(fetchRoute);
            const existing = commands.find(cmd => cmd.name === name);
            if (existing) {
                const route = isGuild
                    ? Routes.applicationGuildCommand(client.config.botID, client.config.devGuild, existing.id)
                    : Routes.applicationCommand(client.config.botID, existing.id);
                await rest.patch(route, { body: data });
            } else {
                await rest.post(fetchRoute, { body: data });
            }
        };

        await upsert(command.data.name, commandData);

        if (command.alias?.length) {
            for (const alias of command.alias) {
                const aliasData = { ...commandData, name: alias };
                await upsert(alias, aliasData);
            }
        }
    };

    const loadEvent = (filePath) => {
        const event = require(filePath);
        if (!event.event || !event.execute) return;

        const existingEvent = client._events[event.event];
        if (existingEvent) client.removeListener(event.event, existingEvent);

        if (event.once) {
            client.once(event.event, (...args) => event.execute(...args, client));
        } else {
            client.on(event.event, (...args) => event.execute(...args, client));
        }
    };

    const loadComponent = (filePath) => {
        const component = require(filePath);
        if (!component.customId || !component.execute) return;

        // Remove the old component if it exists
        if (client.components.has(component.customId)) {
            client.components.delete(component.customId);
            const type = getComponentType(filePath);
            if (client.componentsByType.has(type)) {
                client.componentsByType.get(type).delete(component.customId);
            }
        }

        client.components.set(component.customId, component);
        const type = getComponentType(filePath);
        if (!client.componentsByType.has(type)) {
            client.componentsByType.set(type, new Map());
        }
        client.componentsByType.get(type).set(component.customId, component);
    };

    const removeComponent = (filePath) => {
        const componentName = path.basename(filePath, '.js');
        // This is a simplified example. A real implementation would need to
        // find the component by its file path and then remove it from the
        // client.components map.
        for (const [key, value] of client.components.entries()) {
            if (value.__path === filePath) {
                client.components.delete(key);
                const type = getComponentType(filePath);
                if (client.componentsByType.has(type)) {
                    client.componentsByType.get(type).delete(key);
                }
                break;
            }
        }
    };

    const loadPrefix = (filePath) => {
        
    };

    const getComponentType = (filePath) => {
        const parts = filePath.split(path.sep);
        const componentsIndex = parts.indexOf('components');
        return parts[componentsIndex + 1] || 'unknown';
    };

    const getBaseFolder = (filePath) => {
        const normalizedPath = filePath.split(path.sep);
        // Adjust for src directory
        const srcIndex = normalizedPath.indexOf('src');
        if (srcIndex === -1) return null;
        const relativePath = normalizedPath.slice(srcIndex + 1);
        return baseWatchPaths.find(base => relativePath.includes(base));
    };

    const handleFileChange = async (filePath) => {
        if (reloadLock) return;
        reloadLock = true;

        const newHash = getFileHash(filePath);
        const oldHash = fileHashes.get(filePath);
        const baseFolder = getBaseFolder(filePath);

        if (newHash === oldHash || !baseFolder) {
            reloadLock = false;
            return;
        }

        fileHashes.set(filePath, newHash);
        
        try {
            delete require.cache[require.resolve(filePath)];
            
            switch(baseFolder) {
                case 'commands':
                    await loadCommand(filePath);
                    break;
                case 'events':
                    loadEvent(filePath);
                    break;
                case 'components':
                    loadComponent(filePath);
                    break;
            }
            
            client.logs.hotReload(`Reloaded ${path.basename(filePath)}`);
        } catch (error) {
            client.logs.error(`Hot reload error: ${error.message}`);
        }

        reloadLock = false;
    };

    const watchDirectory = (dirPath) => {
        if (watchers.has(dirPath)) return;

        const watcher = fs.watch(dirPath, { recursive: true }, async (eventType, fileName) => {
            if (!fileName) return;
            
            const fullPath = path.join(dirPath, fileName);
            
            try {
                if (!fs.existsSync(fullPath)) {
                    // File deleted
                    fileHashes.delete(fullPath);
                    const baseFolder = getBaseFolder(fullPath);
                    if (baseFolder === 'components') {
                        removeComponent(fullPath);
                    }
                    return;
                }

                const stats = await fs.promises.stat(fullPath);
                if (stats.isDirectory()) {
                    // We watch recursively, so no need to re-initialize
                } else if (fileName.endsWith('.js')) {
                    handleFileChange(fullPath);
                }
            } catch {
                // File might be gone
                fileHashes.delete(fullPath);
            }
        });

        watchers.set(dirPath, watcher);
    };

    const initializeWatcher = async (basePath) => {
        try {
            const files = await fs.promises.readdir(basePath, { withFileTypes: true });
            
            for (const file of files) {
                const fullPath = path.join(basePath, file.name);
                
                if (file.isDirectory()) {
                    await initializeWatcher(fullPath);
                } else if (file.name.endsWith('.js')) {
                    fileHashes.set(fullPath, getFileHash(fullPath));
                }
            }
            
        } catch (error) {
            client.logs.error(`Watch error: ${error.message}`);
        }
    };

    baseWatchPaths.forEach(watchPath => {
        const fullPath = path.join(__dirname, '..', watchPath);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
        }
        initializeWatcher(fullPath);
        watchDirectory(fullPath);
    });

    process.on('SIGINT', () => {
        watchers.forEach(watcher => watcher.close());
        process.exit(0);
    });
};