export interface AdminServerBotInstance {
  instanceId: number;
  name: string;
  isActive: boolean;
}

export interface AdminServerItem {
  guildId: string;
  name: string;
  icon: string | null;
  manualPremium: boolean;
  botJoinedAt: string | null;
  boostCount: number;
  botInstances: AdminServerBotInstance[];
}
