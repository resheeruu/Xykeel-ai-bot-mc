# Xykeel — Autonomous Minecraft AI Player

Xykeel is an independent AI player that lives in your Minecraft world. When you're offline, Xykeel takes over your account and lives his own Minecraft life — building, farming, mining, trading, and pursuing his own goals. When you return, he safely steps aside and lets you play.

## What Xykeel Is

- An autonomous AI player with his own personality, goals, and projects
- A friend and teammate — not a servant or command executor
- A resident of the same Minecraft world who makes his own decisions
- Capable of disagreeing, refusing, or suggesting alternatives

## What Xykeel Is Not

- Not a bot that follows orders
- Not a cheat or exploit tool
- Not designed to bypass server rules or anti-cheat systems

## Architecture

```
src/
├── index.ts              # Main Xykeel class — startup, autonomy loop, state
├── config/               # Configuration loading from environment variables
├── logging/              # Winston-based structured logging
├── ai/                   # AI provider abstraction (local, OpenAI, Ollama)
├── memory/               # Persistent memory store (JSON-backed)
├── goals/                # Goal system with prioritization
├── safety/               # Health checks and risk assessment
├── handoff/              # One-account human/XYKEEL handoff logic
├── minecraft/            # Mineflayer client connection (Phase 2+)
├── autonomy/             # Autonomous decision loop (Phase 4+)
├── navigation/           # Pathfinding and movement (Phase 3+)
├── survival/             # Food, health, danger handling (Phase 3+)
├── inventory/            # Inventory management (Phase 3+)
├── world/                # World state observation (Phase 2+)
├── business/             # Business/economy system (Phase 6+)
├── relationships/        # Player relationship tracking (Phase 7+)
└── persistence/          # Data persistence layer (Phase 4+)
```

## Setup

### Requirements

- Node.js >= 18.0.0
- A Minecraft account (Microsoft or offline mode)
- A Minecraft server that permits automated clients

### Install

```bash
npm install
```

### Configure

```bash
cp .env.example .env
# Edit .env with your settings
```

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `MC_HOST` | Server address | `localhost` |
| `MC_PORT` | Server port | `25565` |
| `MC_VERSION` | Minecraft version | `1.21.1` |
| `MC_USERNAME` | In-game username | `Xykeel` |
| `MC_AUTH` | Auth type: `microsoft` or `offline` | `offline` |
| `MC_EMAIL` | Microsoft account email | — |
| `MC_PASSWORD` | Account password | — |
| `OWNER_UUID` | Your Minecraft UUID | — |
| `OWNER_USERNAME` | Your Minecraft username | — |
| `AI_PROVIDER` | `local`, `openai`, or `ollama` | `local` |
| `AI_API_KEY` | API key for remote AI providers | — |
| `AI_MODEL` | Model name for AI provider | — |
| `AUTONOMY_INTERVAL` | Decision loop interval (ms) | `30000` |
| `HANDOFF_DELAY` | Delay before Xykeel connects (ms) | `30000` |
| `LOG_LEVEL` | `error`, `warn`, `info`, `debug` | `info` |
| `STORAGE_PATH` | Persistent data directory | `./data` |

### Development

```bash
# TypeScript check
node node_modules/typescript/bin/tsc --noEmit

# Run tests
node --experimental-vm-modules node_modules/vitest/vitest.mjs run

# Start (dev mode)
npx tsx src/index.ts
```

## How Autonomy Works

Xykeel runs a persistent decision loop:

1. **Observe** — Check world state, health, hunger, threats
2. **Update Memory** — Record observations
3. **Check Needs** — Address survival requirements first
4. **Evaluate Goals** — Prioritize active goals
5. **Decide** — Choose highest-priority action (AI or deterministic fallback)
6. **Execute** — Perform Minecraft actions
7. **Record** — Log results and update memory
8. **Repeat**

Goals are split into two layers:
- **Player requests** — Things you ask Xykeel to do (capped priority)
- **Xykeel's own goals** — His personal projects and ambitions

## One-Account Handoff

There is only ONE Minecraft account. The handoff works like this:

1. You disconnect from the server
2. After a configurable delay, Xykeel detects you're offline
3. Xykeel connects and restores his persistent state
4. Xykeel plays autonomously
5. When you connect, Xykeel detects your session
6. Xykeel saves state, stops activities, and disconnects
7. You resume control

## Server Compatibility

**First target:** Lunamoon SMP

Xykeel uses a server adapter system so he can work with different servers. Server-specific configuration (economy, shops, claims, commands) is handled through config.

### Important

**Automated client use MUST be permitted by your target Minecraft server.** Check server rules before deploying Xykeel. He does not implement any bypass, stealth, or anti-detection features.

## Safety

Xykeel evaluates risk before actions:
- Health and hunger monitoring
- Threat detection
- Inventory capacity checks
- Tool durability awareness
- Safe retreat behavior

## Testing

78 tests across 14 test files covering:
- Configuration loading
- Logger creation and categories
- Session state and handoff logic
- Goal creation and prioritization
- Memory persistence and pruning
- Safety health checks and risk assessment
- AI provider abstraction
- Core Xykeel lifecycle (XykeelBot orchestrator)
- Minecraft connection, chat, world, inventory tracking
- Navigation and survival actions
- Autonomous planner
- Home, farm, and location systems
- Business system with financial tracking
- Relationship system with trust scoring

## Current Status

**Phase 1: Complete** — Foundation, config, logging, tests, startup/shutdown
**Phase 2: Complete** — Minecraft connection (Mineflayer), chat, world, inventory
**Phase 3: Complete** — Navigation, survival actions, gathering
**Phase 4: Complete** — Autonomous planner, decision loop
**Phase 5: Complete** — Personal life (home, farming, locations)
**Phase 6: Complete** — Business system with transactions
**Phase 7: Complete** — Relationship system with trust/sentiment
**Phase 8: Complete** — Handoff state machine integrated
**Phase 9: Complete** — Live Minecraft integration

Phase 9 wired all systems together:
- XykeelBot orchestrator connects Minecraft client to all subsystems
- Real health/hunger/state drives survival priority
- Chat events feed relationship system
- Inventory state drives gathering goals
- Memory records real events (mining, farming, exploration)
- Handoff manages session transitions
- Status reporter logs runtime state every 60 seconds
- Graceful shutdown saves all state

**Before live server testing:**
1. Verify target server permits automated clients
2. Verify server Minecraft version
3. Configure `.env` with real server details
4. Test on a local/creative server first

## License

MIT
