# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is subnet-111, a Bittensor subnet that operates a decentralized protocol for collecting and validating user-generated content (primarily Google Maps reviews). The subnet consists of validators and miners working together to provide high-quality review data through the oneoneone.io platform.

## Architecture

### Dual-Stack Architecture
- **Python layer**: Bittensor network communication (neurons/miner.py, neurons/validator.py)
- **Node.js layer**: Data processing and web scraping (node/ directory)
- **Communication**: Python processes communicate with Node.js APIs via HTTP

### Key Components
- **Validators**: Query miners with synthetic challenges, score responses, manage weights
- **Miners**: Scrape Google Maps reviews using Apify, respond to validator queries
- **Synapse Protocol**: GoogleMapsReviewsSynapse for validator-miner communication
- **Scoring System**: 50% volume + 30% speed + 20% recency with spot-check validation

## Development Commands

### Python Environment
```bash
# Setup conda environment
conda create -n subnet-111 python=3.12
conda activate subnet-111
pip install -r requirements.txt
pip install -e .

# Run tests
pytest tests/ -v
```

### Node.js Environment  
```bash
cd node
npm install

# Run tests with 100% coverage requirement
npm test

# Run linting
npm run lint

# Start services
npm run miner:start     # Production miner
npm run validator:start # Production validator
npm run miner:dev      # Development with nodemon
npm run validator:dev  # Development with nodemon
```

### Running the Subnet

#### Auto-updater (Recommended)
```bash
# Start with auto-updater
pm2 start ./auto-updater.sh --name "autoupdater-validator-prod" -- validator 111 validator default 9000
pm2 start ./auto-updater.sh --name "autoupdater-miner-prod" -- miner 111 miner default 9001
```

#### Manual Setup
```bash
# Validator
pm2 start npm --name node-validator --cwd ./node -- run validator:start
pm2 start "python neurons/validator.py --netuid 111 --wallet.name <wallet> --wallet.hotkey <hotkey> --axon.port 9000" --name validator

# Miner  
pm2 start npm --name node-miner --cwd ./node -- run miner:start
pm2 start "python neurons/miner.py --netuid 111 --wallet.name <wallet> --wallet.hotkey <hotkey> --axon.port 9001" --name miner
```

## Configuration

### Environment Files
- **Root .env**: General project settings (copy from .env.example)
- **node/.env**: Node.js settings requiring APIFY_TOKEN and PLATFORM_TOKEN (validators only)

### Key Configuration Files
- **oneoneone/config.py**: Shared timeout and validation settings
- **node/config.js**: Node.js service configuration with Apify actors and parameters
- **oneoneone/protocol.py**: Synapse protocol definitions

## Testing Strategy

### Node.js Tests
- **100% coverage requirement** enforced by Jest
- **Module pattern**: Each module has corresponding .test.js file
- **Integration tests**: Available via `npm run test:integration`
- **Import aliases**: Uses # prefix for internal imports (#modules, #routes, #utils, #config)

### Python Tests
- Located in tests/ directory
- Run with `pytest tests/ -v`
- Integration tests for protocol validation

## Key Patterns

### Node.js Module Structure
- **Modules**: Reusable utilities in modules/ (logger, array, response, etc.)
- **Routes**: API endpoints split by role (miner/, validator/)
- **Utils**: Validation-specific utilities in utils/validator/
- **Middlewares**: localhost-only middleware for security

### Python Architecture
- **Base classes**: BaseMinerNeuron, BaseValidatorNeuron in oneoneone/base/
- **Forward functions**: Validator logic in oneoneone/validator/forward.py
- **Reward logic**: Scoring in oneoneone/validator/reward.py

### Validation Process
1. Validator generates synthetic query (random location + place type)
2. Up to 50 miners selected randomly
3. 120-second timeout for responses
4. Spot-check validation: 3 random reviews verified against live data
5. Scoring: volume (50%) + speed (30%) + recency (20%)

## Required Dependencies

### API Access
- **APIFY_TOKEN**: Required for both miners and validators (Apify Starter plan minimum)
- **PLATFORM_TOKEN**: Required for validators only (contact subnet team)

### Apify Actors Used
- **Validators**: 'agents/google-maps-search', 'compass/Google-Maps-Reviews-Scraper'
- **Miners**: 'agents/google-maps-reviews'

## Process Management

All services run via PM2 with process naming conventions:
- Validators: node-validator, validator, autoupdater-validator-prod
- Miners: node-miner, miner, autoupdater-miner-prod

Monitor with `pm2 logs <process-name>` and `pm2 list`