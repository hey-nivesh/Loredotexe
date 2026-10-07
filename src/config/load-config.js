/**
 * Configuration Loader and Validator for Loredotexe.
 * Resolves paths relative to the project root and validates required settings.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigurationError } from '../errors/app-errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const PROJECT_ROOT = path.resolve(__dirname, '../../');

/**
 * Lightweight .env parser to avoid external dependencies.
 */
function loadDotEnv(envPath) {
  if (!fs.existsSync(envPath)) {
    return;
  }
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) {
      continue;
    }
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}

// Automatically load .env if available in project root
loadDotEnv(path.join(PROJECT_ROOT, '.env'));

/**
 * Validates and loads application configuration.
 * @param {Record<string, string>} [overrides={}]
 * @returns {object}
 */
export function loadConfig(overrides = {}) {
  const env = { ...process.env, ...overrides };

  const appName = env.APP_NAME || 'loredotexe';
  const appEnv = env.APP_ENV || env.PROJECT_ENV || 'development';
  const port = parseInt(env.PORT || '3000', 10);
  const host = env.HOST || '127.0.0.1';
  const logLevel = (env.LOG_LEVEL || 'info').toLowerCase();

  if (isNaN(port) || port < 1 || port > 65535) {
    throw new ConfigurationError(`Invalid PORT configuration: ${env.PORT}. Must be between 1 and 65535.`);
  }

  const validLogLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLogLevels.includes(logLevel)) {
    throw new ConfigurationError(`Invalid LOG_LEVEL: ${logLevel}. Allowed: ${validLogLevels.join(', ')}.`);
  }

  // Resolve data and database paths relative to PROJECT_ROOT if relative
  const rawDataDir = env.PROJECT_DATA_DIR || './data';
  const dataDir = path.isAbsolute(rawDataDir) ? rawDataDir : path.resolve(PROJECT_ROOT, rawDataDir);

  const rawDbPath = env.SQLITE_DATABASE_PATH || path.join(rawDataDir, 'loredotexe.sqlite');
  const databasePath = rawDbPath === ':memory:' 
    ? ':memory:' 
    : (path.isAbsolute(rawDbPath) ? rawDbPath : path.resolve(PROJECT_ROOT, rawDbPath));

  const n8nBaseUrl = env.N8N_BASE_URL || 'http://localhost:5678';
  const n8nApiKey = env.N8N_API_KEY || null;

  return {
    appName,
    appEnv,
    host,
    port,
    logLevel,
    projectRoot: PROJECT_ROOT,
    dataDir,
    databasePath,
    n8n: {
      baseUrl: n8nBaseUrl,
      apiKey: n8nApiKey
    }
  };
}

export const config = loadConfig();
