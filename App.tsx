import React, { useEffect, useState, useRef } from 'react';
import * as DB from './services/db';
import { User, PopulatedBox, Item, Record, PendingBorrowAction } from './types';
import { Button, Modal, Badge, LoadingScreen } from './components/Common';
import AuthModal from './components/AuthModal';
import SettingsModal from './components/SettingsModal';
import UserView from './views/UserView';
import AdminDashboard from './views/AdminDashboard';
import { LogOut, Package, User as UserIcon, Box as BoxIcon, CheckCircle2, Upload, FileText, X } from 'lucide-react';

export default function App() {
  // Global State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [boxes, setBoxes] = useState<PopulatedBox[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [records, setRecords] = useState<Record[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  // Router Simulation
  const [view, setView] = useState<'home' | 'user' | 'admin'>('home');

  // Initialization & "Realtime" Subscription
  useEffect(() => {
    const fetchData = () => {
      setBoxes(DB.getBoxes());
      setItems(DB.getItems());
      setRecords(DB.getRecords());
      setCurrentUser(DB.getCurrentUser());
      setIsLoading(false);
    };

    fetchData();
    
    // Simulate Daily Job: Check for notifications
    DB.checkAndNotifyDueSoon();

    const unsubscribe = DB.subscribe(() => {
      fetchData();
    });

    return () => unsubscribe();
  }, []);

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

  // Handlers
  const handleLoginSuccess = () => {
    setAuthModalOpen(false);
    const user = DB.getCurrentUser();
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

  const handleLogout = () => {
    DB.logoutUser();
    setCurrentUser(null);
    setView('home');
    setIsProfileMenuOpen(false);
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

  const confirmBorrow = () => {
    if (!currentUser || !borrowTargetBox) return;
    
    // Use uploaded file or null (though button should be disabled if null)
    const proofUrl = borrowProofFile ? URL.createObjectURL(borrowProofFile) : null;

    const count = DB.borrowBox(
      currentUser.userId, 
      borrowTargetBox.boxId, 
      borrowDays,
      proofUrl
    );

    if (count > 0) {
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

  // --- Render Helpers ---

  const renderHeader = () => (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md shadow-sm border-b border-pink-100 transition-colors">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div 
            className="flex items-center gap-2 cursor-pointer" 
            onClick={() => setView('home')}
        >
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
            <BoxIcon size={20} />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 text-lg leading-none transition-colors">Borrow Me</h1>
            <span className="text-xs text-gray-600">ระบบยืม-คืนของ</span>
          </div>
        </div>

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
            className="flex items-center gap-2 hover:bg-gray-50 p-1.5 rounded-full transition-colors"
          >
             {currentUser ? (
                 currentUser.avatarUrl ? (
                    <img 
                        src={currentUser.avatarUrl} 
                        className="w-9 h-9 rounded-full object-cover shadow-sm ring-2 ring-pink-100" 
                        alt={currentUser.name} 
                    />
                 ) : (
                    <div className="w-9 h-9 bg-primary text-white rounded-full flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-pink-100">
                        {currentUser.name.charAt(0).toUpperCase()}
                    </div>
                 )
             ) : (
                 <div className="w-9 h-9 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center shadow-sm">
                    <UserIcon size={20} />
                 </div>
             )}
          </button>

          {/* Dropdown Menu */}
          {currentUser && isProfileMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsProfileMenuOpen(false)}></div>
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-2 animate-in fade-in slide-in-from-top-2">
                    <div className="px-4 py-2 border-b border-gray-100 mb-2">
                        <p className="text-sm font-bold text-gray-900 truncate">{currentUser.name}</p>
                        <p className="text-xs text-gray-500 truncate">{currentUser.email}</p>
                    </div>
                    
                    {currentUser.role !== 'admin' && (
                        <button onClick={() => { setView('user'); setIsProfileMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-pink-50 flex items-center transition-colors">
                            <Package size={16} className="mr-2" /> รายการของฉัน
                        </button>
                    )}
                    
                    <button onClick={() => handleOpenSettings('profile')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-pink-50 flex items-center transition-colors">
                         <UserIcon size={16} className="mr-2" /> โปรไฟล์
                    </button>
                    
                    <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center mt-1 border-t border-gray-50 transition-colors">
                        <LogOut size={16} className="mr-2" /> ออกจากระบบ
                    </button>
                </div>
              </>
          )}
        </div>
      </div>
    </header>
  );

  const HomeView = () => (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center md:text-left">
        <h2 className="text-2xl font-bold text-gray-900 mb-2 transition-colors">รายการทั้งหมด</h2>
        <p className="text-gray-600 transition-colors">เลือกกล่องเพื่อดูสิ่งของภายในและทำการยืม</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {boxes.map(box => (
          <div 
            key={box.boxId} 
            className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-transparent hover:border-pink-200 cursor-pointer overflow-hidden"
            onClick={() => setSelectedBox(box)}
          >
            <div className="w-full aspect-[16/9] relative overflow-hidden bg-gray-100">
                <img src={box.coverImageUrl} className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500" alt={box.boxName} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                <div className="absolute bottom-4 left-4">
                    <span className="text-xs font-bold bg-white/95 text-gray-900 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm border border-gray-100">{box.boxType}</span>
                </div>
            </div>
            <div className="p-5">
              <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-primary transition-colors">{box.boxName}</h3>
              <p className="text-sm text-gray-600 mb-4 transition-colors">
                  ของทั้งหมด {box.itemCount} ชิ้น <span className="mx-1">•</span> <span className="text-green-700 font-medium">ว่าง {box.availableCount} ชิ้น</span>
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full border-primary text-primary hover:bg-primary hover:text-white"
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
        <div className="space-y-2 w-full">
            <Button 
               size="lg" 
               className="w-full text-base py-3 shadow-sm" 
               disabled={availableCount === 0 || !hasItems}
               onClick={() => handleBorrowBoxClick(selectedBox.boxId)}
            >
               {availableCount > 0 ? 'ยืมกล่องนี้ทั้งหมด' : 'ไม่มีของที่พร้อมยืมในกล่องนี้'}
            </Button>
            {availableCount > 0 && (
                <p className="text-center text-xs text-gray-500">
                    (จะยืมรายการที่สถานะ "ว่าง" ทั้งหมด {availableCount} รายการ)
                </p>
            )}
        </div>
    );
  })() : null;

  const isBorrowValid = hasCheckedItems && !!borrowProofFile;

  // Prepare Footer Content for Borrow Confirmation
  const borrowFooter = borrowTargetBox ? (
    <div className="w-full">
        <div className="flex gap-3 w-full">
            <Button variant="secondary" className="flex-1" onClick={() => setBorrowModalOpen(false)}>ยกเลิก</Button>
            <Button className="flex-1" onClick={confirmBorrow} disabled={!isBorrowValid}>ยืนยันการยืม</Button>
        </div>
        {!isBorrowValid && (
            <p className="text-xs text-danger text-center mt-2 animate-pulse">
                * กรุณาเช็ครายการสิ่งของและอัปโหลดรูปภาพก่อนยืนยันการยืม
            </p>
        )}
    </div>
  ) : null;

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="min-h-screen pb-10 bg-bg transition-colors duration-200">
      {renderHeader()}
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[70] animate-in fade-in slide-in-from-bottom-5">
          <div className="bg-gray-800 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2">
            <CheckCircle2 size={18} className="text-green-400" />
            <span className="font-medium text-sm">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Sub Navigation */}
      {view === 'user' && currentUser && (
           <div className="bg-white border-b border-gray-200 transition-colors">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                     <h2 className="text-xl font-bold text-gray-800">จัดการรายการยืม-คืน</h2>
                     <Button variant="secondary" size="sm" onClick={() => setView('home')}>ไปหน้าแรก</Button>
                </div>
           </div>
      )}

      {/* Main Content */}
      <main className="animate-in fade-in duration-300">
        {view === 'home' && <HomeView />}
        {view === 'user' && currentUser && (
            <UserView userId={currentUser.userId} records={records} items={items} boxes={boxes} />
        )}
        {view === 'admin' && currentUser?.role === 'admin' && (
            <AdminDashboard boxes={boxes} records={records} items={items} />
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
             <div className="mb-4">
                 <p className="text-sm text-gray-600">ประเภท: <span className="font-medium text-gray-900">{selectedBox.boxType}</span></p>
             </div>
             
             <div className="space-y-3">
                 {items.filter(i => i.boxId === selectedBox.boxId).map(item => (
                     <div key={item.itemId} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                         <div className="flex items-center gap-3">
                             <img src={item.itemImageUrl} className="w-12 h-12 rounded-md object-cover bg-gray-200" alt={item.itemName} />
                             <div>
                                 <h4 className="font-medium text-gray-900">{item.itemName}</h4>
                                 <Badge status={item.itemStatus} />
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
            <div className="space-y-6">
                {/* 1. Item List */}
                <div>
                    <h4 className="text-sm font-bold text-gray-900 mb-2">เช็ครายการสิ่งของในกล่องนี้</h4>
                    <div className="space-y-2 border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto bg-gray-50/50">
                        {items.filter(i => i.boxId === borrowTargetBox.boxId && i.itemStatus === 'available').map(item => (
                            <div key={item.itemId} className="flex items-center gap-3 p-2 bg-white rounded shadow-sm">
                                <img src={item.itemImageUrl} className="w-10 h-10 object-cover rounded" alt="" />
                                <span className="text-gray-900 text-sm font-medium">{item.itemName}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2. Checkbox Confirmation */}
                <div>
                    <label className="flex items-center space-x-3 cursor-pointer p-2 rounded hover:bg-gray-50 transition-colors">
                        <input 
                            type="checkbox" 
                            className="rounded text-primary focus:ring-primary h-5 w-5 border-gray-300"
                            checked={hasCheckedItems}
                            onChange={(e) => setHasCheckedItems(e.target.checked)}
                        />
                        <span className="text-gray-900 text-sm font-medium">ฉันได้ตรวจสอบรายการสิ่งของในกล่องนี้แล้ว</span>
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
                        className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 hover:border-primary/50 transition-all cursor-pointer group"
                    >
                        <div className="p-3 bg-white rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
                            <Upload className="w-6 h-6 text-primary" />
                        </div>
                        <p className="text-gray-800 font-medium text-sm">อัปโหลดรูปกล่อง/สิ่งของที่ยืม เพื่อใช้ประกอบการยืนยัน</p>
                        <p className="text-xs text-gray-500 mt-1">รองรับไฟล์ JPG, PNG</p>
                    </div>
                  ) : (
                    <div className="border border-green-200 bg-green-50 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 rounded-lg text-green-600">
                                <FileText className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-green-800 truncate max-w-[200px]">{borrowProofFile.name}</p>
                                <p className="text-xs text-green-600">{(borrowProofFile.size / 1024).toFixed(1)} KB</p>
                            </div>
                        </div>
                        <button 
                            onClick={handleRemoveBorrowFile}
                            className="p-1 hover:bg-green-100 rounded-full text-green-700 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                  )}
                </div>

                {/* 4. Duration Selector */}
                <div>
                    <label className="block text-sm font-bold text-gray-800 mb-2">จำนวนวันที่ต้องการยืม</label>
                    <div className="flex items-center gap-2 flex-wrap">
                         {[3, 7, 14, 30].map(d => (
                             <button
                                key={d}
                                onClick={() => setBorrowDays(d)}
                                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                                    borrowDays === d 
                                    ? 'bg-primary text-white border-primary' 
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                             >
                                 {d} วัน
                             </button>
                         ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">* กรุณาคืนภายในวันที่กำหนด</p>
                </div>
            </div>
        )}
      </Modal>

    </div>
  );
}