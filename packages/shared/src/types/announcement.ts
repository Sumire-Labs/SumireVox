export type AnnouncementType = 'info' | 'update' | 'maintenance' | 'important';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  type: AnnouncementType;
  published: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
