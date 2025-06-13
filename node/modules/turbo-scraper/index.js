import puppeteer from 'puppeteer';
import cluster from 'cluster';
import os from 'os';
import logger from '#modules/logger/index.js';

/**
 * Ultra-Fast Google Maps Scraper
 * Optimized for maximum volume and speed
 */
class TurboScraper {
  constructor(options = {}) {
    this.concurrency = options.concurrency || Math.min(os.cpus().length * 2, 10);
    this.timeout = options.timeout || 30000; // 30s max per scrape
    this.maxReviews = options.maxReviews || 300; // Target 300 reviews
    this.browserPool = [];
    this.isInitialized = false;
    
    // Optimized browser options for speed
    this.browserOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images', // Skip images for speed
        '--disable-javascript', // We'll enable selectively
        '--memory-pressure-off'
      ]
    };
  }

  /**
   * Initialize browser pool
   */
  async initialize() {
    if (this.isInitialized) return;

    logger.info(`[TurboScraper] Initializing ${this.concurrency} browser instances...`);
    
    for (let i = 0; i < this.concurrency; i++) {
      try {
        const browser = await puppeteer.launch(this.browserOptions);
        this.browserPool.push(browser);
      } catch (error) {
        logger.error(`[TurboScraper] Failed to launch browser ${i}:`, error);
      }
    }

    this.isInitialized = true;
    logger.info(`[TurboScraper] Initialized ${this.browserPool.length} browsers`);
  }

  /**
   * Get browser from pool (round-robin)
   */
  getBrowser() {
    if (this.browserPool.length === 0) {
      throw new Error('No browsers available in pool');
    }
    return this.browserPool[Math.floor(Math.random() * this.browserPool.length)];
  }

  /**
   * Extract FID from Google Maps URL or search
   */
  async extractFIDFromSearch(query) {
    const browser = this.getBrowser();
    const page = await browser.newPage();
    
    try {
      // Set aggressive timeouts
      await page.setDefaultTimeout(10000);
      await page.setDefaultNavigationTimeout(10000);

      // Block unnecessary resources
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['stylesheet', 'font', 'image', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Search Google Maps
      await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, {
        waitUntil: 'domcontentloaded'
      });

      // Wait for results and extract FID from URL
      await page.waitForSelector('[data-value="Directions"]', { timeout: 5000 });
      
      const url = page.url();
      const fidMatch = url.match(/!1s0x[a-f0-9]+:0x[a-f0-9]+/);
      
      if (fidMatch) {
        return fidMatch[0].replace('!1s', '');
      }

      // Alternative: extract from data attributes
      const fid = await page.evaluate(() => {
        const directionButton = document.querySelector('[data-value="Directions"]');
        return directionButton?.closest('[data-fid]')?.getAttribute('data-fid');
      });

      return fid;

    } finally {
      await page.close();
    }
  }

  /**
   * Scrape reviews for a given FID with maximum speed and volume
   */
  async scrapeReviewsByFID(fid, options = {}) {
    const startTime = Date.now();
    const { language = 'en', sort = 'newest' } = options;
    
    logger.info(`[TurboScraper] Starting review scrape for FID: ${fid}`);

    // Launch multiple parallel scrapers for different review pages
    const tasks = [];
    const reviewsPerTask = Math.ceil(this.maxReviews / this.concurrency);

    for (let i = 0; i < this.concurrency; i++) {
      tasks.push(this.scrapeReviewPage(fid, {
        startIndex: i * reviewsPerTask,
        count: reviewsPerTask,
        language,
        sort
      }));
    }

    try {
      const results = await Promise.allSettled(tasks);
      const allReviews = [];

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          allReviews.push(...result.value);
        }
      }

      // Deduplicate reviews by review ID
      const uniqueReviews = this.deduplicateReviews(allReviews);
      
      // Sort by recency for recency score boost
      const sortedReviews = this.sortByRecency(uniqueReviews);
      
      // Take top reviews up to maxReviews
      const finalReviews = sortedReviews.slice(0, this.maxReviews);

      const duration = Date.now() - startTime;
      logger.info(`[TurboScraper] Scraped ${finalReviews.length} reviews in ${duration}ms`);

      return finalReviews;

    } catch (error) {
      logger.error(`[TurboScraper] Error scraping reviews:`, error);
      return [];
    }
  }

  /**
   * Scrape a specific page of reviews
   */
  async scrapeReviewPage(fid, options = {}) {
    const { startIndex = 0, count = 50, language = 'en', sort = 'newest' } = options;
    const browser = this.getBrowser();
    const page = await browser.newPage();

    try {
      // Ultra-aggressive optimizations
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['stylesheet', 'font', 'image', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Navigate directly to place with FID
      const url = `https://www.google.com/maps/place/?ftid=${fid}&hl=${language}`;
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      // Click reviews tab
      await page.waitForSelector('[data-tab-index="1"]', { timeout: 5000 });
      await page.click('[data-tab-index="1"]');

      // Set sort order if needed
      if (sort !== 'newest') {
        await this.setSortOrder(page, sort);
      }

      // Scroll to load more reviews
      await this.scrollToLoadReviews(page, count + startIndex);

      // Extract reviews using optimized selectors
      const reviews = await page.evaluate((startIdx, cnt) => {
        const reviewElements = document.querySelectorAll('[data-review-id]');
        const extractedReviews = [];

        for (let i = startIdx; i < Math.min(startIdx + cnt, reviewElements.length); i++) {
          const element = reviewElements[i];
          if (!element) continue;

          try {
            const review = {
              reviewId: element.getAttribute('data-review-id'),
              author: element.querySelector('[data-local-attribute="d3bn"]')?.textContent?.trim(),
              rating: parseInt(element.querySelector('[role="img"]')?.getAttribute('aria-label')?.match(/\d+/)?.[0]) || 0,
              text: element.querySelector('[data-expandable-section]')?.textContent?.trim(),
              date: element.querySelector('[data-date-string]')?.textContent?.trim(),
              helpful: parseInt(element.querySelector('[data-helpful-count]')?.textContent?.match(/\d+/)?.[0]) || 0,
              photos: element.querySelectorAll('[data-photo-url]').length,
              response: element.querySelector('[data-owner-response]')?.textContent?.trim()
            };

            if (review.reviewId && review.author) {
              extractedReviews.push(review);
            }
          } catch (err) {
            console.error('Error extracting review:', err);
          }
        }

        return extractedReviews;
      }, startIndex, count);

      return reviews;

    } catch (error) {
      logger.error(`[TurboScraper] Error scraping page:`, error);
      return [];
    } finally {
      await page.close();
    }
  }

  /**
   * Scroll to load more reviews
   */
  async scrollToLoadReviews(page, targetCount) {
    let loadedCount = 0;
    let attempts = 0;
    const maxAttempts = 10;

    while (loadedCount < targetCount && attempts < maxAttempts) {
      // Scroll down
      await page.evaluate(() => {
        const reviewsContainer = document.querySelector('[data-reviews-container]');
        if (reviewsContainer) {
          reviewsContainer.scrollTop = reviewsContainer.scrollHeight;
        } else {
          window.scrollTo(0, document.body.scrollHeight);
        }
      });

      // Wait for new reviews to load
      await page.waitForTimeout(500);

      // Count loaded reviews
      loadedCount = await page.evaluate(() => {
        return document.querySelectorAll('[data-review-id]').length;
      });

      attempts++;
    }
  }

  /**
   * Set sort order for reviews
   */
  async setSortOrder(page, sort) {
    const sortMap = {
      'newest': 'data-sort-newest',
      'relevant': 'data-sort-relevant', 
      'highest': 'data-sort-highest',
      'lowest': 'data-sort-lowest'
    };

    const selector = sortMap[sort];
    if (selector) {
      try {
        await page.waitForSelector(`[${selector}]`, { timeout: 2000 });
        await page.click(`[${selector}]`);
        await page.waitForTimeout(1000);
      } catch (error) {
        logger.warn(`[TurboScraper] Could not set sort order to ${sort}`);
      }
    }
  }

  /**
   * Deduplicate reviews by ID
   */
  deduplicateReviews(reviews) {
    const seen = new Set();
    return reviews.filter(review => {
      if (seen.has(review.reviewId)) {
        return false;
      }
      seen.add(review.reviewId);
      return true;
    });
  }

  /**
   * Sort reviews by recency (newest first)
   */
  sortByRecency(reviews) {
    return reviews.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB - dateA; // Newest first
    });
  }

  /**
   * Cleanup browser pool
   */
  async cleanup() {
    logger.info('[TurboScraper] Cleaning up browser pool...');
    
    for (const browser of this.browserPool) {
      try {
        await browser.close();
      } catch (error) {
        logger.error('[TurboScraper] Error closing browser:', error);
      }
    }
    
    this.browserPool = [];
    this.isInitialized = false;
  }
}

export default TurboScraper;