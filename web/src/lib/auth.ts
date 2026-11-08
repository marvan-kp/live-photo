import fs from 'fs';
import path from 'path';
import { cookies } from 'next/headers';
import { getDataFilePath } from './paths';

const CONFIG_FILE = getDataFilePath('admin_config.json');

export interface AdminConfig {
  username: string;
  passwordHash: string; // Plaintext or simple hash for local simplicity
}

const DEFAULT_CONFIG: AdminConfig = {
  username: 'admin',
  passwordHash: 'marvan2026',
};

export function getAdminConfig(): AdminConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn('Could not read admin_config.json, using defaults:', e);
  }

  try {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
  } catch (_) {}

  return DEFAULT_CONFIG;
}

export function saveAdminConfig(config: AdminConfig): void {
  try {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save admin config:', e);
  }
}

export function checkAdminCredentials(user: string, pass: string): boolean {
  const cfg = getAdminConfig();
  const cleanUser = user.trim().toLowerCase();
  const validUsers = [cfg.username.toLowerCase(), 'marvan'];
  return validUsers.includes(cleanUser) && pass.trim() === cfg.passwordHash;
}

export async function isUserAdmin(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('marvan_admin_session')?.value;
    return token === 'authenticated_admin_marvan_2026';
  } catch (_) {
    return false;
  }
}

