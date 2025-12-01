
import React, { useState, useRef, useEffect } from 'react';
import { LucideIcon, Eye, EyeOff, Bell, CalendarClock, AlertCircle, CheckCircle, XCircle, FileText, Info, Trash2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, variant = 'primary', size = 'md', isLoading, className = '', disabled, ...props 
}) => {
  const baseStyle = "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-primary text-white hover:bg-primary-hover focus:ring-primary",
    secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-400",
    danger: "bg-danger text-white hover:bg-red-600 focus:ring-red-500",
    success: "bg-success text-white hover:bg-green-600 focus:ring-green-500",
    outline: "border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-300",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`} 
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
      ) : null}
      {children}
    </button>
  );
};

export const Badge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    // Item Status
    available: "bg-green-100 text-green-800 border border-green-200",
    
    // Record Status
    borrowing: "bg-amber-100 text-amber-800 border border-amber-200",      // กำลังยืมอยู่ (Orange)
    pendingReturn: "bg-orange-100 text-orange-800 border border-orange-200",  // รออนุมัติ (Light Orange)
    returned: "bg-emerald-100 text-emerald-800 border border-emerald-200",    // คืนแล้ว (Green/Emerald)
    
    // Fallback/Legacy
    borrowed: "bg-amber-100 text-amber-800 border border-amber-200",
    checking: "bg-orange-100 text-orange-800 border border-orange-200",
    rejected: "bg-red-100 text-red-800 border border-red-200",
  };

  const labels: Record<string, string> = {
    available: "พร้อม",
    
    // NEW STATUS LABELS
    borrowing: "กำลังยืมอยู่",
    pendingReturn: "รออนุมัติ",
    returned: "คืนแล้ว",
    
    // Legacy
    borrowed: "ถูกยืม",
    checking: "รอตรวจ",
    rejected: "ไม่อนุมัติ",
  };

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${styles[status] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
      {labels[status] || status}
    </span>
  );
};

// --- Notification System ---

export type NotificationType = 
    | "OVERDUE" 
    | "DUE_SOON" 
    | "RETURN_REJECTED"
    // ADMIN TYPES
    | "BORROW_CREATED"
    | "RETURN_REQUESTED"
    | "RETURN_REJECTED_NEW_REQUEST"
    | "BORROW_DUE_SOON";

export interface NotificationItem {
  id: string;
  recordId?: string; // New: Link to BorrowRecord
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    // Initial data handled by App.tsx syncing logic usually, defaulting empty here to avoid duplicates
  ]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const addNotification = (item: NotificationItem) => {
    setNotifications(prev => {
        // Prevent duplicates for the same ID
        if (prev.some(n => n.id === item.id)) return prev;
        return [item, ...prev];
    });
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };
  
  // New: Remove by recordId to sync with table deletion
  const removeNotificationsByRecordId = (recordId: string) => {
    setNotifications(prev => prev.filter(n => n.recordId !== recordId));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };
  
  // To allow external sync (e.g. from DB for admins)
  const setAllNotifications = (items: NotificationItem[]) => {
      setNotifications(items);
  };

  return { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    addNotification,
    removeNotification,
    removeNotificationsByRecordId,
    setAllNotifications,
    clearAllNotifications
  };
};

interface SwipeableNotificationRowProps {
  item: NotificationItem;
  onOpen: (id: string | null) => void;
  onDelete: (id: string) => void;
  onClick: (id: string) => void;
  isOpen: boolean;
}

const SwipeableNotificationRow: React.FC<SwipeableNotificationRowProps> = ({ item, onOpen, onDelete, onClick, isOpen }) => {
  const DELETE_WIDTH = 88; // Width of the delete button
  const [offsetX, setOffsetX] = useState(0);
  const isDragging = useRef(false);
  const startX = useRef<number | null>(null);
  const didMove = useRef(false); // To distinguish click vs swipe

  // Sync with parent's open state (Source of Truth for initial/reset position)
  useEffect(() => {
    setOffsetX(isOpen ? -DELETE_WIDTH : 0);
  }, [isOpen]);

  const handleStart = (clientX: number) => {
    isDragging.current = true;
    startX.current = clientX;
    didMove.current = false;
  };

  const handleMove = (clientX: number) => {
    if (!isDragging.current || startX.current === null) return;
    const delta = clientX - startX.current;
    
    // Ignore micro-movements to allow clean clicks
    if (Math.abs(delta) > 5) didMove.current = true;

    // Calculate new position based on state (isOpen or not) + delta
    const baseOffset = isOpen ? -DELETE_WIDTH : 0;
    let newOffset = baseOffset + delta;

    // Clamp values: max 0 (closed), min -DELETE_WIDTH (open)
    if (newOffset > 0) newOffset = 0;
    if (newOffset < -DELETE_WIDTH) newOffset = -DELETE_WIDTH;

    setOffsetX(newOffset);
  };

  const handleEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    startX.current = null;

    // Lock Logic: If dragged past halfway, snap to open (-DELETE_WIDTH), else snap closed (0)
    if (offsetX <= -DELETE_WIDTH / 2) {
        setOffsetX(-DELETE_WIDTH);
        if (!isOpen) onOpen(item.id);
    } else {
        setOffsetX(0);
        if (isOpen) onOpen(null);
    }
  };

  // Mouse Events
  const onMouseDown = (e: React.MouseEvent) => handleStart(e.clientX);
  const onMouseMove = (e: React.MouseEvent) => handleMove(e.clientX);
  const onMouseUp = () => handleEnd();
  const onMouseLeave = () => {
    if (isDragging.current) handleEnd();
  };

  // Touch Events
  const onTouchStart = (e: React.TouchEvent) => handleStart(e.touches[0].clientX);
  const onTouchMove = (e: React.TouchEvent) => handleMove(e.touches[0].clientX);
  const onTouchEnd = () => handleEnd();

  const handleContentClick = (e: React.MouseEvent) => {
    // If it was a swipe (didMove), don't trigger the click action
    if (didMove.current) return;

    // If open, clicking just closes it
    if (isOpen) {
        onOpen(null);
        return;
    }

    onClick(item.id);
  };

  const baseClasses = "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors border-l-4 h-full relative z-10";
  
  // Style Logic based on Type and Read status
  let rowClass = "bg-white hover:bg-slate-50 text-slate-500 border-l-transparent"; // Default Read
  let IconComponent = CalendarClock;
  let iconClass = "bg-gray-100 text-gray-300";
  let dotColor = "bg-[#FB923C]";

  if (item.type === 'RETURN_REJECTED' || item.type === 'RETURN_REJECTED_NEW_REQUEST') {
       rowClass = item.isRead 
        ? "bg-white text-slate-500 border-l-transparent" 
        : "bg-red-50 hover:bg-red-100 text-slate-900 border-l-red-500";
       IconComponent = XCircle;
       iconClass = item.isRead ? "bg-red-50 text-red-200" : "bg-red-100 text-red-600";
       dotColor = "bg-red-500";
  } 
  else if (item.type === 'OVERDUE' || item.type === 'BORROW_DUE_SOON') {
      rowClass = item.isRead
       ? "bg-white text-slate-500 border-l-transparent"
       : "bg-[#FFF7ED] hover:bg-[#FFEDD5] text-slate-900 border-l-[#FB923C]";
      IconComponent = AlertCircle;
      iconClass = item.isRead ? "bg-red-50 text-red-300" : "bg-red-100 text-red-600";
  } 
  else if (item.type === 'BORROW_CREATED') {
      rowClass = item.isRead
       ? "bg-white text-slate-500 border-l-transparent"
       : "bg-blue-50 hover:bg-blue-100 text-slate-900 border-l-blue-500";
      IconComponent = Info;
      iconClass = item.isRead ? "bg-blue-50 text-blue-300" : "bg-blue-100 text-blue-600";
      dotColor = "bg-blue-500";
  }
  else if (item.type === 'RETURN_REQUESTED') {
      rowClass = item.isRead
       ? "bg-white text-slate-500 border-l-transparent"
       : "bg-orange-50 hover:bg-orange-100 text-slate-900 border-l-orange-500";
      IconComponent = CalendarClock;
      iconClass = item.isRead ? "bg-orange-50 text-orange-300" : "bg-orange-100 text-orange-600";
      dotColor = "bg-orange-500";
  }
  else if (!item.isRead) {
      rowClass = "bg-[#FFF7ED] hover:bg-[#FFEDD5] text-slate-900 border-l-[#FB923C]";
      iconClass = "bg-white border border-gray-200 text-gray-600";
  }

  // Disable transition while dragging for responsiveness, enable it for snap-back/lock
  const transitionStyle = isDragging.current ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)';

  return (
    <div className="relative overflow-hidden w-full select-none touch-pan-y">
      {/* Delete Button (Behind) */}
      <button
        type="button"
        className="absolute inset-y-0 right-0 bg-red-500 text-white text-sm font-medium flex items-center justify-center z-0 active:bg-red-600 transition-colors"
        style={{ width: `${DELETE_WIDTH}px` }}
        onClick={(e) => {
            e.stopPropagation();
            onDelete(item.id);
        }}
      >
        ลบ
      </button>

      {/* Swipeable Content (Front) */}
      <div
        style={{ transform: `translateX(${offsetX}px)`, transition: transitionStyle }}
        className={`${baseClasses} ${rowClass}`}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={handleContentClick}
      >
        <div className={`mt-0.5 p-1.5 rounded-full flex-shrink-0 ${iconClass}`}>
           <IconComponent size={16} />
        </div>
        <div className="flex-1 select-none pointer-events-none">
          <p className={`text-sm font-bold ${item.isRead ? 'text-slate-500' : 'text-slate-900'}`}>{item.title}</p>
          <p className={`text-xs mt-0.5 font-medium ${
            (item.type === 'RETURN_REJECTED' || item.type === 'RETURN_REJECTED_NEW_REQUEST')
                ? 'text-red-600'
                : (item.type === 'OVERDUE' || item.type === 'BORROW_DUE_SOON')
                    ? (item.isRead ? 'text-red-300' : 'text-red-600') 
                    : (item.isRead ? 'text-slate-400' : 'text-slate-500')
          }`}>
            {item.message}
          </p>
        </div>
        {!item.isRead && (
            <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${dotColor}`}></div>
        )}
      </div>
    </div>
  );
};

interface NotificationBellProps {
  notifications: NotificationItem[];
  unreadCount: number;
  onItemClick: (item: NotificationItem) => void;
  onMarkAllRead?: () => void;
  onRemoveItem: (id: string) => void; 
  onClearAll?: () => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ 
  notifications, 
  unreadCount, 
  onItemClick,
  onMarkAllRead,
  onRemoveItem,
  onClearAll
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [openRowId, setOpenRowId] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleClickItem = (item: NotificationItem) => {
    setIsOpen(false);
    onItemClick(item);
  };

  const handleDelete = (id: string) => {
    onRemoveItem(id);
    if (openRowId === id) setOpenRowId(null);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative inline-flex items-center justify-center p-2 rounded-full hover:bg-gray-100 transition-colors focus:outline-none"
        aria-label="การแจ้งเตือน"
      >
        <Bell className="w-6 h-6 text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 flex items-center justify-center text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 origin-top-right">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Bell size={16} /> แจ้งเตือน ({unreadCount})
            </h3>
            <div className="flex items-center gap-2">
                {unreadCount > 0 && onMarkAllRead && (
                    <button onClick={onMarkAllRead} className="text-xs text-primary hover:underline whitespace-nowrap">
                        อ่านทั้งหมด
                    </button>
                )}
                {notifications.length > 0 && onClearAll && (
                    <button 
                        onClick={onClearAll} 
                        className="text-gray-400 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 transition-colors"
                        title="ลบทั้งหมด"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>
          </div>
          
          <div className="max-h-[350px] overflow-y-auto overflow-x-hidden">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <p className="text-sm">ไม่มีการแจ้งเตือน</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((item) => (
                  <SwipeableNotificationRow 
                    key={item.id} 
                    item={item} 
                    onClick={() => handleClickItem(item)}
                    onDelete={handleDelete}
                    onOpen={(id) => setOpenRowId(id)}
                    isOpen={openRowId === item.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// --- Common Components ---

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  zIndex?: string;
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, onClose, title, children, footer, 
  maxWidth = 'max-w-md', zIndex = 'z-50' 
}) => {
  if (!isOpen) return null;
  return (
    <div className={`fixed inset-0 ${zIndex} flex items-center justify-center p-4 sm:p-6`}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      <div 
        className={`relative bg-white rounded-2xl shadow-xl w-full ${maxWidth} max-h-[80vh] flex flex-col transform transition-all animate-in fade-in zoom-in-95 duration-200`}
      >
        <div className="flex-none flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-900 line-clamp-1">{title}</h3>
          <button 
            onClick={onClose} 
            className="p-2 -mr-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
          >
            <span className="text-2xl leading-none block">&times;</span>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-6 py-4 text-gray-800">
          {children}
        </div>

        {footer && (
          <div className="flex-none px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string }> = ({ label, className = '', ...props }) => (
  <div className="mb-4">
    {label && <label className="block text-sm font-medium text-gray-800 mb-1">{label}</label>}
    <input 
      className={`w-full bg-gray-100 border border-gray-300 text-gray-900 placeholder:text-gray-500 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all ${className}`} 
      {...props} 
    />
  </div>
);

export const PasswordInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string }> = ({ label, className = '', ...props }) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="mb-4">
      {label && <label className="block text-sm font-medium text-gray-800 mb-1">{label}</label>}
      <div className="relative">
        <input 
          type={showPassword ? 'text' : 'password'}
          className={`w-full bg-gray-100 border border-gray-300 text-gray-900 placeholder:text-gray-500 rounded-lg px-4 py-2.5 pr-12 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all ${className}`} 
          {...props} 
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors p-1 rounded-full hover:bg-gray-200"
          aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
        >
          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
    </div>
  );
};

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    options: { value: string; label: string }[];
}

export const Select: React.FC<SelectProps> = ({ label, options, className = '', ...props }) => (
    <div className="mb-4">
        {label && <label className="block text-sm font-medium text-gray-800 mb-1">{label}</label>}
        <select
            className={`w-full bg-gray-100 border border-gray-300 text-gray-900 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all ${className}`}
            {...props}
        >
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                    {opt.label}
                </option>
            ))}
        </select>
    </div>
);

export const Toggle: React.FC<{ 
  label: string; 
  checked: boolean; 
  onChange: (checked: boolean) => void;
  description?: string;
}> = ({ label, checked, onChange, description }) => (
  <div className="flex items-center justify-between py-3">
    <div>
      <p className="text-sm font-medium text-gray-900">{label}</p>
      {description && <p className="text-xs text-gray-500">{description}</p>}
    </div>
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
        checked ? 'bg-primary' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  </div>
);

export const LoadingScreen = () => (
    <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4"></div>
        <p className="text-gray-600 font-medium">กำลังโหลด...</p>
    </div>
)
