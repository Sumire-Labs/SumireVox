import { CommandDefinition } from './types.js';
import { joinCommand } from './join.js';
import { leaveCommand } from './leave.js';
import { voiceCommand } from './voice.js';
import { settingsCommand } from './settings.js';
import { dictionaryCommand } from './dictionary.js';
import { helpCommand } from './help.js';

export const commands: CommandDefinition[] = [
  joinCommand,
  leaveCommand,
  voiceCommand,
  settingsCommand,
  dictionaryCommand,
  helpCommand,
];
