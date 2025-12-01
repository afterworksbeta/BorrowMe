
import { User, Box, Item, Record, PopulatedBox, RecordStatus, ItemStatus, AdminNotification, AdminNotificationType } from '../types';

/**
 * SYSTEM CONFIGURATION
 */

// Initial Mock Data
const MOCK_USERS: User[] = [
  { 
    userId: 'admin-init', 
    name: 'Admin', 
    phone: '0000000000', 
    email: 'admin@borrowme.com', 
    role: 'admin', 
    password: 'admin1234', 
    createdAt: new Date().toISOString(),
    avatarUrl: undefined,
    notifyOnBorrow: true,
    notifyOnReturn: true,
    notifyOnRejected: true
  },
  { 
    userId: 'u2', 
    name: 'General User', 
    phone: '0898765432', 
    email: 'user@borrowme.com', 
    role: 'user', 
    password: 'password', 
    createdAt: new Date().toISOString(),
    avatarUrl: undefined,
    notifyOnBorrow: true,
    notifyOnReturn: true,
    notifyOnRejected: true
  },
];

const MOCK_BOXES: Box[] = [
  { boxId: 'b1', boxName: 'Box A - อุปกรณ์สำนักงาน', boxType: 'เครื่องเขียน', coverImageUrl: 'https://picsum.photos/400/300?random=1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { boxId: 'b2', boxName: 'Box B - IT Gadgets', boxType: 'อุปกรณ์ไอที', coverImageUrl: 'https://picsum.photos/400/300?random=2', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { boxId: 'b3', boxName: 'Box C - กีฬา', boxType: 'สันทนาการ', coverImageUrl: 'https://picsum.photos/400/300?random=3', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

const MOCK_ITEMS: Item[] = [
  { itemId: 'i1', boxId: 'b1', itemName: 'เครื่องเย็บกระดาษ', itemStatus: 'available', itemImageUrl: 'https://picsum.photos/200/200?random=10', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { itemId: 'i2', boxId: 'b1', itemName: 'กรรไกร', itemStatus: 'available', itemImageUrl: 'https://picsum.photos/200/200?random=11', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { itemId: 'i3', boxId: 'b2', itemName: 'สาย HDMI', itemStatus: 'available', itemImageUrl: 'https://picsum.photos/200/200?random=12', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { itemId: 'i4', boxId: 'b2', itemName: 'Mouse Wireless', itemStatus: 'borrowing', itemImageUrl: 'https://picsum.photos/200/200?random=13', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { itemId: 'i5', boxId: 'b3', itemName: 'ลูกบาสเกตบอล', itemStatus: 'borrowing', itemImageUrl: 'https://picsum.photos/200/200?random=14', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

// Helper to generate dates relative to NOW
const NOW = Date.now();
const DAY_MS = 24 * 60 * 60 * 1000;

const MOCK_RECORDS: Record[] = [
    // ตัวอย่างที่ 1: เกินกำหนด (Overdue)
    // ยืมมา 9 วันที่แล้ว (กำหนด 7 วัน) -> เกินมา 2 วัน
    {
        recordId: 'r_overdue_1',
        userId: 'u2',
        userName: 'General User',
        userEmail: 'user@borrowme.com',
        userPhone: '0898765432',
        boxId: 'b2',
        itemId: 'i4',
        status: 'borrowing',
        daysBorrowed: 7,
        borrowedAt: new Date(NOW - (9 * DAY_MS)).toISOString(), 
        returnRequestDate: null,
        returnedAt: null,
        proofImageUrl: null,
        adminNote: null,
        createdAt: new Date(NOW - (9 * DAY_MS)).toISOString(),
        updatedAt: new Date(NOW - (9 * DAY_MS)).toISOString(),
        dueSoonNotifiedAt: new Date(NOW - (2 * DAY_MS)).toISOString() // เคยแจ้งเตือนไปแล้ว
    },
    // ตัวอย่างที่ 2: ใกล้ครบกำหนด (Due Soon)
    // ยืมมา 6 วันที่แล้ว (กำหนด 7 วัน) -> เหลืออีก 1 วัน (ครบกำหนดพรุ่งนี้)
    {
        recordId: 'r_duesoon_1',
        userId: 'u2',
        userName: 'General User',
        userEmail: 'user@borrowme.com',
        userPhone: '0898765432',
        boxId: 'b3',
        itemId: 'i5',
        status: 'borrowing',
        daysBorrowed: 7,
        borrowedAt: new Date(NOW - (6 * DAY_MS)).toISOString(),
        returnRequestDate: null,
        returnedAt: null,
        proofImageUrl: null,
        adminNote: null,
        createdAt: new Date(NOW - (6 * DAY_MS)).toISOString(),
        updatedAt: new Date(NOW - (6 * DAY_MS)).toISOString(),
        dueSoonNotifiedAt: null // ยังไม่เคยแจ้งเตือน (ระบบจะยิงเมลเมื่อเปิดแอป)
    }
];

// LocalStorage Keys
const STORAGE_KEYS = {
  USERS: 'boxbox_users',
  BOXES: 'boxbox_boxes',
  ITEMS: 'boxbox_items',
  RECORDS: 'boxbox_records',
  SESSION: 'boxbox_session',
  ADMIN_NOTIFS: 'boxbox_admin_notifications'
};

// Event Bus for Realtime Simulation
type Listener = () => void;
const listeners: Listener[] = [];

const notify = () => {
  listeners.forEach(l => l());
};

export const subscribe = (listener: Listener) => {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index > -1) listeners.splice(index, 1);
  };
};

// --- DATA ACCESS LAYER ---

const loadData = <T,>(key: string, defaultData: T): T => {
  const stored = localStorage.getItem(key);
  if (!stored) {
    localStorage.setItem(key, JSON.stringify(defaultData));
    return defaultData;
  }
  return JSON.parse(stored);
};

const saveData = <T,>(key: string, data: T) => {
  localStorage.setItem(key, JSON.stringify(data));
  notify(); // Trigger update
};

// --- EMAIL SERVICE (MOCK) ---
const sendEmail = (to: string, subject: string, body: string) => {
  console.group('%c[Mock Email Service]', 'color: #A3413C; font-weight: bold; font-size: 12px;');
  console.log(`%cTo: %c${to}`, 'font-weight: bold;', 'color: #333;');
  console.log(`%cSubject: %c${subject}`, 'font-weight: bold;', 'color: #333;');
  console.log(`%cBody:`, 'font-weight: bold;');
  console.log(body);
  console.groupEnd();
};

// Initialize System Logic
const ensureDefaultAdmin = () => {
    const users = loadData<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
    const adminEmail = "admin@example.com";
    
    if (!users.find(u => u.email === adminEmail)) {
        console.log("Initializing Default Admin User...");
        const adminUser: User = {
            userId: 'admin-init',
            name: 'Admin',
            email: adminEmail,
            phone: '0000000000',
            password: 'admin1234', 
            role: 'admin',
            createdAt: new Date().toISOString(),
            notifyOnBorrow: true,
            notifyOnReturn: true,
            notifyOnRejected: true
        };
        users.push(adminUser);
        saveData(STORAGE_KEYS.USERS, users);
    }
};

ensureDefaultAdmin();

// --- ADMIN NOTIFICATIONS SYSTEM ---

export const getAdminNotifications = (): AdminNotification[] => {
    return loadData<AdminNotification[]>(STORAGE_KEYS.ADMIN_NOTIFS, []);
};

/**
 * Helper: Add Admin Notification with Deduplication
 * ป้องกันการแจ้งเตือนซ้ำ โดยเช็กว่ามี (type + borrowId + adminId) อยู่แล้วหรือไม่
 */
export const addAdminNotification = (next: AdminNotification) => {
    const notifications = loadData<AdminNotification[]>(STORAGE_KEYS.ADMIN_NOTIFS, []);
    
    // 2. สร้าง helper กลางที่ “กันซ้ำ” ก่อนเพิ่มแจ้งเตือน
    const isDup = notifications.some(
        n =>
        n.type === next.type &&
        n.borrowId === next.borrowId &&
        n.adminId === next.adminId
    );

    if (isDup) {
        console.log(`[AdminNotif] Skipped duplicate: ${next.type} for borrowId ${next.borrowId}`);
        return; 
    }

    // Add to top
    notifications.unshift(next);
    saveData(STORAGE_KEYS.ADMIN_NOTIFS, notifications);
};

export const markAdminNotificationRead = (notificationId: string) => {
    const notifications = loadData<AdminNotification[]>(STORAGE_KEYS.ADMIN_NOTIFS, []);
    const updated = notifications.map(n => n.id === notificationId ? { ...n, isRead: true } : n);
    saveData(STORAGE_KEYS.ADMIN_NOTIFS, updated);
};

export const markAllAdminNotificationsRead = () => {
    const notifications = loadData<AdminNotification[]>(STORAGE_KEYS.ADMIN_NOTIFS, []);
    const updated = notifications.map(n => ({ ...n, isRead: true }));
    saveData(STORAGE_KEYS.ADMIN_NOTIFS, updated);
};

export const clearAllAdminNotifications = () => {
    saveData(STORAGE_KEYS.ADMIN_NOTIFS, []);
};

// --- API ---

export const getBoxes = (): PopulatedBox[] => {
  const boxes = loadData<Box[]>(STORAGE_KEYS.BOXES, MOCK_BOXES);
  const items = loadData<Item[]>(STORAGE_KEYS.ITEMS, MOCK_ITEMS);

  return boxes.map(box => {
    const boxItems = items.filter(i => i.boxId === box.boxId);
    return {
      ...box,
      itemCount: boxItems.length,
      availableCount: boxItems.filter(i => i.itemStatus === 'available').length,
    };
  });
};

export const getBoxItems = (boxId: string): Item[] => {
  const items = loadData<Item[]>(STORAGE_KEYS.ITEMS, MOCK_ITEMS);
  return items.filter(i => i.boxId === boxId);
};

export const getItems = (): Item[] => {
    return loadData<Item[]>(STORAGE_KEYS.ITEMS, MOCK_ITEMS);
}

export const getRecords = (): Record[] => {
  return loadData<Record[]>(STORAGE_KEYS.RECORDS, MOCK_RECORDS);
};

export const loginUser = (email: string, password: string): User | null => {
  const users = loadData<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
  const user = users.find(u => u.email === email && u.password === password);
  if (user) {
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user));
    return user;
  }
  return null;
};

export const registerUser = (data: Omit<User, 'userId' | 'createdAt' | 'role'>): User | null => {
  const users = loadData<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
  if (users.find(u => u.email === data.email)) return null;

  const newUser: User = {
    ...data,
    userId: `u${Date.now()}`,
    role: 'user',
    createdAt: new Date().toISOString(),
    notifyOnBorrow: true,
    notifyOnReturn: true,
    notifyOnRejected: true
  };
  
  users.push(newUser);
  saveData(STORAGE_KEYS.USERS, users);
  localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(newUser));
  return newUser;
};

export const getCurrentUser = (): User | null => {
  const session = localStorage.getItem(STORAGE_KEYS.SESSION);
  if (!session) return null;
  const sessionUser = JSON.parse(session);
  const users = loadData<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
  const currentUser = users.find(u => u.userId === sessionUser.userId);
  return currentUser || null;
};

export const logoutUser = () => {
  localStorage.removeItem(STORAGE_KEYS.SESSION);
};

// --- SETTINGS MANAGEMENT ---

export const updateUserProfile = (userId: string, data: Partial<User>): User | null => {
  const users = loadData<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
  const idx = users.findIndex(u => u.userId === userId);
  if (idx === -1) return null;

  users[idx] = { ...users[idx], ...data };
  saveData(STORAGE_KEYS.USERS, users);
  
  const session = getCurrentUser();
  if (session && session.userId === userId) {
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(users[idx]));
  }
  return users[idx];
};

export const changePassword = (userId: string, oldPass: string, newPass: string): boolean => {
  const users = loadData<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
  const idx = users.findIndex(u => u.userId === userId);
  if (idx === -1) return false;

  if (users[idx].password !== oldPass) return false;

  users[idx].password = newPass;
  saveData(STORAGE_KEYS.USERS, users);
  return true;
};

export const deleteAccount = (userId: string): void => {
    let users = loadData<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
    users = users.filter(u => u.userId !== userId);
    saveData(STORAGE_KEYS.USERS, users);
    localStorage.removeItem(STORAGE_KEYS.SESSION);
};

// --- USER MANAGEMENT (ADMIN) ---

export const getAllUsers = (): User[] => {
    return loadData<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
};

export const adminDeleteUser = (requesterUserId: string, targetUserId: string): { success: boolean, message?: string } => {
    let users = loadData<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
    
    const requester = users.find(u => u.userId === requesterUserId);
    const target = users.find(u => u.userId === targetUserId);

    if (!requester || requester.role !== 'admin') {
        return { success: false, message: 'ไม่มีสิทธิ์ในการลบผู้ใช้' };
    }

    if (!target) {
        return { success: false, message: 'ไม่พบผู้ใช้งานที่ต้องการลบ' };
    }

    // PROTECT MAIN ADMIN
    const MAIN_ADMIN_EMAIL = 'admin@example.com';
    if (target.email === MAIN_ADMIN_EMAIL && requester.email !== MAIN_ADMIN_EMAIL) {
        return { success: false, message: 'ไม่สามารถลบผู้ดูแลระบบหลักได้' };
    }

    const initialLength = users.length;
    
    // Prevent deleting the currently logged in session via this method (should use deleteAccount)
    // But for admin management of OTHERS:
    users = users.filter(u => u.userId !== targetUserId);
    
    if (users.length < initialLength) {
        saveData(STORAGE_KEYS.USERS, users);
        // If we deleted the current session user (unlikely but possible if self-delete via list), clear session
        const session = getCurrentUser();
        if (session && session.userId === targetUserId) {
             localStorage.removeItem(STORAGE_KEYS.SESSION);
        }
        return { success: true };
    }
    return { success: false, message: 'เกิดข้อผิดพลาดในการลบ' };
};

export const adminSendUserMessage = (userId: string, subject: string, message: string): boolean => {
     const users = loadData<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
     const user = users.find(u => u.userId === userId);
     if (!user) return false;
     
     // Mock sending email
     sendEmail(user.email, subject, message);
     return true;
};


// --- ADMIN MANAGEMENT ---

export const adminCreateAdminUser = (currentUserId: string, data: Pick<User, 'name' | 'phone' | 'email' | 'password'>): { success: boolean, message?: string, user?: User } => {
    const users = loadData<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
    const currentUser = users.find(u => u.userId === currentUserId);

    if (!currentUser || currentUser.role !== 'admin') {
        return { success: false, message: 'ไม่มีสิทธิ์ในการสร้างผู้ดูแลระบบ' };
    }
    if (users.find(u => u.email === data.email)) {
        return { success: false, message: 'อีเมลนี้ถูกใช้งานแล้ว' };
    }

    const newAdmin: User = {
        userId: `admin-${Date.now()}`,
        role: 'admin',
        createdAt: new Date().toISOString(),
        name: data.name,
        phone: data.phone,
        email: data.email,
        password: data.password, 
        notifyOnBorrow: true,
        notifyOnReturn: true,
        notifyOnRejected: true
    };

    users.push(newAdmin);
    saveData(STORAGE_KEYS.USERS, users);

    return { success: true, user: newAdmin };
};

export const createBox = (name: string, type: string, cover: string, newItems: {name: string, img: string, qty: number}[]): void => {
    const boxes = loadData<Box[]>(STORAGE_KEYS.BOXES, MOCK_BOXES);
    const items = loadData<Item[]>(STORAGE_KEYS.ITEMS, MOCK_ITEMS);

    const newBoxId = `b${Date.now()}`;
    const newBox: Box = {
        boxId: newBoxId,
        boxName: name,
        boxType: type,
        coverImageUrl: cover || `https://picsum.photos/400/300?random=${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    boxes.push(newBox);

    newItems.forEach((itm, idx) => {
        for (let i = 0; i < itm.qty; i++) {
            items.push({
                itemId: `i${Date.now()}-${idx}-${i}`,
                boxId: newBoxId,
                itemName: itm.name,
                itemImageUrl: itm.img || `https://picsum.photos/200/200?random=${Date.now() + idx}`,
                itemStatus: 'available',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
        }
    });

    saveData(STORAGE_KEYS.BOXES, boxes);
    saveData(STORAGE_KEYS.ITEMS, items);
};

export const updateBox = (boxId: string, boxUpdate: Partial<Box>, itemsConfig: {name: string, img: string, qty: number}[]) => {
    let boxes = loadData<Box[]>(STORAGE_KEYS.BOXES, MOCK_BOXES);
    let items = loadData<Item[]>(STORAGE_KEYS.ITEMS, MOCK_ITEMS);
    
    const boxIndex = boxes.findIndex(b => b.boxId === boxId);
    if (boxIndex === -1) return;
    
    boxes[boxIndex] = { ...boxes[boxIndex], ...boxUpdate, updatedAt: new Date().toISOString() };
    
    const existingItems = items.filter(i => i.boxId === boxId);
    const processedItemIds = new Set<string>();
    
    itemsConfig.forEach((config, idx) => {
        const matches = existingItems.filter(i => i.itemName === config.name);
        
        matches.forEach(m => {
            m.itemImageUrl = config.img;
            m.updatedAt = new Date().toISOString();
        });
        
        const currentQty = matches.length;
        const targetQty = config.qty;
        
        if (targetQty > currentQty) {
            const toAdd = targetQty - currentQty;
            for (let i = 0; i < toAdd; i++) {
                items.push({
                    itemId: `i${Date.now()}-${idx}-${i}-new`,
                    boxId: boxId,
                    itemName: config.name,
                    itemImageUrl: config.img,
                    itemStatus: 'available',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
            }
            matches.forEach(m => processedItemIds.add(m.itemId));
            
        } else if (targetQty < currentQty) {
            const toRemoveCount = currentQty - targetQty;
            const availableToRemove = matches.filter(m => m.itemStatus === 'available');
            const others = matches.filter(m => m.itemStatus !== 'available');
            
            let removed = 0;
            availableToRemove.forEach(m => {
                if (removed < toRemoveCount) {
                    removed++;
                } else {
                    processedItemIds.add(m.itemId);
                }
            });
            others.forEach(m => {
                 processedItemIds.add(m.itemId);
            });
             
        } else {
            matches.forEach(m => processedItemIds.add(m.itemId));
        }
    });
    
    const itemsToDeleteIds = existingItems
        .filter(i => !processedItemIds.has(i.itemId))
        .map(i => i.itemId);
        
    items = items.filter(i => !itemsToDeleteIds.includes(i.itemId));

    saveData(STORAGE_KEYS.BOXES, boxes);
    saveData(STORAGE_KEYS.ITEMS, items);
};

export const deleteBox = (boxId: string) => {
    let boxes = loadData<Box[]>(STORAGE_KEYS.BOXES, MOCK_BOXES);
    let items = loadData<Item[]>(STORAGE_KEYS.ITEMS, MOCK_ITEMS);
    boxes = boxes.filter(b => b.boxId !== boxId);
    items = items.filter(i => i.boxId !== boxId);
    saveData(STORAGE_KEYS.BOXES, boxes);
    saveData(STORAGE_KEYS.ITEMS, items);
}

// --- ACTIONS ---

export const borrowBox = (userId: string, boxId: string, days: number, proofUrl: string | null): number => {
  const users = loadData<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
  const user = users.find(u => u.userId === userId);
  if (!user) return 0;
  
  const boxes = loadData<Box[]>(STORAGE_KEYS.BOXES, MOCK_BOXES);
  const box = boxes.find(b => b.boxId === boxId);

  const items = loadData<Item[]>(STORAGE_KEYS.ITEMS, MOCK_ITEMS);
  const records = loadData<Record[]>(STORAGE_KEYS.RECORDS, MOCK_RECORDS);

  const availableItems = items.filter(i => i.boxId === boxId && i.itemStatus === 'available');
  if (availableItems.length === 0) return 0;

  const newRecords: Record[] = [];

  availableItems.forEach(item => {
    // NEW: Set Item Status to 'borrowing'
    item.itemStatus = 'borrowing';
    item.updatedAt = new Date().toISOString();

    const newRecord: Record = {
      recordId: `r${Date.now()}-${item.itemId}`,
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
      userPhone: user.phone,
      boxId,
      itemId: item.itemId,
      // NEW: Set Record Status to 'borrowing'
      status: 'borrowing',
      daysBorrowed: days,
      borrowedAt: new Date().toISOString(),
      returnRequestDate: null,
      returnedAt: null,
      proofImageUrl: proofUrl, 
      adminNote: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dueSoonNotifiedAt: null // Initialize as null
    };
    records.push(newRecord);
    newRecords.push(newRecord);
  });

  saveData(STORAGE_KEYS.ITEMS, items);
  saveData(STORAGE_KEYS.RECORDS, records);
  
  // Create only ONE notification for the entire box
  if (newRecords.length > 0) {
      const firstRecord = newRecords[0];
      // 3.A: เมื่อยืมของสำเร็จ (BORROW_CREATED)
      // Notification will be deduplicated by id + type
      addAdminNotification({
        id: `borrow-${firstRecord.recordId}`,
        adminId: null, // Notify all admins
        borrowId: firstRecord.recordId,
        type: "BORROW_CREATED",
        title: box?.boxName || 'Unknown Box',
        message: `${user.name} ยืมกล่องใหม่สำเร็จ`,
        isRead: false,
        createdAt: new Date().toISOString(),
      });
  }
  
  if (user.notifyOnBorrow !== false) { 
      const subject = `[ระบบยืม-คืนของ] ยืมของสำเร็จ: ${box?.boxName || 'ไม่ระบุชื่อกล่อง'}`;
      const body = `เรียน ${user.name},\n\nคุณได้ทำการยืมกล่อง "${box?.boxName}"\nจำนวนสิ่งของ: ${availableItems.length} รายการ\nเป็นเวลา: ${days} วัน\nวันที่ยืม: ${new Date().toLocaleString('th-TH')}`;
      sendEmail(user.email, subject, body);
  }
  
  return availableItems.length;
};

export const requestReturn = (recordId: string, proofUrl: string): boolean => {
  const records = loadData<Record[]>(STORAGE_KEYS.RECORDS, MOCK_RECORDS);
  const boxes = loadData<Box[]>(STORAGE_KEYS.BOXES, MOCK_BOXES);
  
  const recordIndex = records.findIndex(r => r.recordId === recordId);
  if (recordIndex === -1) return false;

  const record = records[recordIndex];
  const box = boxes.find(b => b.boxId === record.boxId);
  
  // 3.C: เช็กสถานะรอบก่อน (Was it previously rejected?)
  const wasRejected = !!record.adminNote;

  // NEW: Set status to 'pendingReturn'
  record.status = 'pendingReturn';
  record.returnRequestDate = new Date().toISOString();
  record.proofImageUrl = proofUrl;
  record.adminNote = null; // Clear rejection note on new attempt
  record.updatedAt = new Date().toISOString();
  saveData(STORAGE_KEYS.RECORDS, records);

  // NEW: Update Item Status to 'pendingReturn'
  const items = loadData<Item[]>(STORAGE_KEYS.ITEMS, MOCK_ITEMS);
  const itemIndex = items.findIndex(i => i.itemId === record.itemId);
  if (itemIndex > -1) {
    items[itemIndex].itemStatus = 'pendingReturn';
    items[itemIndex].updatedAt = new Date().toISOString();
    saveData(STORAGE_KEYS.ITEMS, items);
  }

  // 3.B & 3.C: สร้าง notification
  if (wasRejected) {
      addAdminNotification({
          id: `return-rejected-new-${record.recordId}-${Date.now()}`,
          adminId: null,
          borrowId: record.recordId,
          type: "RETURN_REJECTED_NEW_REQUEST",
          title: box?.boxName || 'Return Request',
          message: `${record.userName} ส่งคำขอคืนใหม่ หลังจากถูกปฏิเสธ`,
          isRead: false,
          createdAt: new Date().toISOString(),
      });
  } else {
      addAdminNotification({
          id: `return-request-${record.recordId}-${Date.now()}`,
          adminId: null,
          borrowId: record.recordId,
          type: "RETURN_REQUESTED",
          title: box?.boxName || 'Return Request',
          message: `${record.userName} ส่งคำขอคืนของ`,
          isRead: false,
          createdAt: new Date().toISOString(),
      });
  }

  return true;
};

// Batch request for multiple items in the same box
export const requestReturnBatch = (recordIds: string[], proofUrl: string): boolean => {
  const records = loadData<Record[]>(STORAGE_KEYS.RECORDS, MOCK_RECORDS);
  const boxes = loadData<Box[]>(STORAGE_KEYS.BOXES, MOCK_BOXES);
  const items = loadData<Item[]>(STORAGE_KEYS.ITEMS, MOCK_ITEMS);
  
  const targetRecords = records.filter(r => recordIds.includes(r.recordId));
  if (targetRecords.length === 0) return false;

  const firstRecord = targetRecords[0];
  const box = boxes.find(b => b.boxId === firstRecord.boxId);
  const wasRejected = targetRecords.some(r => !!r.adminNote);
  
  targetRecords.forEach(record => {
      record.status = 'pendingReturn';
      record.returnRequestDate = new Date().toISOString();
      record.proofImageUrl = proofUrl;
      record.adminNote = null; 
      record.updatedAt = new Date().toISOString();

      const item = items.find(i => i.itemId === record.itemId);
      if (item) {
        item.itemStatus = 'pendingReturn';
        item.updatedAt = new Date().toISOString();
      }
  });

  saveData(STORAGE_KEYS.RECORDS, records);
  saveData(STORAGE_KEYS.ITEMS, items);

  const notifType = wasRejected ? "RETURN_REJECTED_NEW_REQUEST" : "RETURN_REQUESTED";
  const msg = wasRejected 
    ? `${firstRecord.userName} ส่งคำขอคืนใหม่ หลังจากถูกปฏิเสธ`
    : `${firstRecord.userName} ส่งคำขอคืนของ`;

  addAdminNotification({
      id: `return-batch-${firstRecord.recordId}-${Date.now()}`,
      adminId: null,
      borrowId: firstRecord.recordId,
      type: notifType as any,
      title: box?.boxName || 'Return Request',
      message: msg,
      isRead: false,
      createdAt: new Date().toISOString(),
  });

  return true;
};

export const adminApproveReturn = (recordId: string, approved: boolean, note?: string): boolean => {
  const records = loadData<Record[]>(STORAGE_KEYS.RECORDS, MOCK_RECORDS);
  const recordIndex = records.findIndex(r => r.recordId === recordId);
  if (recordIndex === -1) return false;

  const record = records[recordIndex];
  const items = loadData<Item[]>(STORAGE_KEYS.ITEMS, MOCK_ITEMS);
  const itemIndex = items.findIndex(i => i.itemId === record.itemId);

  if (approved) {
    // NEW: If approved, set to 'returned'
    record.status = 'returned';
    record.returnedAt = new Date().toISOString();
    if (itemIndex > -1) items[itemIndex].itemStatus = 'available';
  } else {
    // NEW: If rejected, revert status to 'borrowing' (User still has it)
    record.status = 'borrowing';
    // Logic: It goes back to 'borrowing' state, but we attach a note.
    record.returnRequestDate = null; // Clear request date so it drops from pending list
    record.adminNote = note || "Rejected by admin";
    if (itemIndex > -1) items[itemIndex].itemStatus = 'borrowing'; 
  }
  record.updatedAt = new Date().toISOString();
  
  saveData(STORAGE_KEYS.RECORDS, records);
  saveData(STORAGE_KEYS.ITEMS, items);

  const users = loadData<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
  const user = users.find(u => u.userId === record.userId);
  const item = items.find(i => i.itemId === record.itemId);

  if (user) {
      if (approved && user.notifyOnReturn !== false) {
          const subject = `[ระบบยืม-คืนของ] อนุมัติคืนของแล้ว: ${item?.itemName || 'สินค้า'}`;
          const body = `เรียน ${user.name},\n\nคำขอคืนของสำหรับ "${item?.itemName || 'สินค้า'}" ได้รับการอนุมัติเรียบร้อยแล้ว`;
          sendEmail(user.email, subject, body);
      } else if (!approved && user.notifyOnRejected !== false) {
          const subject = `[ระบบยืม-คืนของ] คำขอคืนของไม่ได้รับการอนุมัติ: ${item?.itemName || 'สินค้า'}`;
          const body = `เรียน ${user.name},\n\nคำขอคืนของสำหรับ "${item?.itemName || 'สินค้า'}" ไม่ได้รับการอนุมัติ\nเหตุผล: ${record.adminNote || '-'}`;
          sendEmail(user.email, subject, body);
      }
  }

  return true;
};

// Batch update status for multiple records (e.g. for a whole box loan)
export async function adminBatchUpdateStatus(recordIds: string[], newStatus: 'borrowing' | 'returned'): Promise<void> {
    console.log("adminBatchUpdateStatus START", recordIds, newStatus);
    
    // Simulate async network delay
    await new Promise(resolve => setTimeout(resolve, 300));

    const records = loadData<Record[]>(STORAGE_KEYS.RECORDS, MOCK_RECORDS);
    const items = loadData<Item[]>(STORAGE_KEYS.ITEMS, MOCK_ITEMS);
    
    recordIds.forEach(id => {
        const record = records.find(r => r.recordId === id);
        if (!record) return;

        // Admin Override Logic
        if (newStatus === 'returned') {
            record.status = 'returned';
            // Only set returnedAt if it wasn't already set (or refresh it)
            if (!record.returnedAt) {
                record.returnedAt = new Date().toISOString();
            }
            record.returnRequestDate = null; // Clear request if any

            const item = items.find(i => i.itemId === record.itemId);
            if (item) {
                item.itemStatus = 'available';
                item.updatedAt = new Date().toISOString();
            }
        } else if (newStatus === 'borrowing') {
             // Revert to borrowing (Not Returned)
             record.status = 'borrowing';
             record.returnedAt = null;
             record.returnRequestDate = null; // Clear request if reversing from pending
             
             const item = items.find(i => i.itemId === record.itemId);
             if (item) {
                 item.itemStatus = 'borrowing';
                 item.updatedAt = new Date().toISOString();
             }
        }
        
        record.updatedAt = new Date().toISOString();
    });

    saveData(STORAGE_KEYS.RECORDS, records);
    saveData(STORAGE_KEYS.ITEMS, items);
    notify();
    console.log("adminBatchUpdateStatus END");
}

export const adminDeleteRecords = (recordIds: string[]) => {
    let records = loadData<Record[]>(STORAGE_KEYS.RECORDS, MOCK_RECORDS);
    // Also need to handle item status if we delete an active record?
    // Rule: Admins can delete history. If it's active borrowing, we should technically revert item status to available?
    // For simplicity here, assuming this is mostly for cleanup. But let's be safe.
    
    // If we delete a 'borrowing' record, we should free up the item.
    const items = loadData<Item[]>(STORAGE_KEYS.ITEMS, MOCK_ITEMS);
    
    recordIds.forEach(rid => {
        const rec = records.find(r => r.recordId === rid);
        if (rec && (rec.status === 'borrowing' || rec.status === 'pendingReturn')) {
            const itm = items.find(i => i.itemId === rec.itemId);
            if(itm) itm.itemStatus = 'available';
        }
    });
    
    records = records.filter(r => !recordIds.includes(r.recordId));
    
    saveData(STORAGE_KEYS.RECORDS, records);
    saveData(STORAGE_KEYS.ITEMS, items); // in case we freed items
};


export const resetDb = () => {
  localStorage.clear();
  window.location.reload();
}

// Scheduled Job: Check for loans due tomorrow and notify users
export const checkAndNotifyDueSoon = () => {
    console.log("Running Scheduled Job: Due Soon Check...");
    const records = loadData<Record[]>(STORAGE_KEYS.RECORDS, MOCK_RECORDS);
    const users = loadData<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
    const boxes = loadData<Box[]>(STORAGE_KEYS.BOXES, MOCK_BOXES);
    
    const now = Date.now();
    const msInDay = 24 * 60 * 60 * 1000;
    
    let updatedCount = 0;
    
    records.forEach(record => {
        // Only check active loans that haven't been notified yet
        if (record.status === 'returned') return;
        
        const borrowedAt = new Date(record.borrowedAt).getTime();
        const dueDate = borrowedAt + (record.daysBorrowed * msInDay);
        const diffMs = dueDate - now;
        
        // Calculate Days Left for Logic
        // Ceil to get accurate "next day" feel (0-24h = 1 day left)
        const daysLeft = Math.ceil(diffMs / msInDay);

        // TRIGGER: 1 Day remaining (and not negative)
        if (daysLeft === 1 && diffMs > 0) {
            const user = users.find(u => u.userId === record.userId);
            const box = boxes.find(b => b.boxId === record.boxId);
            
            // A) User Email Notification (Check flag to prevent duplicate emails)
            if (user && !record.dueSoonNotifiedAt) {
                // Send Notification
                const subject = `[ระบบยืม-คืนของ] แจ้งเตือน: ใกล้ครบกำหนดคืนกล่อง "${box?.boxName || 'สินค้า'}"`;
                const dueDateStr = new Date(dueDate).toLocaleDateString('th-TH');
                const body = `เรียน ${user.name},\n\nรายการยืม "${box?.boxName || 'สินค้า'}" จะครบกำหนดคืนในวันที่ ${dueDateStr} (อีกประมาณ 1 วัน)\nกรุณาเตรียมคืนของให้ทันเวลา\n\nขอบคุณครับ`;
                
                sendEmail(user.email, subject, body);
                
                // Mark as notified for email
                record.dueSoonNotifiedAt = new Date().toISOString();
                updatedCount++;
            }

            // 3.D: เมื่อของใกล้หมดเขตคืน (BORROW_DUE_SOON)
            // Dedup handled inside addAdminNotification based on type+borrowId
            addAdminNotification({
                id: `due-soon-${record.recordId}`,
                adminId: null,
                borrowId: record.recordId,
                type: "BORROW_DUE_SOON",
                title: box?.boxName || 'Due Soon',
                message: `กล่องนี้จะครบกำหนดคืนในอีก 1 วัน`,
                isRead: false,
                createdAt: new Date().toISOString(),
            });
        }
    });
    
    if (updatedCount > 0) {
        console.log(`Sent notifications for ${updatedCount} records.`);
        saveData(STORAGE_KEYS.RECORDS, records);
    } else {
        console.log("No new email notifications to send.");
    }
};

/**
 * Checks if a record needs a due notification (Due within 3 days or Overdue)
 * Returns true if status != returned AND (dueDate - now) <= 3 days
 */
export const shouldShowDueNotification = (borrowedAt: string, daysBorrowed: number, status: string): boolean => {
    if (status === 'returned') return false;

    const borrowed = new Date(borrowedAt).getTime();
    const durationMs = daysBorrowed * 24 * 60 * 60 * 1000;
    const dueDate = borrowed + durationMs;
    const now = Date.now();
    
    const diffMs = dueDate - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    // Show notification if 3 days or less remaining (including overdue which is negative)
    return diffDays <= 3;
};
