import logger from '../logger/index.js';
import time from '../time/index.js';

/**
 * Response Optimizer for Maximum Validator Scores
 * Optimizes review data for Volume (50%) + Speed (30%) + Recency (20%)
 */
class ResponseOptimizer {
  constructor(options = {}) {
    this.targetVolume = options.targetVolume || 300; // Target 300 reviews
    this.maxResponseTime = options.maxResponseTime || 30000; // 30s max
    this.recencyBoostDays = options.recencyBoostDays || 30; // Boost reviews from last 30 days
  }

  /**
   * Optimize reviews for maximum validator score
   */
  optimizeForScore(reviews, startTime) {
    const processingStart = Date.now();
    
    // 1. Volume Optimization (50% of score)
    const volumeOptimized = this.optimizeVolume(reviews);
    
    // 2. Recency Optimization (20% of score) 
    const recencyOptimized = this.optimizeRecency(volumeOptimized);
    
    // 3. Quality Enhancement
    const qualityEnhanced = this.enhanceQuality(recencyOptimized);
    
    // 4. Speed Optimization (ensure fast response)
    const finalReviews = this.finalizeResponse(qualityEnhanced, startTime);
    
    const processingTime = Date.now() - processingStart;
    logger.info(`[ResponseOptimizer] Optimized ${reviews.length} → ${finalReviews.length} reviews in ${processingTime}ms`);
    
    return finalReviews;
  }

  /**
   * Volume Optimization - Maximize review count (50% of score)
   */
  optimizeVolume(reviews) {
    // Remove duplicates by multiple criteria
    const deduped = this.aggressiveDedupe(reviews);
    
    // If we have less than target, try to enhance existing reviews
    if (deduped.length < this.targetVolume) {
      return this.expandReviewData(deduped);
    }
    
    // If we have more than target, select the best ones
    return this.selectBestReviews(deduped, this.targetVolume);
  }

  /**
   * Aggressive deduplication to maximize unique reviews
   */
  aggressiveDedupe(reviews) {
    const seen = new Set();
    const unique = [];
    
    for (const review of reviews) {
      // Create multiple uniqueness keys
      const keys = [
        review.reviewId,
        `${review.author}_${review.date}`,
        `${review.text?.substring(0, 50)}_${review.rating}`,
        review.text?.trim().toLowerCase().substring(0, 100)
      ].filter(Boolean);
      
      const isUnique = keys.every(key => !seen.has(key));
      
      if (isUnique && review.reviewId) {
        keys.forEach(key => seen.add(key));
        unique.push(review);
      }
    }
    
    return unique;
  }

  /**
   * Expand review data if volume is low
   */
  expandReviewData(reviews) {
    // Add synthetic variations for edge cases
    const expanded = [...reviews];
    
    // If we're really short on reviews, we might need to
    // enhance existing reviews or find alternative sources
    if (reviews.length < 50) {
      logger.warn(`[ResponseOptimizer] Low review count: ${reviews.length}`);
      // Could implement fallback strategies here
    }
    
    return expanded;
  }

  /**
   * Select best reviews when we have excess volume
   */
  selectBestReviews(reviews, targetCount) {
    // Score each review based on multiple factors
    const scored = reviews.map(review => ({
      ...review,
      _score: this.calculateReviewScore(review)
    }));
    
    // Sort by score and take top N
    scored.sort((a, b) => b._score - a._score);
    
    return scored.slice(0, targetCount).map(({ _score, ...review }) => review);
  }

  /**
   * Calculate review quality score
   */
  calculateReviewScore(review) {
    let score = 0;
    
    // Recency score (most important for 20% component)
    const daysSinceReview = this.getDaysSince(review.date);
    if (daysSinceReview < 7) score += 10;
    else if (daysSinceReview < 30) score += 5;
    else if (daysSinceReview < 90) score += 2;
    
    // Content quality
    if (review.text && review.text.length > 50) score += 3;
    if (review.text && review.text.length > 200) score += 2;
    
    // Engagement metrics
    if (review.helpful > 0) score += review.helpful;
    if (review.photos > 0) score += review.photos;
    if (review.response) score += 1; // Owner response indicates active place
    
    // Rating diversity (avoid all 5-star reviews)
    if (review.rating >= 3 && review.rating <= 4) score += 1;
    
    return score;
  }

  /**
   * Recency Optimization - Boost recent reviews (20% of score)
   */
  optimizeRecency(reviews) {
    // Sort by date to ensure newest reviews come first
    const sorted = reviews.sort((a, b) => {
      const dateA = new Date(a.date || 0);
      const dateB = new Date(b.date || 0);
      return dateB - dateA; // Newest first
    });
    
    // Enhance recent reviews with better formatting
    return sorted.map((review, index) => {
      const daysSince = this.getDaysSince(review.date);
      
      // Mark very recent reviews for priority
      if (daysSince < 7) {
        review._priority = 'high';
      } else if (daysSince < 30) {
        review._priority = 'medium';
      }
      
      return review;
    });
  }

  /**
   * Quality Enhancement - Improve review data quality
   */
  enhanceQuality(reviews) {
    return reviews.map(review => {
      // Standardize date formats for consistency
      if (review.date) {
        review.date = this.standardizeDate(review.date);
      }
      
      // Clean text content
      if (review.text) {
        review.text = this.cleanReviewText(review.text);
      }
      
      // Ensure required fields
      review.reviewId = review.reviewId || this.generateReviewId(review);
      review.rating = parseInt(review.rating) || 0;
      review.helpful = parseInt(review.helpful) || 0;
      review.photos = parseInt(review.photos) || 0;
      
      // Remove internal scoring fields
      delete review._score;
      delete review._priority;
      
      return review;
    });
  }

  /**
   * Finalize response for speed optimization
   */
  finalizeResponse(reviews, startTime) {
    const elapsed = Date.now() - startTime;
    const remainingTime = this.maxResponseTime - elapsed;
    
    // If we're running out of time, truncate to ensure fast response
    if (remainingTime < 5000) { // Less than 5 seconds left
      const safeCount = Math.max(50, Math.floor(reviews.length * 0.8));
      logger.warn(`[ResponseOptimizer] Time pressure - returning ${safeCount} reviews`);
      return reviews.slice(0, safeCount);
    }
    
    return reviews;
  }

  /**
   * Get days since review date
   */
  getDaysSince(dateString) {
    if (!dateString) return Infinity;
    
    const reviewDate = new Date(dateString);
    if (isNaN(reviewDate.getTime())) return Infinity;
    
    const now = new Date();
    const diffTime = now - reviewDate;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Standardize date format
   */
  standardizeDate(dateString) {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      
      return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    } catch (error) {
      return dateString;
    }
  }

  /**
   * Clean review text
   */
  cleanReviewText(text) {
    if (!text) return '';
    
    return text
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s.,!?-]/g, '') // Remove special chars
      .substring(0, 1000); // Limit length
  }

  /**
   * Generate review ID if missing
   */
  generateReviewId(review) {
    const seed = `${review.author}_${review.date}_${review.rating}`;
    return Buffer.from(seed).toString('base64').substring(0, 16);
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats(originalCount, optimizedCount, processingTime) {
    return {
      originalCount,
      optimizedCount,
      compressionRatio: (optimizedCount / originalCount * 100).toFixed(1) + '%',
      processingTime: processingTime + 'ms',
      volumeScore: Math.min(100, (optimizedCount / this.targetVolume * 100)).toFixed(1) + '%'
    };
  }
}

export default ResponseOptimizer;