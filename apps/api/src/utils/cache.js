"use strict";

/**
 * Enhanced in-memory cache with TTL support, LRU eviction, and statistics
 */
class MemoryCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize || 1000;
    this.defaultTtl = options.defaultTtl || 60000;
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0
    };
  }

  set(key, value, ttlMs = this.defaultTtl) {
    const now = Date.now();
    const expiresAt = now + ttlMs;
    
    // If at max capacity, remove oldest entry (LRU)
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this.stats.evictions++;
    }
    
    this.cache.set(key, { 
      value, 
      expiresAt, 
      accessCount: 0,
      lastAccessed: now,
      createdAt: now
    });
    this.stats.sets++;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    
    // Update access statistics for LRU
    entry.accessCount++;
    entry.lastAccessed = now;
    
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    this.stats.hits++;
    return entry.value;
  }

  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.deletes++;
    }
    return deleted;
  }

  clear() {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0
    };
  }

  // Clean expired entries
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    return cleaned;
  }

  // Get cache statistics
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    
    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100,
      size: this.cache.size,
      maxSize: this.maxSize
    };
  }

  // Get all keys with their metadata
  getKeys() {
    const now = Date.now();
    const keys = [];
    
    for (const [key, entry] of this.cache.entries()) {
      keys.push({
        key,
        expiresIn: Math.max(0, entry.expiresAt - now),
        accessCount: entry.accessCount,
        lastAccessed: entry.lastAccessed,
        createdAt: entry.createdAt
      });
    }
    
    return keys;
  }

  // Prune least recently used entries
  pruneLRU(count = 10) {
    const entries = Array.from(this.cache.entries())
      .sort(([,a], [,b]) => a.lastAccessed - b.lastAccessed)
      .slice(0, count);
    
    for (const [key] of entries) {
      this.cache.delete(key);
      this.stats.evictions++;
    }
    
    return entries.length;
  }
}

// Global cache instance
const cache = new MemoryCache();

// Cleanup expired entries every 5 minutes
setInterval(() => cache.cleanup(), 5 * 60 * 1000);

module.exports = { cache };
