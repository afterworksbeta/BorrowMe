
import React, { useState, useRef, useEffect } from 'react';
import { Record, Item, Box, RecordStatus } from '../types';
import { Button, Badge, Modal } from '../components/Common';
import { Package, Upload, FileText, X, Bell, AlertCircle, CalendarClock } from 'lucide-react';
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
      {/* Tabs */}
      <div className="flex border-b border-gray-100 mb-8 overflow-x-auto gap-6">
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
    className={`px-4 py-3 font-bold text-sm transition-all border-b-2 whitespace-nowrap ${
      active ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'
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
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Checkbox Style matching new theme (Yellow/Secondary)
  const checkboxClass = "appearance-none h-5 w-5 rounded border border-gray-300 bg-white cursor-pointer transition-all checked:bg-secondary checked:border-secondary-dark relative checked:after:content-[''] checked:after:absolute checked:after:top-1/2 checked:after:left-1/2 checked:after:-translate-x-1/2 checked:after:-translate-y-1/2 checked:after:w-2.5 checked:after:h-2.5 checked:after:rounded-sm checked:after:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-1";

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

  const toggleGroupSelect = (groupRecordIds: string[]) => {
    const next = new Set(selectedRecordIds);
    const isAllSelected = groupRecordIds.every(id => next.has(id));

    if (isAllSelected) {
        // Deselect all
        groupRecordIds.forEach(id => next.delete(id));
    } else {
        // Select all
        groupRecordIds.forEach(id => next.add(id));
    }
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

  const handleSubmitReturn = async () => {
      setIsLoading(true);
      
      let proofUrl = "https://picsum.photos/400/600";
      if (returnProofFile) {
        const uploaded = await DB.uploadFile(returnProofFile, 'return-proofs');
        if (uploaded) proofUrl = uploaded;
      }

      await DB.requestReturnBatch(Array.from(selectedRecordIds), proofUrl);
      setIsLoading(false);
      setReturnModalOpen(false);
  };

  const isReturnValid = selectedRecordIds.size > 0 && !!returnProofFile;

  // Prepare Grouped Items for Return Modal
  // Helper to group items by name
  const getGroupedReturnItems = (boxRecords: Record[]) => {
      return boxRecords.reduce((acc, r) => {
          const item = items.find(i => i.itemId === r.itemId);
          if (!item) return acc;
          const existing = acc.find(g => g.name === item.itemName);
          if (existing) {
              existing.count++;
              existing.recordIds.push(r.recordId);
          } else {
              acc.push({
                  name: item.itemName,
                  imageUrl: item.itemImageUrl,
                  count: 1,
                  recordIds: [r.recordId]
              });
          }
          return acc;
      }, [] as { name: string; imageUrl: string; count: number; recordIds: string[] }[]);
  };

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

        // Grouping logic for display on card
        const groupedItemsForCard = boxRecords.reduce((acc, r) => {
            const item = items.find(i => i.itemId === r.itemId);
            if (!item) return acc;
            const existing = acc.find(g => g.name === item.itemName);
            if (existing) {
                existing.count++;
            } else {
                acc.push({ name: item.itemName, count: 1 });
            }
            return acc;
        }, [] as { name: string; count: number }[]);

        return (
          <div key={boxId} className={`bg-white p-6 rounded-2xl shadow-card border flex flex-col transition-all hover:shadow-soft ${isOverdue ? 'border-red-200 bg-red-50/20' : 'border-gray-100 hover:border-blue-200'}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900 line-clamp-1">{box?.boxName || 'Unknown Box'}</h3>
                <p className="text-sm text-gray-500 font-medium">{box?.boxType}</p>
              </div>
              <div className="bg-bg text-primary-dark px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border border-blue-100">
                {boxRecords.length} รายการ
              </div>
            </div>

            {/* Status and Due Date Info */}
            <div className="mb-5 flex flex-wrap items-center gap-2">
                 <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700`}>
                    {getUserStatusLabel('borrowing')}
                 </span>
                 <span className={`text-xs font-bold flex items-center gap-1 ${isOverdue ? 'text-red-500 bg-red-50 px-2 py-1 rounded-lg' : 'text-gray-400'}`}>
                    {isOverdue && <AlertCircle size={14} />}
                    {dueText}
                    {isNearDue && !rejectionNote && (
                        <div className="group relative">
                            <Bell size={14} className="text-secondary fill-secondary animate-pulse" />
                        </div>
                    )}
                 </span>
            </div>
            
            {/* Show Rejection Note if exists */}
            {rejectionNote && (
                 <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-xl text-sm">
                     <div className="flex items-center gap-2 mb-1">
                         <AlertCircle size={16} className="text-red-600" />
                         <p className="font-bold text-red-700">คำขอคืนล่าสุดไม่ได้รับการอนุมัติ</p>
                     </div>
                     <p className="text-red-600 ml-6 italic">"{rejectionNote}"</p>
                 </div>
            )}
            
            <div className="space-y-2 mb-6 flex-grow">
              {groupedItemsForCard.map((g, idx) => (
                <div key={idx} className="flex items-center text-sm text-gray-700 bg-gray-50/50 p-2 rounded-lg">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mr-3 ml-1"></div>
                  <span className="font-medium">{g.name}</span>
                  {g.count > 1 && <span className="ml-2 text-primary text-xs font-bold bg-blue-50 px-1.5 rounded">x{g.count}</span>}
                </div>
              ))}
            </div>

            <Button 
                onClick={() => handleReturnClick(boxId)} 
                variant="primary" 
                className="w-full shadow-lg shadow-blue-200"
            >
              {rejectionNote ? "ขอคืนอีกครั้ง" : "ขอคืนของ"}
            </Button>
          </div>
        );
      })}

      <Modal 
        isOpen={returnModalOpen} 
        onClose={() => setReturnModalOpen(false)} 
        title="คืนของ"
        maxWidth="max-w-2xl"
        footer={
            <div className="w-full">
                <Button 
                    onClick={handleSubmitReturn} 
                    className="w-full" 
                    disabled={!isReturnValid || isLoading}
                    isLoading={isLoading}
                >
                  ยืนยันการขอคืน ({selectedRecordIds.size} รายการ)
                </Button>
                {!isReturnValid && (
                    <p className="text-xs text-danger text-center mt-3 font-medium animate-pulse">
                       * กรุณาเช็ครายการสิ่งของและอัปโหลดรูปหลักฐานก่อน
                    </p>
                )}
            </div>
        }
      >
        {selectedBoxId && groupedByBox[selectedBoxId] && (
          <div className="space-y-8">
            <div>
                <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-gray-900">เช็ครายการสิ่งของที่ต้องการคืน:</p>
                    <p className="text-xs text-gray-500">เลือกรายการที่พร้อมคืน</p>
                </div>
                <div className="space-y-2 border border-gray-100 rounded-2xl p-4 max-h-64 overflow-y-auto bg-gray-50">
                {/* Logic to render grouped items */}
                {getGroupedReturnItems(groupedByBox[selectedBoxId]).map(group => {
                    const isAllSelected = group.recordIds.every(id => selectedRecordIds.has(id));
                    
                    return (
                        <label key={group.name} className="flex items-center space-x-3 p-3 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-secondary transition-all cursor-pointer">
                            <input 
                                type="checkbox" 
                                className={checkboxClass}
                                checked={isAllSelected}
                                onChange={() => toggleGroupSelect(group.recordIds)}
                            />
                            <div className="flex items-center space-x-3 flex-1">
                                <img src={group.imageUrl} className="w-10 h-10 object-cover rounded-lg bg-gray-100" alt="" />
                                <div>
                                    <p className="text-gray-900 text-sm font-bold">{group.name}</p>
                                    <p className="text-gray-500 text-xs font-medium">จำนวน {group.count} รายการ</p>
                                </div>
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
                    className="border-2 border-dashed border-gray-300 rounded-2xl p-8 flex flex-col items-center justify-center bg-white hover:bg-blue-50/30 hover:border-primary/50 transition-all cursor-pointer group"
                >
                    <div className="p-4 bg-blue-50 text-primary rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6" />
                    </div>
                    <p className="text-gray-800 font-bold text-sm">คลิกเพื่ออัปโหลดรูปภาพ</p>
                    <p className="text-xs text-gray-500 mt-1">รองรับไฟล์ JPG, PNG</p>
                </div>
              ) : (
                <div className="border border-green-200 bg-green-50 rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-green-100 rounded-xl text-green-600">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-green-800 truncate max-w-[200px]">{returnProofFile.name}</p>
                            <p className="text-xs text-green-600 font-medium">{(returnProofFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleRemoveFile}
                        className="p-1.5 hover:bg-green-100 rounded-full text-green-700 transition-colors"
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

  // GROUPING LOGIC
  
  type GroupedItem = { 
    recordId: string, 
    name: string, 
    imageUrl: string, 
    status: RecordStatus, 
    dateLabel: string, 
    count: number 
  };

  const groupedItems = records.reduce((acc, r) => {
    const item = items.find(i => i.itemId === r.itemId);
    if (!item) return acc;

    // Determine Date to group by (so history from different days doesn't merge)
    const dateRaw = type === 'pendingReturn' ? r.returnRequestDate : r.returnedAt;
    const dateStr = dateRaw ? new Date(dateRaw).toLocaleDateString('th-TH') : '-';
    
    // Key: Name + Date (to keep different batches separate)
    const key = `${item.itemName}_${dateStr}`;

    if (!acc[key]) {
        acc[key] = {
            recordId: r.recordId, // Use first record ID for key
            name: item.itemName,
            imageUrl: item.itemImageUrl,
            status: r.status,
            dateLabel: dateStr,
            count: 0
        };
    }
    acc[key].count++;
    return acc;
  }, {} as { [key: string]: GroupedItem });

  return (
    <div className="space-y-4">
      {Object.values(groupedItems).map((group: GroupedItem) => {
        const statusLabel = getUserStatusLabel(group.status);
        
        return (
          <div 
            key={group.recordId} 
            className={`bg-white p-5 rounded-2xl shadow-card border border-gray-100 flex items-center justify-between hover:border-primary/20 transition-all`}
          >
            <div className="flex items-center gap-5">
                <div className="relative">
                    <img src={group.imageUrl} className="w-16 h-16 rounded-xl object-cover bg-gray-100 border border-gray-100" alt="" />
                    {group.count > 1 && (
                        <div className="absolute -top-2 -right-2 bg-secondary text-slate-900 text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                            {group.count}
                        </div>
                    )}
                </div>
                <div>
                    <h4 className="font-bold text-gray-900 flex items-center gap-2 text-lg">
                        {group.name}
                    </h4>
                    <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                        <CalendarClock size={14} />
                        <span>
                            {type === 'pendingReturn'
                                ? `ขอคืนเมื่อ: ${group.dateLabel}` 
                                : `คืนสำเร็จเมื่อ: ${group.dateLabel}`
                            }
                        </span>
                    </div>
                </div>
            </div>
            <div className="flex flex-col items-end gap-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
                    type === 'returned' 
                    ? 'bg-gray-100 text-gray-600 border-gray-200' 
                    : 'bg-secondary/20 text-yellow-800 border-yellow-200'
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
  <div className="flex flex-col items-center justify-center h-64 text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200">
    <div className="bg-gray-50 p-4 rounded-full mb-4">
        <Package className="w-10 h-10 text-gray-300" />
    </div>
    <p className="text-gray-500 font-bold">{message}</p>
  </div>
);

export default UserView;
