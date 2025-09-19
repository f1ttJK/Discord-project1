"use strict";

/**
 * Request deduplication utility to prevent multiple concurrent requests to same endpoint
 */
class RequestQueue {
  constructor() {
    this.pending = new Map();
  }

  /**
   * Execute function with deduplication - if same key is already pending, return the existing promise
   * @param {string} key - unique key for the request
   * @param {Function} fn - async function to execute
   * @returns {Promise} - result of the function
   */
  async execute(key, fn) {
    // If request is already pending, return the existing promise
    if (this.pending.has(key)) {
      return this.pending.get(key);
    }

    // Execute the function and store the promise
    const promise = fn().finally(() => {
      // Clean up when done
      this.pending.delete(key);
    });

    this.pending.set(key, promise);
    return promise;
  }

  /**
   * Clear all pending requests (useful for testing)
   */
  clear() {
    this.pending.clear();
  }
}

// Global request queue instance
const requestQueue = new RequestQueue();

module.exports = { requestQueue };
