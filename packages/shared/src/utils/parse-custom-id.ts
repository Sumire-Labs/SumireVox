import { LIMITS } from '../constants/limits.js';

export interface ParsedCustomId {
  command: string;
  action: string;
  userId: string;
  timestamp: number;
}

export function buildCustomId(command: string, action: string, userId: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  return `${command}:${action}:${userId}:${timestamp}`;
}

export function parseCustomId(customId: string): ParsedCustomId | null {
  const parts = customId.split(':');
  // format: command:action:userId:timestamp
  // action may itself contain colons (e.g. "speaker:0", "page:1")
  if (parts.length < 4) {
    return null;
  }
  const command = parts[0];
  const timestampStr = parts[parts.length - 1];
  const userId = parts[parts.length - 2];
  const action = parts.slice(1, parts.length - 2).join(':');
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp) || !command || !action || !userId) {
    return null;
  }
  return { command, action, userId, timestamp };
}

export function isCustomIdExpired(parsed: ParsedCustomId): boolean {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expirySeconds = LIMITS.VIEW_EXPIRY_MINUTES * 60;
  return nowSeconds - parsed.timestamp > expirySeconds;
}
