// Environment variable validation and configuration check

export interface EnvironmentConfig {
  apiKey: string | null;
  googleSheetUrl: string | null;
  isProduction: boolean;
  isDevelopment: boolean;
}

export function checkEnvironment(): EnvironmentConfig {
  const apiKey = process.env.API_KEY || null;
  const googleSheetUrl = process.env.GOOGLE_SHEET_URL || null;
  
  const config: EnvironmentConfig = {
    apiKey,
    googleSheetUrl,
    isProduction: (import.meta as any).env?.PROD || false,
    isDevelopment: (import.meta as any).env?.DEV || false
  };

  // Log warnings for missing configuration
  if (!apiKey) {
    console.error('⚠️  CRITICAL: API_KEY is not configured!');
    console.error('The Gemini AI will not work without an API key.');
    console.error('Please add API_KEY to your environment variables.');
  }

  if (!googleSheetUrl) {
    console.warn('ℹ️  INFO: GOOGLE_SHEET_URL is not configured.');
    console.warn('Interview results will not be saved to Google Sheets.');
    console.warn('This is optional - you can still use the app for testing.');
  }

  if (config.isProduction) {
    console.log('🚀 Running in production mode');
    
    // Additional production checks
    if (apiKey && apiKey.includes('demo') || apiKey?.includes('test')) {
      console.error('⚠️  WARNING: Using a demo/test API key in production!');
    }
  } else {
    console.log('🔧 Running in development mode');
  }

  return config;
}

export function validateApiKey(apiKey: string | null): boolean {
  if (!apiKey) return false;
  
  // Basic validation for Google API keys
  if (!apiKey.startsWith('AIza')) {
    console.error('⚠️  Invalid API key format. Google API keys should start with "AIza"');
    return false;
  }
  
  if (apiKey.length < 30) {
    console.error('⚠️  API key seems too short to be valid');
    return false;
  }
  
  return true;
}

// Auto-check environment on module load (development only)
if ((import.meta as any).env?.DEV) {
  const env = checkEnvironment();
  validateApiKey(env.apiKey);
}
