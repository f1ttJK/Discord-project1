const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require('node:path');
const logs = require('./Logger');

const IGNORED_FOLDERS = ['node_modules', '.git'];
const IGNORED_PACKAGES = ['@discordjs'];
const builtInModules = new Set(['assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console', 'constants', 'crypto', 'dgram', 'dns', 'domain', 'events', 'fs', 'http', 'http2', 'https', 'inspector', 'module', 'net', 'os', 'path', 'perf_hooks', 'process', 'punycode', 'querystring', 'readline', 'repl', 'stream', 'string_decoder', 'timers', 'tls', 'trace_events', 'tty', 'url', 'util', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib']);

function ReadFolder(basePath = '', depth = 5) {
    const files = [];
    // Adjusted for src directory
    const fullPath = path.join(__dirname, '..', basePath);
    
    if (!fs.existsSync(fullPath)) return [];
    
    function readDirectory(currentPath, currentDepth) {
        if (currentDepth === 0) return;
        const folderFiles = fs.readdirSync(currentPath, { withFileTypes: true });

        for (const file of folderFiles) {
            const filePath = path.join(currentPath, file.name);
            if (file.isDirectory()) {
                if (!IGNORED_FOLDERS.includes(file.name)) readDirectory(filePath, currentDepth - 1);
                continue;
            }
            if (file.name.endsWith('.js')) files.push(filePath);
        }
    }

    readDirectory(fullPath, depth);
    return files;
}

function getPackages(file) {
    const rawContent = fs.readFileSync(file, "utf-8");
    // Strip block and line comments to avoid false positives from commented text
    const content = rawContent
        .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
        .replace(/(^|[^:])\/\/.*$/gm, '$1'); // line comments (ignore URL protocols like http://)

    const packages = new Set();

    // Precise JS import/require patterns
    const importFromRe = /import\s+[^;'"`]+?\s+from\s+['"`]([^'"`]+)['"`]/g;
    const importBareRe = /import\s+['"`]([^'"`]+)['"`]/g; // e.g., import 'dotenv/config'
    const requireRe = /require\(\s*['"`]([^'"`]+)['"`]\s*\)/g;

    const addPkg = (raw) => {
        if (!raw) return;
        const pkg = raw.startsWith('@') ? raw.split('/').slice(0, 2).join('/') : raw.split('/')[0];
        if (IGNORED_PACKAGES.includes(pkg)) return;
        if (builtInModules.has(pkg)) return;
        if (pkg.startsWith('node:')) return;
        if (pkg.startsWith('.')) return; // local relative import
        packages.add(pkg);
    };

    let m;
    while ((m = importFromRe.exec(content)) !== null) addPkg(m[1]);
    while ((m = importBareRe.exec(content)) !== null) addPkg(m[1]);
    while ((m = requireRe.exec(content)) !== null) addPkg(m[1]);

    return Array.from(packages);
}

function npmCommand(command) {
    try {
        execSync(command, { 
            stdio: "pipe",
            shell: true,
            env: { ...process.env, NODE_ENV: 'development' }
        });
    } catch (error) {
        logs.error(`npm command failed: ${error.message}`);
        if (command.includes('install')) {
            const packages = command.split(' ').slice(2);
            for (const pkg of packages) {
                try {
                    execSync(`npm install "${pkg}"`, {
                        stdio: "pipe",
                        shell: true,
                        env: { ...process.env, NODE_ENV: 'development' }
                    });
                } catch (err) {
                    logs.error(`Failed to install ${pkg}: ${err.message}`);
                }
            }
        }
    }
}

function managePackages(client) {
    try {
        const files = ReadFolder('..', 3);
        // Adjusted for src directory
        const packageJSONPath = path.join(__dirname, '..', '..', 'package.json');

        if (!fs.existsSync(packageJSONPath)) {
            throw new Error("No package.json found");
        }
        const packageJSON = require(packageJSONPath);
        // Only regular dependencies are considered for potential removal
        const installedDependencies = new Set(Object.keys(packageJSON.dependencies || {}));
        // Dev dependencies should never be auto-removed (used by scripts/tooling)
        const installedDevDependencies = new Set(Object.keys(packageJSON.devDependencies || {}));
        const requiredPackages = new Set(files.flatMap(getPackages));

        // Only uninstall unused regular dependencies
        const unusedPackages = Array.from(installedDependencies).filter(pkg => !requiredPackages.has(pkg));
        const missingPackages = Array.from(requiredPackages).filter(pkg => {
            const cleanName = pkg.startsWith('@') ? pkg.split('/').slice(0, 2).join('/') : pkg.split('/')[0];
            // Adjusted for src directory
            const isInstalledAsDep = installedDependencies.has(pkg);
            const isInstalledAsDev = installedDevDependencies.has(pkg);
            return !fs.existsSync(path.join(__dirname, '..', '..', 'node_modules', cleanName)) && !(isInstalledAsDep || isInstalledAsDev);
        });

        if (unusedPackages.length) {
            logs.info(`Removing unused packages: ${unusedPackages.join(", ")}`);
            npmCommand(`npm uninstall ${unusedPackages.join(" ")}`);
        }

        if (missingPackages.length) {
            logs.info(`Installing missing packages: ${missingPackages.join(", ")}`);
            for (const pkg of missingPackages) {
                npmCommand(`npm install "${pkg}"`);
            }
        }
        
        logs.info(`Installed ${missingPackages.length} missing packages and removed ${unusedPackages.length} unused packages`);
    } catch (error) {
        logs.error(`Package management failed: ${error.message}`);
        throw error;
    }
}

module.exports = managePackages;