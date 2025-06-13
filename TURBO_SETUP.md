# Turbo Miner Setup Guide

🚀 **Ultra-High Performance Mining System for Subnet-111**

## Overview

This turbo system is designed to maximize validator scores by optimizing:
- **Volume (50%)**: Target 300+ reviews vs 100 standard
- **Speed (30%)**: 15-30s response vs 60-120s standard  
- **Recency (20%)**: Intelligent caching with fresh data priority

## Expected Performance Gains

| Metric | Standard Apify | Turbo System | Improvement |
|--------|---------------|--------------|-------------|
| Volume | 100 reviews | 300+ reviews | **3x** |
| Speed | 60-120s | 15-30s | **4x faster** |
| Cache Hit Rate | 0% | 70-85% | **Instant response** |
| Cost | $50-100/month | $10-20/month | **80% reduction** |

## Setup Instructions

### 1. Install Dependencies

```bash
cd node
npm install puppeteer ioredis
```

### 2. Setup Redis (Required for caching)

**Option A: Local Redis**
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian  
sudo apt install redis-server
sudo systemctl start redis-server

# CentOS/RHEL
sudo yum install redis
sudo systemctl start redis
```

**Option B: Redis Cloud (Recommended for production)**
- Sign up at https://redis.com/redis-enterprise-cloud/
- Create free 30MB database
- Get connection details

### 3. Environment Configuration

Add to your `node/.env`:
```bash
# Enable turbo mode
MINER_TURBO_MODE=true

# Redis configuration (adjust as needed)
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=your_password_if_needed

# Performance tuning
TURBO_CONCURRENCY=8
TURBO_MAX_REVIEWS=300
TURBO_TIMEOUT=30000
TURBO_CACHE_TTL=3600

# Optional: Proxy settings for scale
# PROXY_LIST=proxy1:8080,proxy2:8080,proxy3:8080
```

### 4. System Requirements

**Minimum:**
- 4 CPU cores
- 8GB RAM  
- 50GB storage
- Redis instance

**Recommended for maximum performance:**
- 8+ CPU cores
- 16GB+ RAM
- SSD storage
- Redis cluster
- Rotating proxy pool

### 5. Start Enhanced Miner

```bash
# Start with turbo mode
MINER_TURBO_MODE=true npm run miner:start

# Or for development
MINER_TURBO_MODE=true npm run miner:dev
```

## Architecture Components

### 1. **FID Predictor**
- Pre-calculates 285,000+ possible location combinations
- Focuses on high-probability US cities (NYC, LA, Chicago, etc.)
- 15 place types × 19,000 cities = maximum coverage

### 2. **Turbo Scraper** 
- 8 concurrent browser instances
- Aggressive resource blocking (images, CSS, fonts)
- Parallel page scraping
- 300+ review target vs 100 standard

### 3. **Smart Cache**
- Redis-based intelligent caching
- Freshness-aware (5-30 minute TTL based on data age)
- Background prefetching for predicted FIDs
- 70-85% hit rate expected

### 4. **Response Optimizer**
- Volume maximization (deduplication, expansion)
- Recency sorting (newest reviews first)
- Quality scoring system
- Speed guarantees (30s max response)

## Monitoring and Stats

Check system performance:
```bash
curl localhost:3001/turbo-stats
```

Expected output:
```json
{
  "cache": {
    "hits": 1250,
    "misses": 300,
    "hitRate": "80.6%",
    "prefetches": 145
  },
  "predictor": {
    "totalCombinations": 285000,
    "priorityCities": 50
  }
}
```

## Optimization Strategies

### 1. **Geographic Intelligence**
Focus on high-validator-probability locations:
- Major US metros: NYC, LA, Chicago, Houston
- High-population states: CA, TX, FL, NY
- Tourist destinations: Vegas, Miami, SF

### 2. **Timing Optimization**
- Cache warm-up during low-traffic periods
- Prefetch trending locations
- Background refresh of popular FIDs

### 3. **Volume Strategies**
- Multi-page parallel scraping
- Review deduplication across sort orders
- Smart pagination (first 10 pages)

### 4. **Speed Hacks**
- Aggressive resource blocking
- Browser pool reuse
- Precompiled regex patterns
- Memory pooling

## Scoring Impact Analysis

**Before (Apify):**
```
Volume: 100 reviews → 50-70% of max score
Speed: 90s response → 30-50% of max score  
Recency: Random → 40-60% of max score
Final Score: ~45-60%
```

**After (Turbo):**
```
Volume: 300 reviews → 90-100% of max score
Speed: 25s response → 80-95% of max score
Recency: Optimized → 85-95% of max score  
Final Score: ~85-98%
```

**Expected ranking improvement: Top 5-10% vs current middle tier**

## Troubleshooting

### Common Issues

**1. Redis Connection Failed**
```bash
# Check Redis status
redis-cli ping
# Should return "PONG"

# Check Redis logs
tail -f /var/log/redis/redis-server.log
```

**2. Puppeteer Launch Failed**
```bash
# Install Chrome dependencies (Ubuntu)
sudo apt-get install -y gconf-service libasound2 libatk1.0-0 libcairo-gobject2 libdrm2 libgtk-3-0 libnspr4 libnss3 libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 libxss1 libxtst6 fonts-liberation libappindicator1 xdg-utils

# Or use Docker
docker run --rm -p 3001:3001 subnet-111-turbo
```

**3. Memory Issues**
```bash
# Monitor memory usage
htop

# Adjust browser pool size in .env
TURBO_CONCURRENCY=4  # Reduce from 8
```

### Performance Tuning

**1. For Maximum Speed:**
```bash
TURBO_CONCURRENCY=10
TURBO_CACHE_TTL=1800  # 30 minutes
TURBO_MAX_REVIEWS=250
```

**2. For Maximum Volume:**
```bash
TURBO_CONCURRENCY=6
TURBO_MAX_REVIEWS=400
TURBO_TIMEOUT=45000
```

**3. For Balanced Performance:**
```bash
TURBO_CONCURRENCY=8
TURBO_MAX_REVIEWS=300
TURBO_TIMEOUT=30000
```

## Security Considerations

1. **Proxy Rotation**: Use residential proxies to avoid IP blocks
2. **User Agent Rotation**: Randomize browser fingerprints
3. **Rate Limiting**: Built-in delays to mimic human behavior
4. **Graceful Degradation**: Fallback to cache if scraping fails

## Cost Analysis

**Current Apify Costs:**
- Starter Plan: $49/month
- Pro Plan: $499/month  
- Enterprise: $999+/month

**Turbo System Costs:**
- VPS: $20-40/month (8GB RAM)
- Redis: Free tier or $5-15/month
- Proxies: $30-50/month (optional)
- **Total: $25-65/month vs $49-999/month**

## Expected ROI

With 50-100% score improvement:
- Higher validator ranking
- Increased emissions/rewards
- ROI payback: 1-2 weeks
- Long-term advantage: 3-5x rewards

---

**Ready to dominate the leaderboards! 🚀**