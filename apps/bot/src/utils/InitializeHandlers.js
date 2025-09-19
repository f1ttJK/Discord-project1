module.exports = async (client) => {
    try {
        const ProcessHandler = require("./ProcessHandler.js");
        ProcessHandler.setup();
        ProcessHandler.setClient(client);

        // If configured to use API DB, bootstrap guilds into API and prefetch configs
        try {
            const { bootstrapApi } = require('../services/ApiBootstrap.js');
            await bootstrapApi(client);
        } catch (e) {
            client.logs.warn(`ApiBootstrap skipped or failed: ${e.message}`);
        }

        await Promise.all([
            require("./CommandLoader.js")(client),
            require('./ComponentHandler.js')(client),
            require('./EventHandler.js')(client),
            require('./other/TemplateGen.js')(client),
            require('./InteractionHandler.js')(client),
            require('./other/RoleUtils.js')(client),
            require('./other/WarnScheduler.js')(client),
        ]);

        // Commands are now deployed by CommandLoader

        await require('./HotReload.js')(client);
        
        client.handlersInitialized = true;
    } catch (error) {
        client.logs.error(`Failed to initialize handlers: ${error.message}`);
        process.exit(1);
    }
};