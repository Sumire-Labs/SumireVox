import { Client } from 'discord.js';

let client: Client | null = null;

export function setClient(c: Client): void {
  client = c;
}

export function getClient(): Client {
  if (!client) {
    throw new Error('Discord client has not been initialized');
  }
  return client;
}
