const units = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000
};

function parseDuration(str) {
    if (typeof str !== 'string') return null;
    const match = str.toLowerCase().match(/^(\d+)([smhd])$/);
    if (!match) return null;
    const value = parseInt(match[1], 10);
    const unit = units[match[2]];
    return value * unit;
}

module.exports = { parseDuration };
