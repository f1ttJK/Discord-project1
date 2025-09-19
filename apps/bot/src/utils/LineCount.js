const fs = require('node:fs');
const path = require('node:path');
const log = require('./Logger.js');

const files = [
    './cache/Cache.js',
    './CacheSetup.js',
    './CommandLoader.js',
    './ComponentHandler.js',
    './DBConnector.js',
    './EnvironmentCheck.js',
    './EventHandler.js',
    './HotReload.js',
    './InitializeHandlers.js',
    './IntentChecker.js',
    './InteractionHandler.js',
    './Logger.js',
    './PackageChecker.js',
    './ProcessHandler.js',
    './Prompt.js',
    './other/FetchUtils.js',
    '../index.js'
];

const totalLines = files.reduce((total, file) => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        return total + content.split('\n').length;
    }
    return total;
}, 0);

log.info(`Total lines in project: ${totalLines}`);