export type DictionaryRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface GlobalDictionaryEntry {
  word: string;
  reading: string;
  registeredBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServerDictionaryEntry {
  guildId: string;
  word: string;
  reading: string;
  registeredBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GlobalDictionaryRequest {
  id: string;
  word: string;
  reading: string;
  reason: string | null;
  requestedBy: string;
  guildId: string;
  status: DictionaryRequestStatus;
  createdAt: Date;
  updatedAt: Date;
}
