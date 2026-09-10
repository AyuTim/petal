export type ListType = "bucket" | "wish" | "shopping" | "todo" | "custom";
export type CoverStyle = "solid" | "gradient" | "pattern" | "image";
export type FontStyle = "sans" | "serif" | "script";
export type SharePermission = "view" | "check" | "edit";
export type ActorType = "owner" | "guest";
export type Priority = "low" | "medium" | "high" | null;
export type CaptureType = "text" | "link" | "photo" | "file";
export type AttachmentType = "image" | "file" | "video" | "url";

export type OwnerSettings = {
  theme: "light" | "dark";
  largerText: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  milestonesEnabled: boolean;
  defaultFont: FontStyle;
  /** Workspace / app chrome accent (sidebar selection, etc.) */
  accentColor: string;
};

/** The human-facing account record attached to a private Petals workspace. */
export type OwnerProfile = {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  provider: "google" | "device";
  createdAt: string;
  onboardingCompleted: boolean;
};

export type Tag = {
  id: string;
  ownerDeviceId: string;
  name: string;
  color: string;
};

export type Attachment = {
  id: string;
  itemId: string;
  type: AttachmentType;
  fileUrl: string;
  thumbnailUrl: string | null;
  filename: string | null;
  altText: string | null;
  isShared: boolean;
  position: number;
  uploadedAt: string;
};

/** Freeform mood-board frame in board coordinates (px). */
export type MoodLayout = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ListItem = {
  id: string;
  listId: string;
  title: string;
  emoji: string | null;
  notes: string | null;
  privateNotes: string | null;
  completed: boolean;
  completedAt: string | null;
  targetDate: string | null;
  targetMonth: string | null;
  season: string | null;
  priority: Priority;
  tags: Tag[];
  position: number;
  price: number | null;
  currency: string | null;
  store: string | null;
  productUrl: string | null;
  purchased: boolean;
  hiddenFromMoodBoard: boolean;
  moodOrder: number;
  /** Freeform position/size on the mood board; null until the user places it. */
  moodLayout: MoodLayout | null;
  importedMetadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  attachments: Attachment[];
};

export type ShareLink = {
  id: string;
  listId: string;
  token: string;
  permission: SharePermission;
  active: boolean;
  createdAt: string;
};

export type PetalList = {
  id: string;
  ownerDeviceId: string;
  title: string;
  emoji: string;
  color: string;
  coverImage: string | null;
  coverStyle: CoverStyle;
  type: ListType;
  description: string | null;
  isPinned: boolean;
  fontStyle: FontStyle;
  budgetTarget: number | null;
  currency: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  share: ShareLink | null;
  items?: ListItem[];
  /** A custom order for items collected in the private General bucket view. */
  generalItemOrder?: string[];
};

export type QuickCapture = {
  id: string;
  ownerDeviceId: string;
  type: CaptureType;
  content: string;
  attachmentUrl: string | null;
  importedMetadata: Record<string, unknown> | null;
  createdAt: string;
};

export type ActivityLog = {
  id: string;
  listId: string;
  actorType: ActorType;
  guestName: string | null;
  action: string;
  entityId: string | null;
  detail: string | null;
  timestamp: string;
};

export type ListVersion = {
  id: string;
  listId: string;
  label: string;
  createdAt: string;
};

export type ViewerRole = "owner" | "view" | "check" | "edit";
