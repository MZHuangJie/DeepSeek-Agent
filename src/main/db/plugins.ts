import { getDb } from './connection';

// --- Marketplaces ---

export interface MarketplaceRow {
  id: string;
  name: string;
  url: string;
  type: string;
  added_at: number;
}

export function addMarketplace(id: string, name: string, url: string, type: string = 'github-repo') {
  const db = getDb();
  db.prepare(
    'INSERT OR REPLACE INTO marketplaces (id, name, url, type, added_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, name, url, type, Date.now());
}

export function removeMarketplace(id: string) {
  const db = getDb();
  db.prepare('DELETE FROM marketplaces WHERE id = ?').run(id);
}

export function listMarketplaces(): MarketplaceRow[] {
  const db = getDb();
  return db.prepare('SELECT id, name, url, type, added_at FROM marketplaces').all() as MarketplaceRow[];
}

// --- Installed Plugins ---

export interface InstalledPluginRow {
  name: string;
  description: string | null;
  system_prompt: string;
  source: string | null;
  installed_at: number;
}

export function installPlugin(name: string, description: string | null, systemPrompt: string, source: string | null) {
  const db = getDb();
  db.prepare(
    'INSERT OR REPLACE INTO installed_plugins (name, description, system_prompt, source, installed_at) VALUES (?, ?, ?, ?, ?)'
  ).run(name, description, systemPrompt, source, Date.now());
}

export function uninstallPlugin(name: string) {
  const db = getDb();
  db.prepare('DELETE FROM installed_plugins WHERE name = ?').run(name);
}

export function listPlugins(): InstalledPluginRow[] {
  const db = getDb();
  return db.prepare('SELECT name, description, system_prompt, source, installed_at FROM installed_plugins').all() as InstalledPluginRow[];
}

export function getPlugin(name: string): InstalledPluginRow | null {
  const db = getDb();
  return db.prepare('SELECT name, description, system_prompt, source, installed_at FROM installed_plugins WHERE name = ?').get(name) as InstalledPluginRow | null;
}

// --- Plugin Errors ---

export interface PluginErrorRow {
  id: number;
  plugin_name: string | null;
  marketplace: string | null;
  error: string;
  timestamp: number;
}

export function logPluginError(pluginName: string | null, marketplace: string | null, error: string) {
  const db = getDb();
  db.prepare(
    'INSERT INTO plugin_errors (plugin_name, marketplace, error, timestamp) VALUES (?, ?, ?, ?)'
  ).run(pluginName, marketplace, error, Date.now());
}

export function getPluginErrors(): PluginErrorRow[] {
  const db = getDb();
  return db.prepare('SELECT id, plugin_name, marketplace, error, timestamp FROM plugin_errors ORDER BY timestamp DESC').all() as PluginErrorRow[];
}

export function clearPluginErrors() {
  const db = getDb();
  db.prepare('DELETE FROM plugin_errors').run();
}
