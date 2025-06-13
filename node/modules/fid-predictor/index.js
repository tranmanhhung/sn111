import logger from '../logger/index.js';
import { City, State } from 'country-state-city';
import crypto from 'crypto';

/**
 * FID Prediction System
 * Pre-generates potential FIDs based on validator patterns
 */
class FIDPredictor {
  constructor() {
    this.placeTypes = [
      "restaurant", "cafe", "hospital", "hotel", "museum", "park",
      "shopping mall", "gym", "library", "pharmacy", "gas station",
      "supermarket", "bank", "movie theater", "bar"
    ];
    
    // High-probability US cities (population-weighted)
    this.hotCities = this.getHighProbabilityCities();
    
    // Pre-computed search combinations
    this.searchCombinations = this.generateSearchCombinations();
    
    logger.info(`[FIDPredictor] Initialized with ${this.searchCombinations.length} search combinations`);
  }

  /**
   * Get high-probability US cities based on population and frequency
   */
  getHighProbabilityCities() {
    const states = State.getStatesOfCountry('US');
    const hotCities = [];
    
    // Major metros with high validator probability
    const priorityCities = [
      { name: 'New York', state: 'NY' },
      { name: 'Los Angeles', state: 'CA' },
      { name: 'Chicago', state: 'IL' },
      { name: 'Houston', state: 'TX' },
      { name: 'Phoenix', state: 'AZ' },
      { name: 'Philadelphia', state: 'PA' },
      { name: 'San Antonio', state: 'TX' },
      { name: 'San Diego', state: 'CA' },
      { name: 'Dallas', state: 'TX' },
      { name: 'San Jose', state: 'CA' }
    ];

    // Add all cities from top 10 most populous states
    const topStates = ['CA', 'TX', 'FL', 'NY', 'PA', 'IL', 'OH', 'GA', 'NC', 'MI'];
    
    for (const stateCode of topStates) {
      const state = states.find(s => s.isoCode === stateCode);
      if (state) {
        const cities = City.getCitiesOfState('US', stateCode);
        hotCities.push(...cities.map(city => ({
          name: city.name,
          state: state.name,
          location: `${city.name}, ${state.name}`
        })));
      }
    }

    // Add priority cities with higher weight
    priorityCities.forEach(city => {
      const state = states.find(s => s.isoCode === city.state);
      if (state) {
        hotCities.unshift({
          name: city.name,
          state: state.name,
          location: `${city.name}, ${state.name}`,
          priority: true
        });
      }
    });

    return hotCities;
  }

  /**
   * Generate all possible search combinations
   */
  generateSearchCombinations() {
    const combinations = [];
    
    for (const placeType of this.placeTypes) {
      for (const city of this.hotCities) {
        combinations.push({
          query: `${placeType} in ${city.location}`,
          placeType,
          location: city.location,
          priority: city.priority || false,
          hash: this.hashQuery(`${placeType} in ${city.location}`)
        });
      }
    }

    // Sort by priority (priority cities first)
    return combinations.sort((a, b) => {
      if (a.priority && !b.priority) return -1;
      if (!a.priority && b.priority) return 1;
      return 0;
    });
  }

  /**
   * Hash query for caching
   */
  hashQuery(query) {
    return crypto.createHash('md5').update(query).digest('hex');
  }

  /**
   * Get high-probability FID combinations for pre-caching
   * Returns top N combinations based on population and frequency
   */
  getTopCombinations(limit = 1000) {
    return this.searchCombinations.slice(0, limit);
  }

  /**
   * Get combinations for a specific place type
   */
  getCombinationsForType(placeType) {
    return this.searchCombinations.filter(combo => combo.placeType === placeType);
  }

  /**
   * Get combinations for a specific location
   */
  getCombinationsForLocation(location) {
    return this.searchCombinations.filter(combo => combo.location === location);
  }

  /**
   * Predict next likely FID based on patterns
   * This could be enhanced with ML models later
   */
  predictNextFID(recentQueries = []) {
    // Simple heuristic: favor combinations not recently used
    const recentHashes = new Set(recentQueries.map(q => this.hashQuery(q)));
    
    const candidates = this.searchCombinations.filter(combo => 
      !recentHashes.has(combo.hash)
    );

    // Return top candidates with priority boost
    return candidates.slice(0, 100);
  }

  /**
   * Get statistics about prediction coverage
   */
  getStats() {
    return {
      totalCombinations: this.searchCombinations.length,
      placeTypes: this.placeTypes.length,
      cities: this.hotCities.length,
      priorityCities: this.hotCities.filter(c => c.priority).length
    };
  }
}

export default FIDPredictor;