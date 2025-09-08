# Discord-project1 - Comprehensive Project Documentation

## 📋 Project Overview

**Discord-project1** is a comprehensive Discord bot written in Node.js that provides moderation, economy, and interactive gaming features for Discord servers. The bot enhances community engagement through automated tools including warning systems, economic gameplay, mini-games, and customizable server settings.

### Key Features
- **Moderation System**: Warning and mute functionality with configurable thresholds
- **Economy System**: Dual-currency system with earning mechanisms and gambling games
- **Interactive Games**: Blackjack, Roulette, Dice, Rock Paper Scissors
- **Activity Tracking**: Message and voice activity monitoring with XP/level system
- **Customizable Settings**: Server-specific configurations via interactive UI components

## 🏗️ System Architecture

### Architecture Pattern
The project follows a **modular monolithic architecture** with clear separation of concerns:

- **Event-Driven Design**: Uses Discord.js event system for real-time interactions
- **Command Pattern**: Each command is encapsulated in separate modules
- **Component Pattern**: UI interactions (buttons, selects) are handled modularly
- **Singleton Pattern**: Database connection and cache instances are shared globally

### Core Components
```
src/
├── index.js                 # Entry point and bot initialization
├── commands/               # Slash commands (17 total)
├── components/             # UI interaction handlers
│   ├── buttons/           # Button interaction handlers (6 files)
│   └── selects/           # Select menu handlers (2 files)
├── events/                # Discord event listeners (2 files)
└── utils/                 # Utility modules and handlers (15+ files)
    ├── cache/             # Caching system
    └── other/             # Domain-specific utilities
```

## 🛠️ Technology Stack

### Core Dependencies
- **Node.js Runtime**: Modern JavaScript execution environment
- **discord.js v14.15.3**: Discord API interaction library
- **Prisma v6.14.0**: ORM for type-safe database operations
- **@napi-rs/canvas v0.1.77**: Image generation for profile cards
- **twemoji-parser v14.0.0**: Emoji handling and parsing

### Database
- **SQLite**: Local file-based database (`prisma/database.sqlite`)
- **Prisma Schema**: Comprehensive data model with 12+ tables
- **Migration System**: Version-controlled schema evolution

### Development Tools
- **nodemon v3.1.0**: Development auto-restart
- **Prisma CLI**: Database management and migrations

## 📊 Database Schema

### Core Entities

#### Guild Management
```prisma
model Guild {
  id                String       @id
  members          Member[]
  economyBalances  EconomyBalance[]
  warns           Warn[]
  warnConfig      WarnConfig?
  muteReasons     MuteReason[]
  globalMuteRoleId String?
  muteEnabled     Boolean      @default(true)
}
```

#### User & Member System
```prisma
model User {
  id        String    @id
  members   Member[]
  economyBalances EconomyBalance[]
}

model Member {
  guildId      String
  userId       String
  xp           Int      @default(0)
  level        Int      @default(0)
  msgCount     Int      @default(0)
  voiceSeconds Int      @default(0)
}
```

#### Economy System
```prisma
model EconomyBalance {
  guildId           String
  userId            String
  cur1              Int      @default(0)  # Lumins (earnable)
  cur2              Int      @default(0)  # Rusrab (premium)
  lastDailyAt       DateTime?
  lastWeeklyAt      DateTime?
  lastMsgEarnAt     DateTime?
}

model EconomyConfig {
  guildId   String  @id
  basePrice Int     @default(100)
  slope     Float   @default(0.001)
}
```

#### Moderation System
```prisma
model Warn {
  id          Int      @id @default(autoincrement())
  guildId     String
  userId      String
  moderatorId String
  reason      String
  expiresAt   DateTime?
}

model WarnConfig {
  guildId           String  @id
  muteThreshold     Int     @default(3)
  kickThreshold     Int     @default(5)
  banThreshold      Int     @default(7)
  muteDurationMin   Int     @default(60)
  expiryDays        Int?
  enabled           Boolean @default(true)
}
```

## 🎮 Commands System

### Economy Commands (7 total)
- **`/balance`**: Display user's Lumins and Rusrab balance
- **`/daily`**: Claim daily currency reward
- **`/weekly`**: Claim weekly currency reward  
- **`/earn`**: Manual earning command
- **`/exchange`**: Convert Lumins to Rusrab using dynamic pricing
- **`/gift`**: Transfer currency between users

### Gaming Commands (4 total)
- **`/blackjack [amount]`**: Play blackjack against dealer with betting
- **`/roulette [bet] [color/number]`**: Roulette gambling game
- **`/dice [amount]`**: Dice rolling with betting mechanics
- **`/rps [bet] [choice]`**: Rock Paper Scissors with AI opponent

### Moderation Commands (2 total)
- **`/warn [user] [reason]`**: Issue warnings using predefined reasons from settings
- **`/mute [user] [reason] [duration]`**: Timeout or role-based muting

### Utility Commands (4 total)
- **`/profile [user?]`**: Generate visual profile cards with stats
- **`/activity [user?]`**: Display user activity and engagement metrics
- **`/settings`**: Server configuration panel with interactive UI
- **`/m`**: Quick moderation shortcut command

## 🎯 Interactive Components

### Button Components (6 types)
- **Blackjack Buttons**: Hit, Stand, Double actions during gameplay
- **Dice Buttons**: Roll confirmation and betting options
- **RPS Buttons**: Rock, Paper, Scissors choice selection
- **Settings Buttons**: Toggle features, refresh data, edit configurations

### Select Menu Components (2 types)
- **Settings Parameter Select**: Choose configuration categories
- **Warn Reason Autocomplete**: Choose predefined warning reasons while typing

## 🚀 Bot Initialization Flow

```javascript
// 1. Environment and Configuration Validation
require('./utils/EnvironmentCheck.js')(client)
require('./utils/CacheSetup.js')(client)
require('./utils/PackageChecker.js')(client)

// 2. Handler Initialization (Parallel)
await Promise.all([
  require("./CommandLoader")(client),      // Load and register slash commands
  require('./ComponentHandler')(client),   // Register UI components
  require('./EventHandler')(client),       // Set up event listeners
  require('./InteractionHandler')(client), // Handle user interactions
  require('./other/WarnScheduler.js')(client) // Start background tasks
])

// 3. Database Connection
await require('./DBConnector.js').setupDatabase(client)

// 4. Hot Reload System (Development)
await require('./HotReload')(client)
```

## 💾 Economy System Details

### Dual Currency Model
- **Lumins (cur1)**: Primary earnable currency
  - Earned through message activity (3 per message, 1-minute cooldown)
  - Daily/weekly rewards
  - Game winnings
  
- **Rusrab (cur2)**: Premium currency
  - Obtained through exchange system
  - Dynamic pricing based on total Lumins supply
  - Formula: `price = basePrice + (slope × totalCur1Supply)`

### Earning Mechanisms
1. **Message Activity**: 3 Lumins per message (60-second cooldown)
2. **Daily Rewards**: Configurable daily bonus
3. **Weekly Rewards**: Larger weekly bonus
4. **Game Winnings**: Various multipliers per game type
5. **Voice Activity**: Tracked but not currently rewarded

## ⚖️ Moderation System

### Warning System
- **Predefined Reasons**: Server-configurable warning templates
- **Automatic Actions**: Escalating punishments based on warning count
- **Expiration**: Auto-cleanup of expired warnings
- **Thresholds**: Configurable mute/kick/ban limits

### Punishment Types
```typescript
enum PunishmentType {
  None    // Warning only
  Timeout // Discord timeout feature
  Mute    // Role-based muting
  Ban     // Server ban
}
```

### Configuration Options
- Mute threshold (default: 3 warnings)
- Kick threshold (default: 5 warnings)  
- Ban threshold (default: 7 warnings)
- Default mute duration (default: 60 minutes)
- Warning expiry period (optional)

## 🎲 Gaming System

### Blackjack Implementation
- **Standard Rules**: Hit, Stand, Double down options
- **Session Management**: Temporary game state storage
- **Auto-timeout**: 90-second inactivity limit
- **Payout System**: Standard 1:1 odds, 3:2 for blackjack

### Other Games
- **Roulette**: Color/number betting with appropriate odds
- **Dice**: Simple high/low betting mechanics
- **RPS**: AI opponent with randomized choices

## 📈 Activity Tracking

### Metrics Collected
```javascript
// Per-member tracking
{
  msgCount: 0,      // Total messages sent
  voiceSeconds: 0,  // Total voice channel time
  xp: 0,           // Experience points
  level: 0         // Current level
}
```

### XP/Level System
- Currently tracks but doesn't actively reward
- Foundation for future leveling features
- Voice activity monitoring via `voiceStateUpdate` events

## 🔧 Configuration Management

### Environment Variables (Required)
```bash
DATABASE_URL=file:./database.sqlite
DISCORD_TOKEN=your_bot_token_here
```

### Config File Structure
```json
{
  "token": "DISCORD_TOKEN",
  "botID": "bot_application_id", 
  "devGuild": "development_guild_id",
  "developerIds": ["dev_user_id"],
  "sqliteFileName": "database.sqlite"
}
```

## 🛡️ Security & Error Handling

### Permission Validation
- Command-level permission checking
- Role hierarchy respect for moderation
- User ownership validation for economic transactions

### Error Handling Strategies
- Database transaction rollback on failures
- Graceful interaction response fallbacks
- Comprehensive logging system with categorized levels

### Logging Categories
```javascript
// Available log levels
['error', 'warn', 'info', 'debug', 'success', 'system', 
 'component', 'command', 'event', 'database', 'cache']
```

## 🚀 Development Commands

### Essential npm Scripts
```bash
# Development
npm run dev              # Start with auto-reload
npm start               # Production start

# Database Management  
npm run prisma:push     # Sync schema to database
npm run prisma:studio   # Open database GUI
npm run prisma:migrate:dev    # Create development migration
npm run prisma:migrate:deploy # Deploy migrations to production
```

### Development Workflow
1. **Setup**: `npm install` → Configure `.env` → `npm run prisma:push`
2. **Development**: `npm run dev` for auto-reload
3. **Database Changes**: Modify `schema.prisma` → `npm run prisma:migrate:dev`
4. **Production**: `npm run prisma:migrate:deploy` → `npm start`

## 📁 File Structure Analysis

### Critical Files
- **`src/index.js`**: Bot entry point and initialization
- **`src/utils/InitializeHandlers.js`**: Orchestrates component loading
- **`prisma/schema.prisma`**: Complete database schema definition
- **`src/utils/DBConnector.js`**: Prisma client setup and management

### Module Categories
- **Commands**: 17 slash command implementations
- **Components**: 8 UI interaction handlers  
- **Events**: 2 Discord event processors
- **Utils**: 15+ utility modules for various functionalities

## 🔮 Future Enhancement Opportunities

### Planned Features
- Level-based rewards and role assignments
- Enhanced voice activity rewards
- Guild-specific customization options
- Advanced game modes and tournaments
- Comprehensive audit logging

### Technical Improvements
- Unit test suite implementation
- CI/CD pipeline setup
- Docker containerization
- Horizontal scaling preparation
- Performance monitoring integration

---

## 📞 Support & Maintenance

### Key Maintenance Tasks
1. **Database Cleanup**: Automated via WarnScheduler
2. **Log Monitoring**: Regular error log review
3. **Dependency Updates**: Monthly security updates
4. **Performance Monitoring**: Memory and response time tracking

### Troubleshooting Common Issues
- **Database Connection**: Check `DATABASE_URL` environment variable
- **Command Registration**: Verify bot permissions and token validity
- **Game Sessions**: Monitor memory usage for long-running sessions
- **Migration Failures**: Always backup database before schema changes

This documentation provides a complete technical overview of the Discord-project1 bot architecture, implementation details, and operational procedures.