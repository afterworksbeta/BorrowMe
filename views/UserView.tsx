
import React, { useState, useRef, useEffect } from 'react';
import { Record, Item, Box, RecordStatus } from '../types';
import { Button, Badge, Modal } from '../components/Common';
import { Package, Upload, FileText, X, Bell, AlertCircle } from 'lucide-react';
import * as DB from '../services/db';

interface UserViewProps {
  userId: string;
  records: Record[];
  items: Item[];
  boxes: Box[];
}

const UserView: React.FC<UserViewProps> = ({ userId, records, items, boxes }) => {
  // NEW TABS: borrowing, pendingReturn, returned
  const [activeTab, setActiveTab] = useState<'borrowing' | 'pendingReturn' | 'returned'>('borrowing');
  const myRecords = records.filter(r => r.userId === userId);

  // Status Filtering
  const borrowing = myRecords.filter(r => r.status === 'borrowing');
  const pendingReturn = myRecords.filter(r => r.status === 'pendingReturn');
  const returned = myRecords.filter(r => r.status === 'returned');

  // Real-time counter for due dates
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        <TabItem label={`กำลังยืม (${borrowing.length})`} active={activeTab === 'borrowing'} onClick={() => setActiveTab('borrowing')} />
        <TabItem label={`รอตรวจคืน (${pendingReturn.length})`} active={activeTab === 'pendingReturn'} onClick={() => setActiveTab('pendingReturn')} />
        <TabItem label={`คืนแล้ว (${returned.length})`} active={activeTab === 'returned'} onClick={() => setActiveTab('returned')} />
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'borrowing' && <BorrowingList records={borrowing} items={items} boxes={boxes} now={now} />}
        {activeTab === 'pendingReturn' && <StatusList records={pendingReturn} items={items} type="pendingReturn" onResubmitSuccess={() => {}} />}
        {activeTab === 'returned' && <StatusList records={returned} items={items} type="returned" onResubmitSuccess={() => {}} />}
      </div>
    </div>
  );
};

const TabItem: React.FC<{ label: string, active: boolean, onClick: () => void }> = ({ label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${
      active ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-800'
    }`}
  >
    {label}
  </button>
);

// Helper to calculate due info
const getDueInfo = (borrowedAtStr: string, days: number, now: number) => {
    const borrowedAt = new Date(borrowedAtStr).getTime();
    const durationMs = days * 24 * 60 * 60 * 1000;
    const dueDate = borrowedAt + durationMs;
    const diffMs = dueDate - now;
    // Calculate days left (ceil to round up partial days)
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    let text = `ยืม ${days} วัน`;
    let isOverdue = false;
    let isNearDue = false;

    if (daysLeft < 0) {
        text += ` • เกินกำหนด ${Math.abs(daysLeft)} วัน`;
        isOverdue = true;
    } else if (daysLeft === 0) {
        text += ` • ครบกำหนดวันนี้`;
        isNearDue = true;
    } else {
        text += ` • เหลืออีก ${daysLeft} วัน`;
        if (daysLeft <= 1) isNearDue = true;
    }

    return { text, isOverdue, isNearDue, daysLeft };
};

// Helper for User Facing Status Labels
const getUserStatusLabel = (status: RecordStatus) => {
    switch (status) {
        case 'borrowing': return 'กำลังยืมอยู่';
        case 'pendingReturn': return 'รอตรวจคืน';
        case 'returned': return 'คืนแล้ว';
        default: return status;
    }
};

const BorrowingList: React.FC<{ records: Record[], items: Item[], boxes: Box[], now: number }> = ({ records, items, boxes, now }) => {
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [returnProofFile, setReturnProofFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Group by Box
  const groupedByBox: { [key: string]: Record[] } = {};
  records.forEach(r => {
    if (!groupedByBox[r.boxId]) groupedByBox[r.boxId] = [];
    groupedByBox[r.boxId].push(r);
  });

  const handleReturnClick = (boxId: string) => {
    setSelectedBoxId(boxId);
    setReturnModalOpen(true);
    setSelectedRecordIds(new Set()); 
    setReturnProofFile(null);
  };

  const toggleSelect = (recordId: string) => {
    const next = new Set(selectedRecordIds);
    if (next.has(recordId)) next.delete(recordId);
    else next.add(recordId);
    setSelectedRecordIds(next);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setReturnProofFile(e.target.files[0]);
    }
  };

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setReturnProofFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmitReturn = () => {
      const proofUrl = returnProofFile 
          ? URL.createObjectURL(returnProofFile) 
          : "https://picsum.photos/400/600"; 
          
      selectedRecordIds.forEach(id => {
          DB.requestReturn(id, proofUrl);
      });
      setReturnModalOpen(false);
  };

  const isReturnValid = selectedRecordIds.size > 0 && !!returnProofFile;

  if (records.length === 0) return <EmptyState message="ไม่มีรายการที่กำลังยืม" />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {Object.entries(groupedByBox).map(([boxId, boxRecords]) => {
        const box = boxes.find(b => b.boxId === boxId);
        
        // Check for rejection notes
        const rejectionNote = boxRecords.find(r => r.adminNote)?.adminNote;
        
        // Calculate Time Info (Assume all items in box borrowed at same time, take first)
        const firstRecord = boxRecords[0];
        const { text: dueText, isOverdue, isNearDue } = getDueInfo(firstRecord.borrowedAt, firstRecord.daysBorrowed, now);

        return (
          <div key={boxId} className={`bg-white p-6 rounded-xl shadow-sm border flex flex-col transition-colors ${isOverdue ? 'border-red-200 bg-red-50/10' : 'border-gray-200 hover:border-pink-200'}`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{box?.boxName || 'Unknown Box'}</h3>
                <p className="text-sm text-gray-600">{box?.boxType}</p>
              </div>
              <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                {boxRecords.length} ชิ้น
              </div>
            </div>

            {/* Status and Due Date Info */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                 <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800`}>
                    {getUserStatusLabel('borrowing')}
                 </span>
                 <span className={`text-xs font-medium flex items-center gap-1 ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                    {dueText}
                    {isNearDue && !rejectionNote && (
                        <div className="group relative">
                            <Bell size={14} className="text-orange-500 animate-pulse" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-center">
                                ระบบจะส่งการแจ้งเตือนให้คุณล่วงหน้า 1 วันก่อนครบกำหนด
                            </div>
                        </div>
                    )}
                 </span>
            </div>
            
            {/* Show Rejection Note if exists */}
            {rejectionNote && (
                 <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm">
                     <div className="flex items-center gap-2 mb-1">
                         <AlertCircle size={16} className="text-red-600" />
                         <p className="font-bold text-red-700">คำขอคืนล่าสุดไม่ได้รับการอนุมัติ</p>
                     </div>
                     <p className="text-red-600 ml-6">"{rejectionNote}"</p>
                     <p className="text-xs text-red-500 mt-2 ml-6">กรุณากด "ขอคืนของ" อีกครั้งพร้อมแก้ไขหลักฐาน</p>
                 </div>
            )}
            
            <ul className="space-y-2 mb-6 flex-grow">
              {boxRecords.map(r => {
                const item = items.find(i => i.itemId === r.itemId);
                return (
                  <li key={r.recordId} className="flex items-center text-sm text-gray-700">
                    <div className="w-2 h-2 rounded-full bg-primary mr-2"></div>
                    {item?.itemName}
                  </li>
                );
              })}
            </ul>

            <Button onClick={() => handleReturnClick(boxId)} variant="primary" className="w-full">
              {rejectionNote ? "ขอคืนอีกครั้ง" : "ขอคืนของ"}
            </Button>
          </div>
        );
      })}

      <Modal 
        isOpen={returnModalOpen} 
        onClose={() => setReturnModalOpen(false)} 
        title="คืนของ"
        footer={
            <div className="w-full">
                <Button 
                    onClick={handleSubmitReturn} 
                    className="w-full" 
                    disabled={!isReturnValid}
                >
                  ยืนยันการขอคืน ({selectedRecordIds.size} รายการ)
                </Button>
                {!isReturnValid && (
                    <p className="text-xs text-danger text-center mt-2 animate-pulse">
                       * กรุณาเช็ครายการสิ่งของที่ต้องการคืน และอัปโหลดรูปหลักฐานก่อน
                    </p>
                )}
            </div>
        }
      >
        {selectedBoxId && groupedByBox[selectedBoxId] && (
          <div className="space-y-6">
            <div>
                <p className="text-sm font-bold text-gray-900 mb-3">เช็ครายการสิ่งของที่ต้องการคืน:</p>
                <div className="space-y-2 border border-gray-200 rounded-lg p-3 max-h-60 overflow-y-auto bg-gray-50/50">
                {groupedByBox[selectedBoxId].map(r => {
                    const item = items.find(i => i.itemId === r.itemId);
                    return (
                    <label key={r.recordId} className="flex items-center space-x-3 p-2 hover:bg-white hover:shadow-sm rounded transition-all cursor-pointer">
                        <input 
                        type="checkbox" 
                        className="rounded text-primary focus:ring-primary h-5 w-5 border-gray-300"
                        checked={selectedRecordIds.has(r.recordId)}
                        onChange={() => toggleSelect(r.recordId)}
                        />
                        <div className="flex items-center space-x-3">
                            <img src={item?.itemImageUrl} className="w-10 h-10 object-cover rounded" alt="" />
                            <span className="text-gray-900 text-sm font-medium">{item?.itemName}</span>
                        </div>
                    </label>
                    );
                })}
                </div>
            </div>

            <div>
              <p className="text-sm font-bold text-gray-900 mb-2">แนบรูปถ่ายของที่วางคืน (หลักฐาน)</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/png, image/jpeg"
                onChange={handleFileChange}
              />
              
              {!returnProofFile ? (
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 hover:border-primary/50 transition-all cursor-pointer group"
                >
                    <div className="p-3 bg-white rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6 text-primary" />
                    </div>
                    <p className="text-gray-800 font-medium text-sm">คลิกเพื่ออัปโหลดรูปภาพ</p>
                    <p className="text-xs text-gray-500 mt-1">รองรับไฟล์ JPG, PNG</p>
                </div>
              ) : (
                <div className="border border-green-200 bg-green-50 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg text-green-600">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-green-800 truncate max-w-[200px]">{returnProofFile.name}</p>
                            <p className="text-xs text-green-600">{(returnProofFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleRemoveFile}
                        className="p-1 hover:bg-green-100 rounded-full text-green-700 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

interface StatusListProps {
    records: Record[];
    items: Item[];
    type: 'pendingReturn' | 'returned';
    onResubmitSuccess: () => void;
}

const StatusList: React.FC<StatusListProps> = ({ records, items, type }) => {
  if (records.length === 0) return <EmptyState message={type === 'pendingReturn' ? "ไม่มีรายการรออนุมัติ" : "ไม่มีประวัติการคืน"} />;

  return (
    <div className="space-y-4">
      {records.map(r => {
        const item = items.find(i => i.itemId === r.itemId);
        const statusLabel = getUserStatusLabel(r.status);
        
        return (
          <div 
            key={r.recordId} 
            className={`bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between`}
          >
            <div className="flex items-center gap-4">
                <img src={item?.itemImageUrl} className="w-16 h-16 rounded-lg object-cover bg-gray-200" alt="" />
                <div>
                    <h4 className="font-bold text-gray-900">{item?.itemName}</h4>
                    <p className="text-xs text-gray-600 mt-1">
                        {type === 'pendingReturn'
                            ? `ขอคืนเมื่อ: ${new Date(r.returnRequestDate!).toLocaleDateString('th-TH')}` 
                            : `คืนสำเร็จเมื่อ: ${new Date(r.returnedAt!).toLocaleDateString('th-TH')}`
                        }
                    </p>
                </div>
            </div>
            <div className="flex flex-col items-end gap-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    type === 'returned' 
                    ? 'bg-green-100 text-green-800 border-green-200' 
                    : 'bg-orange-100 text-orange-800 border-orange-200'
                }`}>
                    {statusLabel}
                </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center h-64 text-gray-400">
    <Package className="w-12 h-12 mb-2 opacity-50" />
    <p className="text-gray-500 font-medium">{message}</p>
  </div>
);

export default UserView;
