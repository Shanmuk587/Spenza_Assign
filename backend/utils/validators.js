/**
 * Validates if a string is a proper URL
 * @param {string} url - The URL to validate
 * @returns {boolean} - True if valid, false otherwise
 */
exports.isValidUrl = (url) => {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch (error) {
      return false;
    }
  };
  
  /**
   * Validates if a callback URL is accessible
   * Can be used for additional validation if needed
   * @param {string} url - The URL to validate
   * @returns {Promise<boolean>} - Promise resolving to true if valid, false otherwise
   */
  exports.validateCallbackUrl = async (url) => {
    try {
      const axios = require('axios');
      // Optional: You could try to ping the URL to validate it's responsive
      // This is just a simple HEAD request to check if the URL is reachable
      await axios.head(url, { timeout: 5000 });
      return true;
    } catch (error) {
      return false;
    }
  };