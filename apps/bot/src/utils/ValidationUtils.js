"use strict";

/**
 * Input validation utilities following security best practices
 */
class ValidationUtils {
  /**
   * Sanitize user input to prevent injection attacks
   */
  static sanitizeInput(input, maxLength = 2000) {
    if (typeof input !== 'string') return '';
    
    return input
      .slice(0, maxLength)
      .replace(/[<>]/g, '') // Remove potential HTML/XML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/data:/gi, '') // Remove data: protocol
      .trim();
  }

  /**
   * Validate Discord ID format
   */
  static isValidDiscordId(id) {
    return /^\d{17,19}$/.test(String(id));
  }

  /**
   * Validate guild configuration input
   */
  static validateGuildConfig(config) {
    const errors = [];
    
    if (config.levelingEnabled !== undefined && typeof config.levelingEnabled !== 'boolean') {
      errors.push('levelingEnabled must be a boolean');
    }
    
    if (config.locale && !/^[a-z]{2}(-[A-Z]{2})?$/.test(config.locale)) {
      errors.push('locale must be in format "en" or "en-US"');
    }
    
    if (config.curve && !['linear', 'exponential', 'logarithmic'].includes(config.curve)) {
      errors.push('curve must be one of: linear, exponential, logarithmic');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate user permissions for command execution
   */
  static hasPermission(member, requiredPermissions) {
    if (!member || !member.permissions) return false;
    
    // Bot owner always has permission
    const config = require('../config/config.json');
    if (config.developerIds && config.developerIds.includes(member.user.id)) {
      return true;
    }
    
    return member.permissions.has(requiredPermissions);
  }

  /**
   * Rate limiting check
   */
  static checkRateLimit(userId, command, rateLimits = new Map()) {
    const key = `${userId}:${command}`;
    const now = Date.now();
    const limit = rateLimits.get(key);
    
    if (limit && now - limit.lastUsed < limit.cooldown) {
      return {
        limited: true,
        remainingMs: limit.cooldown - (now - limit.lastUsed)
      };
    }
    
    rateLimits.set(key, { lastUsed: now, cooldown: 3000 }); // 3 second default cooldown
    return { limited: false };
  }
}

module.exports = ValidationUtils;
