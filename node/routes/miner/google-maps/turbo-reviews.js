import logger from '#modules/logger/index.js';
import responseService from '#modules/response/index.js';
import time from '#modules/time/index.js';
import TurboScraper from '#modules/turbo-scraper/index.js';
import SmartCache from '#modules/smart-cache/index.js';
import FIDPredictor from '#modules/fid-predictor/index.js';
import ResponseOptimizer from '#modules/response-optimizer/index.js';

// Initialize components
let turboScraper = null;
let smartCache = null;
let fidPredictor = null;
let responseOptimizer = null;
let isInitialized = false;

/**
 * Initialize the turbo system
 */
async function initializeTurboSystem() {
  if (isInitialized) return;

  logger.info('[TurboReviews] Initializing turbo mining system...');
  
  try {
    // Initialize components
    turboScraper = new TurboScraper({ 
      concurrency: 8, 
      maxReviews: 300,
      timeout: 30000 
    });
    
    smartCache = new SmartCache({ 
      ttl: 3600,
      shortTTL: 300, // 5 minutes for hot data
      longTTL: 7200 
    });
    
    fidPredictor = new FIDPredictor();
    
    responseOptimizer = new ResponseOptimizer({
      targetVolume: 300,
      maxResponseTime: 30000,
      recencyBoostDays: 30
    });

    // Initialize scraper browser pool
    await turboScraper.initialize();
    
    // Start background prefetching for predicted FIDs
    startBackgroundPrefetching();
    
    isInitialized = true;
    logger.info('[TurboReviews] Turbo system initialized successfully');
    
  } catch (error) {
    logger.error('[TurboReviews] Failed to initialize turbo system:', error);
    throw error;
  }
}

/**
 * Start background prefetching for high-probability FIDs
 */
function startBackgroundPrefetching() {
  // Prefetch top combinations every 30 minutes
  setInterval(async () => {
    try {
      logger.info('[TurboReviews] Starting background prefetch...');
      
      const topCombinations = fidPredictor.getTopCombinations(50);
      
      // Convert combinations to actual FIDs through search
      const fidTasks = topCombinations.slice(0, 20).map(async (combo) => {
        try {
          const fid = await turboScraper.extractFIDFromSearch(combo.query);
          return fid;
        } catch (error) {
          logger.warn(`[TurboReviews] Failed to get FID for ${combo.query}`);
          return null;
        }
      });

      const fids = (await Promise.allSettled(fidTasks))
        .filter(result => result.status === 'fulfilled' && result.value)
        .map(result => result.value);

      if (fids.length > 0) {
        await smartCache.prefetchReviews(fids, turboScraper);
        logger.info(`[TurboReviews] Prefetched ${fids.length} FIDs`);
      }
      
    } catch (error) {
      logger.error('[TurboReviews] Background prefetch error:', error);
    }
  }, 30 * 60 * 1000); // 30 minutes
}

/**
 * Ultra-fast Google Maps Reviews Route
 * Optimized for maximum validator scores: Volume (50%) + Speed (30%) + Recency (20%)
 * 
 * @param {import('express').Request} request - The request object
 * @param {import('express').Response} response - The response object
 */
const execute = async (request, response) => {
  const startTime = Date.now();
  
  try {
    // Initialize if needed
    if (!isInitialized) {
      await initializeTurboSystem();
    }

    const { fid } = request.params;
    const { language = 'en', sort = 'newest', timeout = 30000 } = request.query;
    
    logger.info(`[TurboReviews] TURBO request - FID: ${fid}, Lang: ${language}, Sort: ${sort}`);

    // Validate inputs
    if (!fid) {
      return responseService.badRequest(response, {
        error: 'Missing FID',
        message: 'FID parameter is required'
      });
    }

    // Step 1: Try cache first (SPEED optimization)
    logger.info(`[TurboReviews] Checking cache for ${fid}...`);
    let reviews = await smartCache.getReviews(fid, { language, sort });
    
    if (reviews && reviews.length > 0) {
      // Cache hit - optimize and return immediately
      const optimizedReviews = responseOptimizer.optimizeForScore(reviews, startTime);
      const responseTime = Date.now() - startTime;
      
      logger.info(`[TurboReviews] CACHE HIT - ${optimizedReviews.length} reviews in ${responseTime}ms`);
      
      return responseService.success(response, {
        status: 'success',
        source: 'cache',
        fid: fid,
        parameters: { language, sort },
        reviewCount: optimizedReviews.length,
        reviews: optimizedReviews,
        responseTime: responseTime,
        timestamp: time.getCurrentTimestamp()
      });
    }

    // Step 2: Cache miss - scrape with maximum speed and volume
    logger.info(`[TurboReviews] Cache miss - starting TURBO scrape for ${fid}`);
    
    // Set aggressive timeout based on remaining time
    const elapsed = Date.now() - startTime;
    const remainingTime = parseInt(timeout) - elapsed;
    const scrapeTimeout = Math.max(10000, remainingTime - 5000); // Leave 5s buffer
    
    // Launch parallel scraping
    const scrapeStartTime = Date.now();
    reviews = await Promise.race([
      turboScraper.scrapeReviewsByFID(fid, { language, sort }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Scrape timeout')), scrapeTimeout)
      )
    ]);

    const scrapeTime = Date.now() - scrapeStartTime;
    logger.info(`[TurboReviews] Scraped ${reviews?.length || 0} reviews in ${scrapeTime}ms`);

    // Step 3: Optimize response for maximum score
    if (!reviews || reviews.length === 0) {
      // Fallback: try to get from cache with relaxed freshness
      reviews = await smartCache.getReviews(fid, { language, sort });
      if (!reviews) reviews = [];
    }

    const optimizedReviews = responseOptimizer.optimizeForScore(reviews, startTime);
    
    // Step 4: Cache the results for future requests
    if (optimizedReviews.length > 0) {
      await smartCache.storeReviews(fid, optimizedReviews, { language, sort });
    }

    const totalResponseTime = Date.now() - startTime;
    
    // Step 5: Return optimized response
    const result = {
      status: 'success',
      source: 'scrape',
      fid: fid,
      parameters: { language, sort },
      reviewCount: optimizedReviews.length,
      reviews: optimizedReviews,
      responseTime: totalResponseTime,
      scrapeTime: scrapeTime,
      optimization: responseOptimizer.getOptimizationStats(
        reviews.length, 
        optimizedReviews.length, 
        totalResponseTime
      ),
      timestamp: time.getCurrentTimestamp()
    };

    logger.info(`[TurboReviews] SUCCESS - ${optimizedReviews.length} reviews in ${totalResponseTime}ms (${scrapeTime}ms scrape)`);
    
    return responseService.success(response, result);

  } catch (error) {
    const errorTime = Date.now() - startTime;
    logger.error(`[TurboReviews] ERROR after ${errorTime}ms:`, error);
    
    // Emergency fallback: try cache with any freshness
    try {
      const fallbackReviews = await smartCache.getReviews(request.params.fid, {});
      if (fallbackReviews && fallbackReviews.length > 0) {
        logger.warn(`[TurboReviews] Using stale cache as fallback`);
        return responseService.success(response, {
          status: 'success',
          source: 'fallback_cache',
          fid: request.params.fid,
          reviewCount: fallbackReviews.length,
          reviews: fallbackReviews.slice(0, 100), // Limited fallback
          responseTime: errorTime,
          timestamp: time.getCurrentTimestamp()
        });
      }
    } catch (fallbackError) {
      logger.error('[TurboReviews] Fallback also failed:', fallbackError);
    }

    return responseService.internalServerError(response, {
      error: 'Turbo scraping failed',
      message: error.message,
      responseTime: errorTime,
      timestamp: time.getCurrentTimestamp()
    });
  }
};

/**
 * Get turbo system statistics
 */
const getStats = async (request, response) => {
  try {
    if (!isInitialized) {
      return responseService.badRequest(response, {
        error: 'System not initialized'
      });
    }

    const stats = {
      cache: smartCache.getStats(),
      predictor: fidPredictor.getStats(),
      system: {
        initialized: isInitialized,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      }
    };

    return responseService.success(response, stats);
    
  } catch (error) {
    logger.error('[TurboReviews] Error getting stats:', error);
    return responseService.internalServerError(response, {
      error: 'Failed to get stats',
      message: error.message
    });
  }
};

/**
 * Cleanup turbo system
 */
const cleanup = async () => {
  logger.info('[TurboReviews] Cleaning up turbo system...');
  
  try {
    if (turboScraper) {
      await turboScraper.cleanup();
    }
    
    if (smartCache) {
      await smartCache.close();
    }
    
    isInitialized = false;
    logger.info('[TurboReviews] Cleanup completed');
    
  } catch (error) {
    logger.error('[TurboReviews] Cleanup error:', error);
  }
};

// Graceful shutdown
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

export default {
  execute,
  getStats,
  cleanup
};