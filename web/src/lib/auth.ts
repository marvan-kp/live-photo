import fs from 'fs';
import path from 'path';
import { cookies } from 'next/headers';
import { getDataFilePath } from './paths';

const CONFIG_FILE = getDataFilePath('admin_config.json');

export interface AdminConfig {
  username: string;
  passwordHash: string; // Active admin passkey
  updatedAt?: string;
}

const DEFAULT_CONFIG: AdminConfig = {
  username: 'admin',
  passwordHash: process.env.ADMIN_PASSWORD?.trim() || 'marvan2026',
};

declare global {
  // eslint-disable-next-line no-var
  var __GLOBAL_ADMIN_CONFIG__: AdminConfig | undefined;
}

export function getAdminConfig(): AdminConfig {
  if (globalThis.__GLOBAL_ADMIN_CONFIG__) {
    return { ...globalThis.__GLOBAL_ADMIN_CONFIG__ };
  }

  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed?.passwordHash) {
        globalThis.__GLOBAL_ADMIN_CONFIG__ = parsed;
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Could not read admin_config.json, using defaults:', e);
  }

  try {
    const cwdFile = path.join(process.cwd(), 'data', 'admin_config.json');
    if (cwdFile !== CONFIG_FILE && fs.existsSync(cwdFile)) {
      const parsed = JSON.parse(fs.readFileSync(cwdFile, 'utf-8'));
      if (parsed?.passwordHash) {
        globalThis.__GLOBAL_ADMIN_CONFIG__ = parsed;
        return parsed;
      }
    }
  } catch (_) {}

  return { ...DEFAULT_CONFIG };
}

export async function getAdminConfigAsync(): Promise<AdminConfig> {
  if (globalThis.__GLOBAL_ADMIN_CONFIG__) {
    return { ...globalThis.__GLOBAL_ADMIN_CONFIG__ };
  }

  try {
    const { cloudReadConfig } = await import('./cloudDb');
    const cloud = await cloudReadConfig<AdminConfig>('admin_config');
    if (cloud && cloud.passwordHash) {
      globalThis.__GLOBAL_ADMIN_CONFIG__ = cloud;
      return cloud;
    }
  } catch (_) {}

  return getAdminConfig();
}

export function saveAdminConfig(config: AdminConfig): void {
  globalThis.__GLOBAL_ADMIN_CONFIG__ = config;

  try {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save admin config to tmp:', e);
  }

  try {
    const cwdFile = path.join(process.cwd(), 'data', 'admin_config.json');
    if (cwdFile !== CONFIG_FILE) {
      const dir = path.dirname(cwdFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(cwdFile, JSON.stringify(config, null, 2), 'utf-8');
    }
  } catch (_) {}
}

export async function saveAdminConfigAsync(config: AdminConfig): Promise<void> {
  saveAdminConfig(config);
  try {
    const { cloudWriteConfig } = await import('./cloudDb');
    await cloudWriteConfig('admin_config', config);
  } catch (e) {
    console.warn('Failed to persist admin config to Cloud DB:', e);
  }
}

export async function isKeyValidAdmin(key?: string | null): Promise<boolean> {
  if (!key) return false;
  const cfg = await getAdminConfigAsync();
  const cleanKey = key.trim();
  const envKey = process.env.ADMIN_PASSWORD?.trim();
  return (
    cleanKey === cfg.passwordHash ||
    cleanKey === 'marvan2026' || // fallback passkey for zero lockouts
    (Boolean(envKey) && cleanKey === envKey)
  );
}

export async function checkAdminCredentialsAsync(user: string, pass: string): Promise<boolean> {
  const cfg = await getAdminConfigAsync();
  const cleanUser = user.trim().toLowerCase();
  const validUsers = [cfg.username.toLowerCase(), 'admin', 'marvan'];
  const matchesUser = validUsers.includes(cleanUser);
  const cleanPass = pass.trim();
  const envPass = process.env.ADMIN_PASSWORD?.trim();

  const matchesPass =
    cleanPass === cfg.passwordHash ||
    cleanPass === 'marvan2026' ||
    (Boolean(envPass) && cleanPass === envPass);

  return matchesUser && matchesPass;
}

export function checkAdminCredentials(user: string, pass: string): boolean {
  const cfg = getAdminConfig();
  const cleanUser = user.trim().toLowerCase();
  const validUsers = [cfg.username.toLowerCase(), 'admin', 'marvan'];
  const matchesUser = validUsers.includes(cleanUser);
  const cleanPass = pass.trim();
  const envPass = process.env.ADMIN_PASSWORD?.trim();

  const matchesPass =
    cleanPass === cfg.passwordHash ||
    cleanPass === 'marvan2026' ||
    (Boolean(envPass) && cleanPass === envPass);

  return matchesUser && matchesPass;
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

export async function changeAdminPassword(
  currentPass: string,
  newPass: string
): Promise<{ success: boolean; message: string }> {
  const cfg = await getAdminConfigAsync();
  const isAdmin = await isUserAdmin();

  const cleanCurrent = currentPass.trim();
  const isCurrentValid =
    cleanCurrent === cfg.passwordHash ||
    cleanCurrent === 'marvan2026' ||
    (process.env.ADMIN_PASSWORD && cleanCurrent === process.env.ADMIN_PASSWORD.trim());

  if (!isAdmin && !isCurrentValid) {
    return { success: false, message: 'Current admin password is incorrect.' };
  }

  const cleanNew = newPass.trim();
  if (!cleanNew || cleanNew.length < 4) {
    return { success: false, message: 'New password must be at least 4 characters long.' };
  }

  const updatedConfig: AdminConfig = {
    ...cfg,
    passwordHash: cleanNew,
    updatedAt: new Date().toISOString(),
  };

  await saveAdminConfigAsync(updatedConfig);
  return { success: true, message: 'Admin password updated successfully!' };
}

