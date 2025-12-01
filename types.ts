
export type UserRole = 'user' | 'admin';

export interface User {
  userId: string;
  name: string;
  phone: string;
  email: string;
  role: UserRole;
  password?: string; // In real app, this is hashed. Mock only.
  avatarUrl?: string;
  createdAt: string;
  
  // Settings
  notifyOnBorrow?: boolean;
  notifyOnReturn?: boolean;
  notifyOnRejected?: boolean;
}

export interface Box {
  boxId: string;
  boxName: string;
  boxType: string;
  coverImageUrl: string;
  createdAt: string;
  updatedAt: string;
}

// Updated ItemStatus to align with the new RecordStatus flow
export type ItemStatus = 'available' | 'borrowing' | 'pendingReturn' | 'returned'; 
// Note: 'returned' for items usually implies 'available' immediately, 
// but we keep the type definition flexible if needed. In logic, we revert to 'available'.

export interface Item {
  itemId: string;
  boxId: string;
  itemName: string;
  itemStatus: ItemStatus;
  itemImageUrl: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string; // Track who last updated status (optional)
}

// STRICT NEW STATUS MODEL
export type RecordStatus = 'borrowing' | 'pendingReturn' | 'returned';

export interface Record {
  recordId: string;
  userId: string;
  userName: string;
  userPhone: string;
  userEmail: string;
  boxId: string;
  itemId: string;
  status: RecordStatus;
  daysBorrowed: number;
  borrowedAt: string;
  returnRequestDate: string | null;
  returnedAt: string | null;
  proofImageUrl: string | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  
  // Notification Tracking
  dueSoonNotifiedAt?: string | null; // Tracks when the 24h warning was sent
}

// --- ADMIN NOTIFICATIONS ---

export type AdminNotificationType =
  | "BORROW_CREATED"
  | "RETURN_REQUESTED"
  | "RETURN_REJECTED_NEW_REQUEST"
  | "BORROW_DUE_SOON";

export interface AdminNotification {
  id: string;
  adminId: string | null;  // null = Notify all admins
  borrowId: string;        // Maps to Record.recordId (renamed from recordId for consistency with prompt, or we can alias)
  type: AdminNotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// Helper types for UI
export interface PopulatedBox extends Box {
  itemCount: number;
  availableCount: number;
}

export interface PendingBorrowAction {
  boxId: string;
}
