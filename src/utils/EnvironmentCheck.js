const fs = require('node:fs');
const path = require('node:path');

module.exports = function checkEnvironment(client) {
    // Adjusted for src directory
    const requiredFolders = ['modules', 'events', 'components', 'config'];
    const requiredFiles = ['config/config.json'];
    const requiredConfigFields = ['token', 'botID'];
    const errors = [];

    requiredFolders.forEach(folder => {
        const folderPath = path.join(__dirname, '..', folder);
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
            fs.writeFileSync(path.join(folderPath, '.gitkeep'), '');
        }
    });

    requiredFiles.forEach(file => {
        const filePath = path.join(__dirname, '..', file);
        if (!fs.existsSync(filePath)) {
            errors.push(`Missing required file: ${file}`);
        }
    });

    const config = client.config;
    requiredConfigFields.forEach(field => {
        if (!config[field]) {
            errors.push(`Missing required config field: ${field}`);
        }
    });

    if (errors.length > 0) {
        client.logs.error('Environment check failed:');
        errors.forEach(error => client.logs.error(`- ${error}`));
        process.exit(1);
    }

    client.logs.startup('Environment check passed');
    return true;
}