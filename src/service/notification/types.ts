export interface CreateNotificationData {
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata?: any;
  priority?: "low" | "medium" | "high";
  relatedId?: string;
  /** When set, duplicate inserts (retries) are ignored via unique index */
  dedupeKey?: string;
}
