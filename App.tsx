import React, { Component, useEffect, useState, useRef } from 'react';
import * as DB from './services/db';
import { User, PopulatedBox, Item, Record, PendingBorrowAction, AdminNotification } from './types';
import { Button, Modal, Badge, LoadingScreen, NotificationBell, NotificationItem, useNotifications, NotificationType } from './components/Common';
import AuthModal from './components/AuthModal';
import SettingsModal from './components/SettingsModal';
import UserView from './views/UserView';
import AdminDashboard from './views/AdminDashboard';
import { LogOut, Package, User as UserIcon, Box as BoxIcon, CheckCircle2, Upload, FileText, X, CalendarClock, AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: string;
}

// Error Boundary Component to catch rendering errors and prevent white screens
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error: error.toString() };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-red-50 text-red-900 font-sans">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-lg w-full text-center border border-red-100">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
               <AlertTriangle size={32} />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-red-600">เกิดข้อผิดพลาด (Application Error)</h2>
            <p className="text-gray-600 mb-6">ระบบพบปัญหาในการทำงาน ทำให้หน้าจอแสดงผลไม่ได้</p>
            <p className="text-xs bg-gray-100 p-4 rounded-xl font-mono mb-6 text-left overflow-auto max-h-40 border border-gray-200 text-gray-700">
              {this.state.error}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors flex items-center justify-center w-full gap-2 shadow-lg shadow-red-200"
            >
              <RefreshCw size={18} /> โหลดหน้าเว็บใหม่
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  // Global State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [boxes, setBoxes] = useState<PopulatedBox[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [records, setRecords] = useState<Record[]>([]);
  const [adminNotifications, setAdminNotifications] = useState<AdminNotification[]>([]);
  
  // Loading & Connection State
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<{ success: boolean; message?: string; details?: string } | null>(null);

  // Notification Hook
  const { notifications, unreadCount, markAsRead, markAllAsRead, addNotification, removeNotification, removeNotificationsByRecordId, setAllNotifications, clearAllNotifications } = useNotifications();

  // UI State
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'profile' | 'security' | 'account' | 'admin'>('profile');
  const [pendingAction, setPendingAction] = useState<PendingBorrowAction | null>(null);
  const [selectedBox, setSelectedBox] = useState<PopulatedBox | null>(null);
  const [borrowModalOpen, setBorrowModalOpen] = useState(false);
  const [borrowTargetBox, setBorrowTargetBox] = useState<PopulatedBox | null>(null);
  const [borrowDays, setBorrowDays] = useState(7);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Borrow Verification State
  const [borrowProofFile, setBorrowProofFile] = useState<File | null>(null);
  const [hasCheckedItems, setHasCheckedItems] = useState(false);
  const borrowFileInputRef = useRef<HTMLInputElement>(null);

  // New State for Borrow Summary Confirmation
  const [showBorrowSummary, setShowBorrowSummary] = useState(false);
  const [isBorrowing, setIsBorrowing] = useState(false);

  // Navigation State
  const [view, setView] = useState<'home' | 'user' | 'admin'>('home');
  // Admin Tab State (for navigation from notifications)
  const [adminInitialTab, setAdminInitialTab] = useState<'boxes' | 'approvals' | 'history'>('boxes');
  // Navigation Tick: A counter to force useEffect to trigger even if the tab value is the same
  const [navigationTick, setNavigationTick] = useState(0);

  // Checkbox Style matching new theme (Yellow/Secondary)
  const checkboxClass = "appearance-none h-5 w-5 rounded border border-gray-300 bg-white cursor-pointer transition-all checked:bg-secondary checked:border-secondary-dark relative checked:after:content-[''] checked:after:absolute checked:after:top-1/2 checked:after:left-1/2 checked:after:-translate-x-1/2 checked:after:-translate-y-1/2 checked:after:w-2.5 checked:after:h-2.5 checked:after:rounded-sm checked:after:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-1";

  // Initialization & "Realtime" Subscription
  useEffect(() => {
    const initApp = async () => {
      try {
          // 1. Connection Check (Crucial step to prevent white screen)
          const connResult = await DB.checkConnection();
          
          if (!connResult.success) {
              setConnectionStatus(connResult);
              setIsLoading(false);
              return; // Stop loading if connection failed
          }

          // 2. Parallel fetch for efficiency
          const [fetchedBoxes, fetchedItems, fetchedRecords, fetchedUser, fetchedNotifs] = await Promise.all([
            DB.getBoxes(),
            DB.getItems(),
            DB.getRecords(),
            DB.getCurrentUser(),
            DB.getAdminNotifications()
          ]);

          // Filter out orphan records (records pointing to boxes that no longer exist)
          // This solves the issue of "Unknown Box" appearing after admin deletion
          const validRecords = fetchedRecords.filter(r => 
            fetchedBoxes.some(b => b.boxId === r.boxId)
          );

          setBoxes(fetchedBoxes);
          setItems(fetchedItems);
          setRecords(validRecords);
          setCurrentUser(fetchedUser);
          setAdminNotifications(fetchedNotifs); 
          
      } catch (err) {
          console.error("Critical Error during initialization:", err);
          showToast("❌ เกิดข้อผิดพลาดร้ายแรงในการโหลดข้อมูล");
          setConnectionStatus({ success: false, message: "Application Crash", details: String(err) });
      } finally {
          setIsLoading(false);
      }
    };

    initApp();
    
    // Simulate Daily Job: Check for notifications
    DB.checkAndNotifyDueSoon();

    const unsubscribe = DB.subscribe(() => {
      initApp();
    });

    return () => unsubscribe();
  }, []);

  // Sync Logic: Decides what notifications to show in UI
  useEffect(() => {
    if (!currentUser || isLoading) return;

    if (currentUser.role === 'admin') {
        // ADMIN: Sync from DB (persisted)
        // Filter for this admin or global notifications (adminId === null)
        const relevantAdminNotifs = adminNotifications.filter(
            n => n.adminId === null || n.adminId === currentUser.userId
        );

        const uiNotifications: NotificationItem[] = relevantAdminNotifs.map(n => ({
            id: n.id,
            recordId: n.borrowId, // Updated: Map borrowId to recordId for UI link
            title: n.title,
            message: n.message,
            type: n.type, // Types match via extension in Common
            isRead: n.isRead
        }));
        
        setAllNotifications(uiNotifications);

    } else {
        // USER: Derive from Records (computed on the fly)
        const userNotifs: NotificationItem[] = []; // Explicitly typed to prevent implicit never[] error
        
        // Group records by Box to deduplicate notifications
        const recordsByBox: { [key: string]: Record[] } = {};
        records.filter(r => r.userId === currentUser.userId).forEach(r => {
            if (!recordsByBox[r.boxId]) recordsByBox[r.boxId] = [];
            recordsByBox[r.boxId].push(r);
        });

        Object.entries(recordsByBox).forEach(([boxId, boxRecords]) => {
            const box = boxes.find(b => b.boxId === boxId);

            // Check 1: Return Rejected (Any record in box rejected?)
            const rejectedRecord = boxRecords.find(r => r.status === 'borrowing' && r.adminNote);
            if (rejectedRecord) {
                userNotifs.push({
                    id: `rejected-${rejectedRecord.recordId}-${new Date(rejectedRecord.updatedAt).getTime()}`,
                    recordId: rejectedRecord.recordId,
                    title: box?.boxName || 'รายการคืน',
                    message: 'คำขอคืนล่าสุดไม่ได้รับการอนุมัติ',
                    type: 'RETURN_REJECTED',
                    isRead: false
                });
            }

            // Check 2: Due/Overdue
            // Find worst case in the box
            let worstStatus: NotificationType | null = null;
            let worstDiffDays = 9999;
            let representativeRecord: Record | null = null;

            boxRecords.forEach(r => {
                if (DB.shouldShowDueNotification(r.borrowedAt, r.daysBorrowed, r.status)) {
                    const borrowedAt = new Date(r.borrowedAt).getTime();
                    const dueDate = borrowedAt + (r.daysBorrowed * 24 * 60 * 60 * 1000);
                    const diffMs = dueDate - Date.now();
                    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                    
                    let type: NotificationType = 'DUE_SOON';
                    if (diffDays < 0) type = 'OVERDUE';
                    
                    if (!worstStatus || (type === 'OVERDUE' && worstStatus !== 'OVERDUE') || (type === worstStatus && diffDays < worstDiffDays)) {
                        worstStatus = type;
                        worstDiffDays = diffDays;
                        representativeRecord = r;
                    }
                }
            });

            if (worstStatus && representativeRecord) {
                 let message = "";
                 if (worstDiffDays < 0) {
                     message = `เกินกำหนดคืน ${Math.abs(worstDiffDays)} วันแล้ว`;
                 } else if (worstDiffDays === 0) {
                     message = "ครบกำหนดคืนวันนี้";
                 } else {
                     message = `อีก ${worstDiffDays} วันถึงกำหนดคืน`;
                 }

                 userNotifs.push({
                    id: `due-${representativeRecord.recordId}`, 
                    recordId: representativeRecord.recordId,
                    title: box?.boxName || 'รายการสิ่งของ',
                    message: message,
                    type: worstStatus,
                    isRead: false
                });
            }
        });
        
        setAllNotifications(userNotifs);
    }
  }, [records, boxes, currentUser, adminNotifications, isLoading]);

  // Backend Route Guard Simulation
  useEffect(() => {
      if (view === 'admin' && currentUser?.role !== 'admin') {
          if (!isLoading) {
              setView('home');
          }
      }
  }, [view, currentUser, isLoading]);

  // Toast Helper
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Helper: Group Items by Name
  const groupItemsByName = (itemList: Item[]) => {
      const grouped: { [key: string]: { name: string, img: string, count: number, items: Item[] } } = {};
      itemList.forEach(item => {
          if (!grouped[item.itemName]) {
              grouped[item.itemName] = { name: item.itemName, img: item.itemImageUrl, count: 0, items: [] };
          }
          grouped[item.itemName].count++;
          grouped[item.itemName].items.push(item);
      });
      return Object.values(grouped);
  };

  // Handlers
  const handleLoginSuccess = async () => {
    setAuthModalOpen(false);
    const user = await DB.getCurrentUser();
    setCurrentUser(user);
    
    // Redirect Admin to Admin Dashboard
    if (user?.role === 'admin') {
        setView('admin');
        return; 
    }

    // Process pending action automatically
    if (pendingAction && user) {
        const box = boxes.find(b => b.boxId === pendingAction.boxId);
        if(box) {
            setBorrowTargetBox(box);
            setBorrowModalOpen(true);
            setBorrowProofFile(null);
            setHasCheckedItems(false);
        }
        setPendingAction(null);
    }
  };

  const handleLogout = async () => {
    try {
        await DB.logoutUser();
    } finally {
        // Optimistically clean up UI state even if API fails
        setCurrentUser(null);
        setRecords([]); // Clear records to avoid flash of old data
        setAdminNotifications([]); // Clear notifications
        setView('home');
        setIsProfileMenuOpen(false);
        // Also close settings if open
        setIsSettingsOpen(false);
    }
  };

  const handleBorrowBoxClick = (boxId: string) => {
    // 1. Close other modals
    setSelectedBox(null);
    setBorrowModalOpen(false);
    // Reset Borrow State
    setBorrowProofFile(null);
    setHasCheckedItems(false);

    // 2. Check Auth
    if (!currentUser) {
      setPendingAction({ boxId });
      setAuthModalOpen(true);
      return;
    }

    // 3. If Logged in, Proceed
    const box = boxes.find(b => b.boxId === boxId);
    if (box) {
      setBorrowTargetBox(box);
      setBorrowModalOpen(true);
    }
  };

  const handleBorrowFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setBorrowProofFile(e.target.files[0]);
    }
  };

  const handleRemoveBorrowFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setBorrowProofFile(null);
    if (borrowFileInputRef.current) borrowFileInputRef.current.value = '';
  };

  const executeBorrow = async () => {
    if (!currentUser || !borrowTargetBox) return;
    
    setIsBorrowing(true);

    let proofUrl = null;
    if (borrowProofFile) {
        proofUrl = await DB.uploadFile(borrowProofFile, 'borrow-proofs');
    }

    const count = await DB.borrowBox(
      currentUser.userId, 
      borrowTargetBox.boxId, 
      borrowDays,
      proofUrl
    );

    setIsBorrowing(false);

    if (count > 0) {
      setShowBorrowSummary(false);
      setBorrowModalOpen(false);
      setBorrowTargetBox(null);
      setSelectedBox(null);
      setBorrowProofFile(null);
      setHasCheckedItems(false);
      showToast('ยืมกล่องนี้ทั้งหมดเรียบร้อยแล้ว');
    }
  };

  const handleOpenSettings = (tab: 'profile' | 'security' | 'account' | 'admin' = 'profile') => {
      setSettingsInitialTab(tab);
      setIsSettingsOpen(true);
      setIsProfileMenuOpen(false);
  };

  const handleNotificationClick = async (item: NotificationItem) => {
    // Mark as read in UI
    markAsRead(item.id);

    // If Admin, also sync read status to DB
    if (currentUser?.role === 'admin') {
        await DB.markAdminNotificationRead(item.id);
    }

    if (!currentUser) return;

    if (currentUser.role === 'admin') {
      // Route based on notification type
      if (item.type === 'RETURN_REQUESTED' || item.type === 'RETURN_REJECTED_NEW_REQUEST') {
          setAdminInitialTab('approvals');
      } else {
          setAdminInitialTab('history');
      }
      setNavigationTick(prev => prev + 1); // Force update even if tab is same
      setView('admin'); // Navigate to view
    } else {
        // For 'RETURN_REJECTED' or general notifications for User, go to User View
      setView('user');
    }
  };

  const handleMarkAllRead = async () => {
      markAllAsRead();
      if (currentUser?.role === 'admin') {
          await DB.markAllAdminNotificationsRead();
      }
  };

  const handleClearAllNotifications = async () => {
    if (currentUser?.role === 'admin') {
      await DB.clearAllAdminNotifications();
    }
    clearAllNotifications();
  };

  // Sync deletion: Remove from DB + Remove from Notifications
  const handleDeleteRecords = async (recordIds: string[]) => {
    // 1. Delete from DB
    await DB.adminDeleteRecords(recordIds);
    // 2. Clear related notifications
    recordIds.forEach(id => removeNotificationsByRecordId(id));
  };

  // --- Render Helpers ---

  const renderHeader = () => {
    return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md shadow-sm border-b border-blue-50 transition-colors">
      <div className="container mx-auto px-6 h-18 flex items-center justify-between py-3">
        <div 
            className="flex items-center gap-3 cursor-pointer group" 
            onClick={() => setView('home')}
        >
          {/* Logo */}
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200 group-hover:scale-105 transition-transform">
            <BoxIcon size={22} />
          </div>
          <div>
            <h1 className="font-extrabold text-primary-dark text-xl leading-none tracking-tight">BorrowMe</h1>
            <span className="text-xs text-text-secondary font-medium">ระบบยืม-คืนของ</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
            {currentUser && (
                <div className="mr-1">
                    <NotificationBell 
                        notifications={notifications} 
                        unreadCount={unreadCount}
                        onItemClick={handleNotificationClick} 
                        onMarkAllRead={handleMarkAllRead}
                        onRemoveItem={removeNotification}
                        onClearAll={handleClearAllNotifications}
                    />
                </div>
            )}
            
            <div className="relative">
            <button 
                onClick={() => {
                    if (currentUser) {
                        setIsProfileMenuOpen(!isProfileMenuOpen);
                    } else {
                        setSelectedBox(null);
                        setBorrowModalOpen(false);
                        setAuthModalOpen(true);
                    }
                }}
                className="flex items-center gap-2 hover:bg-gray-50 p-1.5 rounded-full transition-colors border border-transparent hover:border-gray-100"
            >
                {currentUser ? (
                    currentUser.avatarUrl ? (
                        <img 
                            src={currentUser.avatarUrl} 
                            className="w-10 h-10 rounded-full object-cover shadow-sm ring-2 ring-white" 
                            alt={currentUser.name} 
                        />
                    ) : (
                        <div className="w-10 h-10 bg-secondary text-slate-900 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-white">
                            {currentUser.name.charAt(0).toUpperCase()}
                        </div>
                    )
                ) : (
                    <div className="w-10 h-10 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center shadow-sm">
                        <UserIcon size={20} />
                    </div>
                )}
            </button>

            {/* Dropdown Menu */}
            {currentUser && isProfileMenuOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsProfileMenuOpen(false)}></div>
                    <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 py-2 animate-in fade-in slide-in-from-top-2 ring-1 ring-black/5">
                        <div className="px-5 py-3 border-b border-gray-50 mb-2">
                            <p className="text-sm font-bold text-gray-900 truncate">{currentUser.name}</p>
                            <p className="text-xs text-gray-500 truncate">{currentUser.email}</p>
                        </div>
                        
                        {currentUser.role !== 'admin' && (
                            <button onClick={() => { setView('user'); setIsProfileMenuOpen(false); }} className="w-full text-left px-5 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-primary flex items-center transition-colors font-medium">
                                <Package size={16} className="mr-3" /> รายการของฉัน
                            </button>
                        )}
                        
                        <button onClick={() => handleOpenSettings('profile')} className="w-full text-left px-5 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-primary flex items-center transition-colors font-medium">
                            <UserIcon size={16} className="mr-3" /> โปรไฟล์
                        </button>

                        {currentUser.role === 'admin' && (
                            <button 
                                onClick={() => {
                                    setView('admin');
                                    setAdminInitialTab('boxes');
                                    setNavigationTick(prev => prev + 1);
                                    setIsProfileMenuOpen(false);
                                }}
                                className="w-full text-left px-5 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-primary flex items-center transition-colors font-medium"
                            >
                                <BoxIcon size={16} className="mr-3" /> จัดการกล่อง
                            </button>
                        )}
                        
                        <div className="mt-2 pt-2 border-t border-gray-50">
                            <button 
                              type="button"
                              onClick={handleLogout} 
                              className="w-full text-left px-5 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center transition-colors font-medium"
                            >
                                <LogOut size={16} className="mr-3" /> ออกจากระบบ
                            </button>
                        </div>
                    </div>
                </>
            )}
            </div>
        </div>
      </div>
    </header>
  );
  };

  const HomeView = () => (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-10 text-center md:text-left bg-white p-8 rounded-3xl shadow-soft border border-blue-50 relative overflow-hidden">
        {/* Decor */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        
        <div className="relative z-10">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-3 tracking-tight">
                รายการทั้งหมด <span className="text-primary text-4xl">.</span>
            </h2>
            <p className="text-gray-600 text-lg">เลือกกล่องเพื่อดูสิ่งของภายในและทำการยืม</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {boxes.map(box => (
          <div 
            key={box.boxId} 
            className="group bg-surface rounded-3xl shadow-card hover:shadow-soft transition-all duration-300 border border-gray-100 hover:border-primary/30 cursor-pointer overflow-hidden transform hover:-translate-y-1"
            onClick={() => setSelectedBox(box)}
          >
            <div className="w-full aspect-[16/9] relative overflow-hidden bg-gray-100">
                <img src={box.coverImageUrl} className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700" alt={box.boxName} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60"></div>
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                    <span className="text-xs font-bold bg-white/95 text-gray-900 backdrop-blur-sm px-3 py-1.5 rounded-xl shadow-sm">{box.boxType}</span>
                </div>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-primary transition-colors line-clamp-1">{box.boxName}</h3>
              
              <div className="mb-6">
                  <div className="flex items-center text-sm gap-1">
                      <span className="text-gray-600">ของทั้งหมด {box.itemCount} รายการ</span>
                      <span className="mx-2 text-gray-300">-</span>
                      <span className="text-green-600 font-bold">พร้อม {box.availableCount} รายการ</span>
                  </div>
                  {box.itemCount > box.availableCount && (
                      <p className="text-xs text-gray-400 mt-1">
                         (กำลังถูกยืม {box.itemCount - box.availableCount} รายการ)
                      </p>
                  )}
              </div>

              <Button 
                variant="outline" 
                className="w-full rounded-xl border-gray-200 text-gray-600 hover:border-primary hover:text-primary hover:bg-blue-50 font-bold"
              >
                ดูรายละเอียด
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Prepare Footer Content for Box Detail Modal
  const boxDetailFooter = selectedBox ? (() => {
    const boxItems = items.filter(i => i.boxId === selectedBox.boxId);
    const availableCount = boxItems.filter(i => i.itemStatus === 'available').length;
    const hasItems = boxItems.length > 0;
    
    return (
        <div className="space-y-3 w-full">
            <Button 
               size="lg" 
               className="w-full text-base py-3.5 shadow-lg shadow-blue-200" 
               disabled={availableCount === 0 || !hasItems}
               onClick={() => handleBorrowBoxClick(selectedBox.boxId)}
            >
               {availableCount > 0 ? 'ยืมกล่องนี้ทั้งหมด' : 'ไม่มีของที่พร้อมยืมในกล่องนี้'}
            </Button>
            {availableCount > 0 && (
                <div className="flex items-center justify-center gap-2 text-xs text-gray-500 bg-gray-50 py-2 rounded-lg">
                    <CheckCircle2 size={14} className="text-success" />
                    จะยืมรายการที่สถานะ "พร้อม" ทั้งหมด {availableCount} รายการ
                </div>
            )}
        </div>
    );
  })() : null;

  const isBorrowValid = hasCheckedItems && !!borrowProofFile;

  // Prepare Footer Content for Borrow Confirmation
  const borrowFooter = borrowTargetBox ? (
    <div className="w-full">
        <div className="flex gap-3 w-full">
            <Button variant="secondary" className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 shadow-none" onClick={() => setBorrowModalOpen(false)}>ยกเลิก</Button>
            {/* Changed from direct confirm to open summary */}
            <Button className="flex-1" onClick={() => setShowBorrowSummary(true)} disabled={!isBorrowValid}>ยืนยันการยืม</Button>
        </div>
        {!isBorrowValid && (
            <p className="text-xs text-danger text-center mt-3 font-medium animate-pulse">
                * กรุณาเช็ครายการสิ่งของและอัปโหลดรูปภาพก่อนยืนยันการยืม
            </p>
        )}
    </div>
  ) : null;

  // Render Connection Error Screen
  if (connectionStatus && !connectionStatus.success) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50 font-sans">
              <div className="bg-white p-8 rounded-3xl shadow-xl max-w-lg w-full text-center border border-gray-100">
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <WifiOff size={32} />
                  </div>
                  <h2 className="text-2xl font-bold mb-2 text-gray-900">ไม่สามารถเชื่อมต่อฐานข้อมูล</h2>
                  <p className="text-gray-600 mb-6 font-medium">พบปัญหาในการติดต่อกับ API กรุณาตรวจสอบ</p>
                  
                  <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-6 text-left">
                      <p className="text-xs font-bold text-red-800 uppercase mb-1">สาเหตุที่พบ:</p>
                      <p className="text-sm font-bold text-red-600 mb-2">{connectionStatus.message}</p>
                      {connectionStatus.details && (
                          <div className="text-xs text-red-500 font-mono bg-red-100/50 p-2 rounded break-all">
                              {connectionStatus.details}
                          </div>
                      )}
                  </div>

                  <div className="flex gap-3">
                      <button 
                        onClick={() => window.location.reload()}
                        className="flex-1 px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-hover transition-colors shadow-lg shadow-blue-200"
                      >
                        ลองใหม่ (Reload)
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  if (isLoading) return <LoadingScreen />;

  // Wrapped in ErrorBoundary to prevent White Screen on render errors
  return (
    <ErrorBoundary>
        <div className="min-h-screen pb-10 bg-bg font-sans selection:bg-secondary/30 selection:text-primary-dark">
        {renderHeader()}
        
        {/* Toast Notification */}
        {toastMessage && (
            <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-[70] animate-in fade-in slide-in-from-bottom-5">
            <div className={`text-white px-6 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 border ${toastMessage.includes('❌') || toastMessage.includes('⚠️') ? 'bg-red-800 border-red-700' : 'bg-slate-800 border-slate-700'}`}>
                <div className={`rounded-full p-1 text-white ${toastMessage.includes('❌') || toastMessage.includes('⚠️') ? 'bg-red-500' : 'bg-green-500'}`}>
                    {toastMessage.includes('❌') || toastMessage.includes('⚠️') ? <X size={16} /> : <CheckCircle2 size={16} />}
                </div>
                <span className="font-bold text-sm">{toastMessage}</span>
            </div>
            </div>
        )}

        {/* Sub Navigation */}
        {view === 'user' && currentUser && (
            <div className="bg-white border-b border-gray-100 transition-colors shadow-sm relative z-30">
                    <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Package className="text-secondary" /> จัดการรายการยืม-คืน
                        </h2>
                        <Button variant="outline" size="sm" onClick={() => setView('home')} className="rounded-lg border-gray-200 text-gray-600">ไปหน้าแรก</Button>
                    </div>
            </div>
        )}

        {/* Main Content */}
        <main className="animate-in fade-in duration-500 slide-in-from-bottom-2">
            {view === 'home' && <HomeView />}
            {view === 'user' && currentUser && (
                <UserView userId={currentUser.userId} records={records} items={items} boxes={boxes} />
            )}
            {view === 'admin' && currentUser?.role === 'admin' && (
                <AdminDashboard 
                    boxes={boxes} 
                    records={records} 
                    items={items} 
                    initialTab={adminInitialTab}
                    navigationTick={navigationTick}
                    onDeleteRecords={handleDeleteRecords}
                />
            )}
        </main>

        {/* Auth Modal */}
        <AuthModal 
            isOpen={authModalOpen} 
            onClose={() => setAuthModalOpen(false)} 
            onSuccess={handleLoginSuccess} 
        />

        {/* Settings Modal */}
        {currentUser && (
            <SettingsModal 
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                currentUser={currentUser}
                initialTab={settingsInitialTab}
                onLogout={handleLogout}
            />
        )}

        {/* Box Detail Modal */}
        <Modal 
            isOpen={!!selectedBox} 
            onClose={() => setSelectedBox(null)} 
            title={selectedBox?.boxName || ''}
            maxWidth="max-w-2xl"
            footer={boxDetailFooter}
        >
            {selectedBox && (
            <div className="flex flex-col h-full">
                <div className="mb-6 flex items-center gap-3 bg-blue-50 p-3 rounded-xl">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                        <Package size={20} className="text-primary" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 font-bold uppercase">ประเภทกล่อง</p>
                        <p className="font-bold text-gray-900">{selectedBox.boxType}</p>
                    </div>
                </div>
                
                <div className="space-y-3">
                    <h4 className="font-bold text-gray-900 mb-2">สิ่งของภายในกล่อง</h4>
                    {/* Group items by name to avoid duplicates in list */}
                    {groupItemsByName(items.filter(i => i.boxId === selectedBox.boxId)).map((group, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 border border-gray-100 bg-white rounded-xl hover:shadow-sm hover:border-blue-100 transition-all">
                            <div className="flex items-center gap-4">
                                <img src={group.img} className="w-12 h-12 rounded-lg object-cover bg-gray-100" alt={group.name} />
                                <div>
                                    <h4 className="font-bold text-gray-900 text-sm">{group.name}</h4>
                                    <div className="flex gap-2 text-xs mt-0.5">
                                        <span className="text-gray-500 font-medium">จำนวนทั้งหมด {group.count} รายการ</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            )}
        </Modal>

        {/* Borrow Confirmation Modal */}
        <Modal
            isOpen={borrowModalOpen}
            onClose={() => setBorrowModalOpen(false)}
            title="ยืนยันการยืม"
            maxWidth="max-w-2xl"
            footer={borrowFooter}
        >
            {borrowTargetBox && (
                <div className="space-y-8">
                    {/* 1. Item List */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-bold text-gray-900">เช็ครายการสิ่งของในกล่องนี้</h4>
                            <Badge status="available" />
                        </div>
                        <div className="space-y-2 border border-gray-100 rounded-2xl p-4 max-h-56 overflow-y-auto bg-gray-50">
                            {/* Group items by name to show checklist summary */}
                            {groupItemsByName(items.filter(i => i.boxId === borrowTargetBox.boxId && i.itemStatus === 'available')).map((group, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-2.5 bg-white rounded-xl shadow-sm border border-gray-100 justify-between">
                                    <div className="flex items-center gap-3">
                                        <img src={group.img} className="w-10 h-10 object-cover rounded-lg bg-gray-100" alt="" />
                                        <span className="text-gray-900 text-sm font-bold">{group.name}</span>
                                    </div>
                                    <span className="text-xs bg-secondary/10 text-slate-800 font-bold px-2.5 py-1 rounded-lg border border-secondary/20">
                                        x{group.count}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 2. Checkbox Confirmation */}
                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input 
                                type="checkbox" 
                                className={checkboxClass}
                                checked={hasCheckedItems}
                                onChange={(e) => setHasCheckedItems(e.target.checked)}
                            />
                            <span className="text-gray-800 text-sm font-bold">ฉันได้ตรวจสอบรายการสิ่งของในกล่องนี้แล้ว</span>
                        </label>
                    </div>

                    {/* 3. Upload Proof */}
                    <div>
                    <p className="text-sm font-bold text-gray-900 mb-2">รูปภาพกล่อง/สิ่งของที่ยืม</p>
                    <input 
                        type="file" 
                        ref={borrowFileInputRef} 
                        className="hidden" 
                        accept="image/png, image/jpeg"
                        onChange={handleBorrowFileChange}
                    />
                    
                    {!borrowProofFile ? (
                        <div 
                            onClick={() => borrowFileInputRef.current?.click()}
                            className="border-2 border-dashed border-gray-300 rounded-2xl p-8 flex flex-col items-center justify-center bg-white hover:bg-blue-50/30 hover:border-primary/50 transition-all cursor-pointer group"
                        >
                            <div className="p-4 bg-blue-50 text-primary rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
                                <Upload className="w-6 h-6" />
                            </div>
                            <p className="text-gray-800 font-bold text-sm">อัปโหลดรูปกล่อง/สิ่งของที่ยืม</p>
                            <p className="text-xs text-gray-500 mt-1">เพื่อใช้ประกอบการยืนยัน (JPG, PNG)</p>
                        </div>
                    ) : (
                        <div className="border border-green-200 bg-green-50 rounded-2xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-green-100 rounded-xl text-green-600">
                                    <FileText className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-green-800 truncate max-w-[200px]">{borrowProofFile.name}</p>
                                    <p className="text-xs text-green-600 font-medium">{(borrowProofFile.size / 1024).toFixed(1)} KB</p>
                                </div>
                            </div>
                            <button 
                                onClick={handleRemoveBorrowFile}
                                className="p-1.5 hover:bg-green-100 rounded-full text-green-700 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                    </div>

                    {/* 4. Duration Selector */}
                    <div>
                        <label className="block text-sm font-bold text-gray-800 mb-3">จำนวนวันที่ต้องการยืม</label>
                        <div className="flex items-center gap-3 flex-wrap">
                            {[3, 7, 14, 30].map(d => (
                                <button
                                    key={d}
                                    onClick={() => setBorrowDays(d)}
                                    className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all transform active:scale-95 ${
                                        borrowDays === d 
                                        ? 'bg-primary text-white shadow-lg shadow-blue-200' 
                                        : 'bg-white text-gray-600 border border-gray-200 hover:border-primary hover:text-primary'
                                    }`}
                                >
                                    {d} วัน
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-gray-400 mt-3 font-medium">* กรุณาคืนภายในวันที่กำหนด</p>
                    </div>
                </div>
            )}
        </Modal>

        {/* NEW: Final Summary Modal */}
        <Modal
            isOpen={showBorrowSummary}
            onClose={() => setShowBorrowSummary(false)}
            title="สรุปรายการยืม"
            maxWidth="max-w-md"
            zIndex="z-[60]"
            footer={
                <div className="flex gap-3 w-full">
                    <Button variant="secondary" className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700" onClick={() => setShowBorrowSummary(false)}>กลับไปแก้ไข</Button>
                    <Button className="flex-1 shadow-lg shadow-blue-200" onClick={executeBorrow} isLoading={isBorrowing}>ยืนยันยืมทันที</Button>
                </div>
            }
        >
            {borrowTargetBox && (
                <div className="space-y-4">
                    {/* Box Info */}
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <h4 className="font-bold text-gray-900 text-lg mb-1">{borrowTargetBox.boxName}</h4>
                        <p className="text-sm text-gray-600">ประเภท: {borrowTargetBox.boxType}</p>
                    </div>

                    {/* Items List */}
                    <div>
                        <h5 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                            <Package size={16}/> รายการสิ่งของที่จะยืม
                        </h5>
                        <div className="bg-gray-50 rounded-xl p-3 max-h-48 overflow-y-auto space-y-2 border border-gray-100">
                            {groupItemsByName(items.filter(i => i.boxId === borrowTargetBox.boxId && i.itemStatus === 'available')).map((group, idx) => (
                                <div key={idx} className="flex justify-between items-center text-sm p-2 bg-white rounded-lg border border-gray-100">
                                    <div className="flex items-center gap-3">
                                            <img src={group.img} className="w-8 h-8 object-cover rounded-md bg-gray-100" alt="" />
                                            <span className="text-gray-700 font-medium">{group.name}</span>
                                    </div>
                                    <span className="text-gray-900 font-bold bg-secondary/10 px-2 py-0.5 rounded border border-secondary/20">x{group.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Duration Info */}
                    <div className="flex justify-between items-center bg-yellow-50 p-3 rounded-xl border border-yellow-100">
                        <div className="flex items-center gap-3">
                            <div className="bg-white p-2 rounded-lg text-secondary-dark shadow-sm">
                                <CalendarClock size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-bold uppercase">ระยะเวลายืม</p>
                                <p className="font-bold text-gray-900">{borrowDays} วัน</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-gray-500 font-bold uppercase">กำหนดคืน</p>
                            <p className="font-bold text-primary">{new Date(Date.now() + borrowDays * 86400000).toLocaleDateString('th-TH')}</p>
                        </div>
                    </div>
                </div>
            )}
        </Modal>

        </div>
    </ErrorBoundary>
  );
}