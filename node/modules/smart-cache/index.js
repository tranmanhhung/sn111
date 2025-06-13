import Redis from 'ioredis';
import logger from '#modules/logger/index.js';
import time from '#modules/time/index.js';

/**
 * Smart Caching System with Predictive Pre-loading
 * Optimized for Google Maps reviews with recency tracking
 */
class SmartCache {
  constructor(options = {}) {
    this.redis = new Redis({
      host: options.host || 'localhost',
      port: options.port || 6379,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    this.defaultTTL = options.ttl || 3600; // 1 hour default
    this.shortTTL = options.shortTTL || 600; // 10 minutes for hot data
    this.longTTL = options.longTTL || 7200; // 2 hours for cold data
    
    // Track cache performance
    this.stats = {
      hits: 0,
      misses: 0,
      prefetches: 0,
      evictions: 0
    };

    logger.info('[SmartCache] Initialized with Redis caching');
  }

  /**
   * Generate cache key for FID + parameters
   */
  generateKey(fid, params = {}) {
    const { language = 'en', sort = 'newest' } = params;
    return `reviews:${fid}:${language}:${sort}`;
  }

  /**
   * Generate metadata key for tracking freshness
   */
  generateMetaKey(key) {
    return `${key}:meta`;
  }

  /**
   * Check if cached data is fresh enough based on recency requirements
   */
  async isFresh(key, maxAge = 600) { // 10 minutes default
    try {
      const meta = await this.redis.get(this.generateMetaKey(key));
      if (!meta) return false;

      const metadata = JSON.parse(meta);
      const age = (Date.now() - metadata.timestamp) / 1000;
      
      return age < maxAge;
    } catch (error) {
      logger.error('[SmartCache] Error checking freshness:', error);
      return false;
    }
  }

  /**
   * Get reviews from cache with freshness check
   */
  async getReviews(fid, params = {}) {
    const key = this.generateKey(fid, params);
    
    try {
      // Check if data exists and is fresh
      const [data, isFresh] = await Promise.all([
        this.redis.get(key),
        this.isFresh(key, 300) // 5 minutes for reviews
      ]);

      if (data && isFresh) {
        this.stats.hits++;
        const reviews = JSON.parse(data);
        logger.debug(`[SmartCache] Cache HIT for ${fid} - ${reviews.length} reviews`);
        return reviews;
      }

      this.stats.misses++;
      logger.debug(`[SmartCache] Cache MISS for ${fid}`);
      return null;

    } catch (error) {
      logger.error('[SmartCache] Error getting cached reviews:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Store reviews in cache with metadata
   */
  async storeReviews(fid, reviews, params = {}) {
    const key = this.generateKey(fid, params);
    const metaKey = this.generateMetaKey(key);
    
    try {
      // Calculate TTL based on data quality and recency
      const ttl = this.calculateOptimalTTL(reviews);
      
      // Store reviews
      await this.redis.setex(key, ttl, JSON.stringify(reviews));
      
      // Store metadata
      const metadata = {
        timestamp: Date.now(),
        reviewCount: reviews.length,
        mostRecentReview: this.getMostRecentDate(reviews),
        ttl: ttl
      };
      await this.redis.setex(metaKey, ttl, JSON.stringify(metadata));

      logger.debug(`[SmartCache] Stored ${reviews.length} reviews for ${fid} (TTL: ${ttl}s)`);
      
    } catch (error) {
      logger.error('[SmartCache] Error storing reviews:', error);
    }
  }

  /**
   * Calculate optimal TTL based on review recency and volume
   */
  calculateOptimalTTL(reviews) {
    if (!reviews || reviews.length === 0) {
      return this.shortTTL; // Short TTL for empty results
    }

    const mostRecentDate = this.getMostRecentDate(reviews);
    const daysSinceRecent = (Date.now() - new Date(mostRecentDate)) / (1000 * 60 * 60 * 24);

    // Fresh reviews = shorter TTL for more frequent updates
    if (daysSinceRecent < 1) return this.shortTTL; // Very fresh
    if (daysSinceRecent < 7) return this.defaultTTL; // Moderately fresh
    return this.longTTL; // Older reviews
  }

  /**
   * Get most recent review date
   */
  getMostRecentDate(reviews) {
    if (!reviews || reviews.length === 0) return new Date(0);
    
    const dates = reviews
      .map(r => new Date(r.date))
      .filter(d => !isNaN(d.getTime()))
      .sort((a, b) => b - a);
    
    return dates[0] || new Date(0);
  }

  /**
   * Pre-fetch reviews for predicted FIDs
   */
  async prefetchReviews(fids, scraper) {
    logger.info(`[SmartCache] Starting prefetch for ${fids.length} FIDs`);
    
    const prefetchTasks = fids.map(async (fid) => {
      const key = this.generateKey(fid);
      
      // Skip if already cached and fresh
      if (await this.isFresh(key, 1800)) { // 30 minutes
        return;
      }

      try {
        logger.debug(`[SmartCache] Prefetching ${fid}`);
        const reviews = await scraper.scrapeReviewsByFID(fid);
        
        if (reviews && reviews.length > 0) {
          await this.storeReviews(fid, reviews);
          this.stats.prefetches++;
        }
        
      } catch (error) {
        logger.error(`[SmartCache] Prefetch failed for ${fid}:`, error);
      }
    });

    // Execute prefetches in batches to avoid overwhelming
    const batchSize = 5;
    for (let i = 0; i < prefetchTasks.length; i += batchSize) {
      const batch = prefetchTasks.slice(i, i + batchSize);
      await Promise.allSettled(batch);
      
      // Brief pause between batches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logger.info('[SmartCache] Prefetch completed');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) * 100;
    
    return {
      ...this.stats,
      hitRate: hitRate.toFixed(2) + '%',
      totalRequests: this.stats.hits + this.stats.misses
    };
  }

  /**
   * Warm up cache with high-probability FIDs
   */
  async warmUp(fidPredictor, scraper, limit = 100) {
    logger.info(`[SmartCache] Warming up cache with top ${limit} FIDs`);
    
    const topCombinations = fidPredictor.getTopCombinations(limit);
    
    // Convert combinations to FIDs (this would need the actual search logic)
    // For now, we'll simulate with the query strings
    const fids = topCombinations.map(combo => combo.hash); // Placeholder
    
    await this.prefetchReviews(fids, scraper);
    
    logger.info('[SmartCache] Cache warm-up completed');
  }

  /**
   * Clean up expired entries and optimize memory
   */
  async cleanup() {
    try {
      // Redis handles TTL automatically, but we can track evictions
      const info = await this.redis.info('memory');
      logger.debug('[SmartCache] Memory cleanup performed');
      
    } catch (error) {
      logger.error('[SmartCache] Error during cleanup:', error);
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    await this.redis.quit();
    logger.info('[SmartCache] Redis connection closed');
  }
}

export default SmartCache;