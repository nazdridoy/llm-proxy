const fs = require('fs');
const path = require('path');

const configsDir = path.join(__dirname, '../../configs');
const configurations = {};

/**
 * Load all configuration files from the configs directory
 */
const loadConfigurations = () => {
    try {
        // Ensure configs directory exists
        if (!fs.existsSync(configsDir)) {
            fs.mkdirSync(configsDir, { recursive: true });
            console.log('Created configs directory');
            return;
        }

        const files = fs.readdirSync(configsDir);
        files.forEach(file => {
            if (file.endsWith('.json') && !file.endsWith('-conf.json') && !file.includes('.example')) {
                const profile = file.replace('.json', '');
                const filePath = path.join(configsDir, file);
                
                try {
                    const fileContent = fs.readFileSync(filePath, 'utf-8');
                    configurations[profile] = JSON.parse(fileContent);
                    console.log(`Loaded configuration for profile: ${profile}`);
                } catch (error) {
                    console.error(`Failed to load configuration for profile ${profile}:`, error.message);
                }
            }
        });
        
        console.log(`Successfully loaded ${Object.keys(configurations).length} configuration profiles`);
    } catch (error) {
        console.error('Failed to load configurations:', error);
        process.exit(1);
    }
};

/**
 * Get configuration for a specific profile and version
 * @param {string} profile - The profile name
 * @param {string} version - The version identifier
 * @returns {object|null} Configuration object or null if not found
 */
const getConfig = (profile, version) => {
    return configurations[profile]?.[version] || null;
};

/**
 * Get all available profiles
 * @returns {string[]} Array of profile names
 */
const getProfiles = () => {
    return Object.keys(configurations);
};

/**
 * Get all available versions for a profile
 * @param {string} profile - The profile name
 * @returns {string[]} Array of version names
 */
const getVersions = (profile) => {
    return configurations[profile] ? Object.keys(configurations[profile]) : [];
};

/**
 * Validate configuration structure
 * @param {object} config - Configuration object to validate
 * @returns {boolean} True if valid, false otherwise
 */
const validateConfig = (config) => {
    return config && 
           typeof config.baseUrl === 'string' && 
           typeof config.apiKey === 'string' &&
           config.baseUrl.trim() !== '' &&
           config.apiKey.trim() !== '';
};

// Load configurations on module import
loadConfigurations();

module.exports = { 
    getConfig, 
    getProfiles, 
    getVersions, 
    validateConfig,
    loadConfigurations 
}; 