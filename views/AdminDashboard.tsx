
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { PopulatedBox, Item, Record, RecordStatus } from '../types';
import { Button, Input, Modal, Select } from '../components/Common';
import * as DB from '../services/db';
import { Plus, Edit, Trash, Search, Upload, Image as ImageIcon, AlertTriangle, X } from 'lucide-react';

interface AdminDashboardProps {
  boxes: PopulatedBox[];
  records: Record[];
  items: Item[];
  initialTab?: 'boxes' | 'approvals' | 'history';
  navigationTick?: number;
  onDeleteRecords?: (recordIds: string[]) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ boxes, records, items, initialTab, navigationTick, onDeleteRecords }) => {
  const [activeTab, setActiveTab] = useState<'boxes' | 'approvals' | 'history'>(initialTab || 'boxes');

  // Sync activeTab when initialTab prop changes (e.g. from notification click)
  // navigationTick ensures this effect runs even if initialTab value is the same string
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, navigationTick]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex space-x-4 mb-8 overflow-x-auto pb-2">
        <TabButton active={activeTab === 'boxes'} onClick={() => setActiveTab('boxes')}>จัดการกล่อง</TabButton>
        <TabButton active={activeTab === 'approvals'} onClick={() => setActiveTab('approvals')}>รออนุมัติการคืน</TabButton>
        <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')}>ประวัติการยืม-คืนทั้งหมด</TabButton>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 min-h-[500px]">
        {activeTab === 'boxes' && <BoxManagementView boxes={boxes} />}
        {activeTab === 'approvals' && <ApprovalsView records={records} items={items} boxes={boxes} />}
        {activeTab === 'history' && <HistoryView records={records} boxes={boxes} items={items} onDeleteRecords={onDeleteRecords} />}
      </div>
    </div>
  );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-6 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
      active ? 'bg-primary text-white shadow-md' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
    }`}
  >
    {children}
  </button>
);

const BoxManagementView: React.FC<{ boxes: PopulatedBox[] }> = ({ boxes }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBoxId, setEditingBoxId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
      name: string, 
      type: string, 
      coverFile: File | null, 
      coverUrlPreview: string,
      items: {name: string, img: string, qty: number}[]
  }>({
    name: '', type: '', coverFile: null, coverUrlPreview: '', items: []
  });
  
  const [error, setError] = useState<string | null>(null);
  const [deleteTargetBox, setDeleteTargetBox] = useState<PopulatedBox | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreate = () => {
    setError(null);
    if(!formData.name.trim() || !formData.type.trim()) {
        setError('กรุณากรอกข้อมูลให้ครบถ้วน');
        return;
    }
    
    let coverUrl = formData.coverUrlPreview;
    if (formData.coverFile) {
        coverUrl = URL.createObjectURL(formData.coverFile);
    }

    if (editingBoxId) {
        DB.updateBox(editingBoxId, {
            boxName: formData.name,
            boxType: formData.type,
            coverImageUrl: coverUrl
        }, formData.items);
    } else {
        DB.createBox(formData.name, formData.type, coverUrl, formData.items);
    }

    setIsModalOpen(false);
    setEditingBoxId(null);
    setFormData({ name: '', type: '', coverFile: null, coverUrlPreview: '', items: [] });
  };

  const handleEditBox = (box: PopulatedBox) => {
      setEditingBoxId(box.boxId);
      const boxItems = DB.getBoxItems(box.boxId);
      
      const aggregatedItems: {name: string, img: string, qty: number}[] = [];
      const processedNames = new Set<string>();

      boxItems.forEach(item => {
          if (processedNames.has(item.itemName)) return;
          const count = boxItems.filter(i => i.itemName === item.itemName).length;
          aggregatedItems.push({
              name: item.itemName,
              img: item.itemImageUrl,
              qty: count
          });
          processedNames.add(item.itemName);
      });

      setFormData({
          name: box.boxName,
          type: box.boxType,
          coverFile: null,
          coverUrlPreview: box.coverImageUrl,
          items: aggregatedItems.length > 0 ? aggregatedItems : []
      });
      setError(null);
      setIsModalOpen(true);
  };
  
  const handleRequestDeleteBox = (box: PopulatedBox) => {
      setDeleteTargetBox(box);
  };
  
  const confirmDeleteBox = () => {
      if (deleteTargetBox) {
          DB.deleteBox(deleteTargetBox.boxId);
          setDeleteTargetBox(null);
      }
  };

  const addItemRow = () => {
      setFormData(prev => ({...prev, items: [...prev.items, {name: '', img: '', qty: 1}]}));
  };
  
  const updateItemRow = (idx: number, field: 'name'|'img'|'qty', val: string | number) => {
      const newItems = [...formData.items];
      newItems[idx] = { ...newItems[idx], [field]: val };
      setFormData(prev => ({...prev, items: newItems}));
  };

  const removeItemRow = (idx: number) => {
      setFormData(prev => ({...prev, items: prev.items.filter((_, i) => i !== idx)}));
  };

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if(e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setFormData(prev => ({ 
              ...prev, 
              coverFile: file,
              coverUrlPreview: URL.createObjectURL(file) 
          }));
      }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">รายการกล่องทั้งหมด</h2>
        <Button onClick={() => {
            setEditingBoxId(null);
            setFormData({ name: '', type: '', coverFile: null, coverUrlPreview: '', items: [] });
            setError(null);
            setIsModalOpen(true);
        }} size="sm">
          <Plus className="w-4 h-4 mr-2" /> เพิ่มกล่องใหม่
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {boxes.map(box => (
          <div key={box.boxId} className="border border-gray-200 rounded-lg p-4 flex flex-col hover:border-pink-200 transition-colors group bg-white">
            <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-md overflow-hidden aspect-[16/9] border border-gray-100">
                    <img src={box.coverImageUrl} className="w-full h-full object-cover object-center" alt="" />
                </div>
                <div>
                    <h3 className="font-bold text-gray-900 line-clamp-1">{box.boxName}</h3>
                    <p className="text-sm text-gray-600 line-clamp-1">{box.boxType}</p>
                </div>
            </div>
            <div className="mt-auto flex justify-between items-center text-sm">
                <span className="text-gray-700">สิ่งของ {box.itemCount} รายการ</span>
                <div className="space-x-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                        className="text-orange-600 hover:text-orange-700 p-1 hover:bg-orange-50 rounded"
                        onClick={(e) => { e.stopPropagation(); handleEditBox(box); }}
                    >
                        <Edit className="w-4 h-4" />
                    </button>
                    <button 
                        className="text-red-600 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                        onClick={(e) => { e.stopPropagation(); handleRequestDeleteBox(box); }}
                    >
                        <Trash className="w-4 h-4" />
                    </button>
                </div>
            </div>
          </div>
        ))}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingBoxId ? "แก้ไขกล่อง" : "เพิ่มกล่องใหม่"}
        maxWidth="max-w-3xl"
        footer={<Button className="w-full" onClick={handleCreate}>{editingBoxId ? "บันทึกการแก้ไข" : "บันทึกกล่อง"}</Button>}
      >
        <div className="space-y-4">
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                    <AlertTriangle size={16} />
                    {error}
                </div>
            )}
            <div className="grid grid-cols-2 gap-4">
                <Input 
                    label="ชื่อกล่อง" 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    placeholder="เช่น Box D - กล่องอุปกรณ์ไฟฟ้า"
                />
                <Input 
                    label="ประเภท" 
                    value={formData.type} 
                    onChange={e => setFormData({...formData, type: e.target.value})} 
                    placeholder="เช่น เครื่องใช้ไฟฟ้า, เอกสาร"
                />
            </div>
            
            <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">รูปปกกล่อง</label>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleCoverFileChange} />
                <div className="flex items-center gap-4">
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="w-4 h-4 mr-2" /> อัปโหลดรูปปก
                    </Button>
                    {formData.coverFile && (
                        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                             <ImageIcon className="w-4 h-4" />
                             <span>{formData.coverFile.name}</span>
                        </div>
                    )}
                </div>
                {formData.coverUrlPreview && (
                     <div className="mt-2 w-full aspect-[16/9] rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                        <img src={formData.coverUrlPreview} className="w-full h-full object-cover object-center" alt="Preview" />
                     </div>
                )}
            </div>
            
            <div className="border-t border-gray-100 pt-4">
                <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-800">รายการสิ่งของในกล่อง</label>
                    <Button size="sm" variant="secondary" onClick={addItemRow}>+ เพิ่มรายการ</Button>
                </div>
                <div className="space-y-3">
                    {formData.items.map((item, idx) => (
                        <div key={idx} className="flex gap-2 items-start bg-gray-50 p-2 rounded-lg">
                            <div className="flex-[2]">
                                <input placeholder="เช่น สายต่อพ่วง, ปลั๊กไฟ" className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm" value={item.name} onChange={e => updateItemRow(idx, 'name', e.target.value)} />
                            </div>
                            <div className="flex-[1]">
                                <input type="number" min="1" placeholder="จำนวน" className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm" value={item.qty} onChange={e => updateItemRow(idx, 'qty', parseInt(e.target.value) || 1)} />
                            </div>
                            <div className="flex-[2] flex flex-col justify-center">
                                <input type="file" id={`item-upload-${idx}`} className="hidden" accept="image/*" onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        updateItemRow(idx, 'img', URL.createObjectURL(e.target.files[0]));
                                    }
                                }}/>
                                <div className="flex items-center gap-2">
                                    <button 
                                        type="button" 
                                        onClick={() => document.getElementById(`item-upload-${idx}`)?.click()}
                                        className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 whitespace-nowrap"
                                    >
                                        <Upload className="w-3 h-3" />
                                        <span>อัปโหลดรูป</span>
                                    </button>
                                    {item.img && <img src={item.img} className="w-9 h-9 rounded object-cover border border-gray-200" alt="Preview" />}
                                </div>
                            </div>
                            <button onClick={() => removeItemRow(idx)} className="text-red-500 p-2 hover:bg-red-100 rounded mt-1"><X className="w-4 h-4" /></button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </Modal>
      
      <Modal
        isOpen={!!deleteTargetBox}
        onClose={() => setDeleteTargetBox(null)}
        title="ยืนยันการลบกล่อง"
        maxWidth="max-w-md"
        footer={
            <div className="flex gap-3 w-full">
                <Button variant="secondary" className="flex-1" onClick={() => setDeleteTargetBox(null)}>ยกเลิก</Button>
                <Button variant="danger" className="flex-1" onClick={confirmDeleteBox}>ลบกล่องนี้</Button>
            </div>
        }
      >
          <div className="text-center py-4">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle size={24} />
              </div>
              <p className="text-gray-800">
                  กล่อง <span className="font-bold">“{deleteTargetBox?.boxName}”</span> และรายการสิ่งของภายในจะถูกลบออกจากระบบ ไม่สามารถกู้คืนได้
              </p>
          </div>
      </Modal>

    </div>
  );
};

const ApprovalsView: React.FC<{ records: Record[], items: Item[], boxes: PopulatedBox[] }> = ({ records, items, boxes }) => {
    // 1. Strict Filtering for 'pendingReturn'
    const checkingRecords = records.filter(r => r.status === 'pendingReturn');
    
    // Grouping logic for UI display
    const groups: {[key: string]: Record[]} = {};
    checkingRecords.forEach(r => {
        const key = `${r.userId}_${r.boxId}`;
        if(!groups[key]) groups[key] = [];
        groups[key].push(r);
    });

    const [selectedGroup, setSelectedGroup] = useState<Record[] | null>(null);

    // Grouping helper for the modal display
    const groupedSelectedItems = useMemo(() => {
        if (!selectedGroup) return [];
        const grouped: { [key: string]: { name: string, img: string, count: number } } = {};
        selectedGroup.forEach(r => {
            const item = items.find(i => i.itemId === r.itemId);
            if (!item) return;
            if (!grouped[item.itemName]) {
                grouped[item.itemName] = { name: item.itemName, img: item.itemImageUrl, count: 0 };
            }
            grouped[item.itemName].count++;
        });
        return Object.values(grouped);
    }, [selectedGroup, items]);


    // 2. Handle Approval Action with Logging
    const handleApprove = (isApproved: boolean) => {
        console.log("handleApprove", isApproved, selectedGroup);
        if(!selectedGroup) return;
        
        // Execute DB update for each record in the group
        selectedGroup.forEach(r => {
            DB.adminApproveReturn(r.recordId, isApproved);
        });

        // Clear selection
        setSelectedGroup(null);
        // DB service handles notify() automatically
    };

    return (
        <div>
            <h2 className="text-xl font-bold text-gray-900 mb-6">คำขอคืนของที่รออนุมัติ</h2>
            {Object.keys(groups).length === 0 ? (
                <p className="text-gray-500 text-center py-10">ไม่มีรายการรออนุมัติ</p>
            ) : (
                <div className="grid gap-4">
                    {Object.entries(groups).map(([key, groupRecords]) => {
                        const first = groupRecords[0];
                        const box = boxes.find(b => b.boxId === first.boxId);
                        return (
                            <div key={key} className="border border-gray-200 rounded-lg p-4 flex justify-between items-center hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedGroup(groupRecords)}>
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                                        {groupRecords.length}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900">{box?.boxName || 'Unknown Box'}</h3>
                                        <p className="text-sm text-gray-700">ผู้ขอคืน: {first.userName} ({first.userPhone})</p>
                                        <p className="text-xs text-gray-500">ขอคืนเมื่อ: {new Date(first.returnRequestDate || '').toLocaleString('th-TH')}</p>
                                    </div>
                                </div>
                                <Button size="sm" variant="outline">ตรวจสอบ</Button>
                            </div>
                        )
                    })}
                </div>
            )}

            <Modal 
                isOpen={!!selectedGroup} 
                onClose={() => setSelectedGroup(null)} 
                title="อนุมัติการคืนของ" 
                maxWidth="max-w-3xl"
                footer={selectedGroup && (
                    <div className="flex gap-4 w-full">
                        <Button className="flex-1" variant="danger" onClick={() => handleApprove(false)}>ไม่อนุมัติ</Button>
                        <Button className="flex-1" variant="success" onClick={() => handleApprove(true)}>อนุมัติการคืน</Button>
                    </div>
                )}
            >
                {selectedGroup && (
                    <div className="space-y-6">
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h4 className="font-bold mb-2 text-gray-900">ข้อมูลผู้คืน</h4>
                            <p className="text-sm text-gray-700">ชื่อ: {selectedGroup[0].userName}</p>
                            <p className="text-sm text-gray-700">อีเมล: {selectedGroup[0].userEmail}</p>
                            <p className="text-sm text-gray-700">เบอร์โทร: {selectedGroup[0].userPhone}</p>
                        </div>
                        <div>
                            <h4 className="font-bold mb-2 text-gray-900">รายการที่คืน ({selectedGroup.length})</h4>
                            <div className="space-y-2">
                                {groupedSelectedItems.map((g, idx) => (
                                    <div key={idx} className="flex items-center gap-3 border border-gray-200 p-2 rounded hover:bg-white">
                                        <img src={g.img} className="w-10 h-10 object-cover rounded" alt=""/>
                                        <div>
                                            <span className="text-sm font-medium text-gray-800 block">{g.name}</span>
                                            {g.count > 1 && <span className="text-xs text-gray-500">จำนวน {g.count} รายการ</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {selectedGroup[0].proofImageUrl && (
                            <div>
                                <h4 className="font-bold mb-2 text-gray-900">รูปหลักฐาน</h4>
                                <img src={selectedGroup[0].proofImageUrl} className="w-full max-h-60 object-contain bg-black rounded" alt="Proof" />
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
};

// Define History Group Structure
type HistoryGroup = {
    groupId: string;
    boxId: string;
    userId: string;
    recordIds: string[];
    status: RecordStatus;
    borrowedAt: string;
    daysBorrowed: number; // For Due Date Calculation
    userName: string;
    userEmail: string;
    returnedAt: string | null;
    records: Record[];
};

// Helper to compare string arrays
const arraysEqual = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every(v => setA.has(v));
};

// Helper to calculate due status text
const getDueStatus = (borrowedAtStr: string, daysBorrowed: number, status: string) => {
  if (status === 'returned') return null;

  const now = new Date();
  const borrowed = new Date(borrowedAtStr);
  const dueDate = new Date(borrowed.getTime() + daysBorrowed * 24 * 60 * 60 * 1000);

  // Reset time for date comparison
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDateDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

  const diffTime = dueDateDate.getTime() - todayDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    return { label: `อีก ${diffDays} วันถึงกำหนดคืน`, className: "text-gray-500" };
  } else if (diffDays === 0) {
    return { label: "ถึงกำหนดคืนวันนี้", className: "text-orange-600 font-bold" };
  } else {
    return { label: `เกินกำหนดคืน ${Math.abs(diffDays)} วันแล้ว`, className: "text-red-600 font-bold" };
  }
};

const HistoryView: React.FC<{ records: Record[], items: Item[], boxes: PopulatedBox[], onDeleteRecords?: (ids: string[]) => void }> = ({ records, items, boxes, onDeleteRecords }) => {
    // 1. Filter state using new statuses
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);
    
    // Grouping Logic Function
    const buildGroups = (recs: Record[]): HistoryGroup[] => {
        const groupMap: { [key: string]: Record[] } = {};
        recs.forEach(r => {
            // Group by User + Box + Borrow Date (approximate to grouping a single transaction)
            const key = `${r.userId}_${r.boxId}_${r.borrowedAt}`;
            if (!groupMap[key]) groupMap[key] = [];
            groupMap[key].push(r);
        });

        return Object.entries(groupMap).map(([key, groupRecords]) => {
            const first = groupRecords[0];
            // Determine representative status for the group
            let status: RecordStatus = 'borrowing';
            if (groupRecords.some(r => r.status === 'pendingReturn')) status = 'pendingReturn';
            else if (groupRecords.every(r => r.status === 'returned')) status = 'returned';

            return {
                groupId: key,
                boxId: first.boxId,
                userId: first.userId,
                recordIds: groupRecords.map(r => r.recordId),
                status: status,
                borrowedAt: first.borrowedAt,
                daysBorrowed: first.daysBorrowed,
                userName: first.userName,
                userEmail: first.userEmail,
                returnedAt: first.returnedAt,
                records: groupRecords
            };
        });
    };

    // Initialize/Sync groups when records prop changes
    const [groups, setGroups] = useState<HistoryGroup[]>([]);
    
    // State for Bulk Selection
    const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        setGroups(buildGroups(records));
        // Clear selection when records change to avoid stale IDs
        setSelectedGroupIds(new Set());
    }, [records]);


    // 2. Handle Status Change
    const handleStatusChange = async (recordIds: string[], newStatus: 'borrowing' | 'returned') => {
        console.log("handleStatusChange", recordIds, newStatus);
        try {
            setIsUpdating(true);
            
            // Backend Update
            await DB.adminBatchUpdateStatus(recordIds, newStatus);
            
            // Optimistic UI Update
            setGroups(prev => prev.map(g => {
                if (arraysEqual(g.recordIds, recordIds)) {
                    return { 
                        ...g, 
                        status: newStatus,
                        returnedAt: newStatus === 'returned' ? new Date().toISOString() : null 
                    };
                }
                return g;
            }));

        } catch (err) {
            console.error("Failed to update status", err);
        } finally {
            setIsUpdating(false);
        }
    };

    // Filtering Logic based on local groups state
    const filteredGroups = useMemo(() => {
        let result = groups;

        if (filterStatus !== 'all') {
            result = result.filter(g => g.status === filterStatus);
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(g => {
                const box = boxes.find(b => b.boxId === g.boxId);
                const itemNames = g.records.map(gr => items.find(i => i.itemName === gr.itemId)?.itemName || '').join(' ').toLowerCase();
                
                return (
                    g.userName.toLowerCase().includes(term) ||
                    g.userEmail.toLowerCase().includes(term) ||
                    (box?.boxName.toLowerCase().includes(term)) ||
                    itemNames.includes(term)
                );
            });
        }

        return result.sort((a,b) => new Date(b.borrowedAt).getTime() - new Date(a.borrowedAt).getTime());
    }, [groups, filterStatus, searchTerm, boxes, items]);

    // Bulk Selection Helpers
    const toggleSelectGroup = (groupId: string) => {
        const next = new Set(selectedGroupIds);
        if (next.has(groupId)) next.delete(groupId);
        else next.add(groupId);
        setSelectedGroupIds(next);
    };

    const toggleSelectAll = () => {
        const visibleIds = filteredGroups.map(g => g.groupId);
        // If all visible items are selected, deselect them. Otherwise, select all visible.
        const allVisibleSelected = visibleIds.every(id => selectedGroupIds.has(id));
        
        if (allVisibleSelected) {
            // Deselect visible
            const next = new Set(selectedGroupIds);
            visibleIds.forEach(id => next.delete(id));
            setSelectedGroupIds(next);
        } else {
            // Select all visible
            const next = new Set(selectedGroupIds);
            visibleIds.forEach(id => next.add(id));
            setSelectedGroupIds(next);
        }
    };
    
    // Header checkbox ref for indeterminate state
    const headerCheckboxRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (!headerCheckboxRef.current) return;
        const visibleIds = filteredGroups.map(g => g.groupId);
        if (visibleIds.length === 0) {
            headerCheckboxRef.current.checked = false;
            headerCheckboxRef.current.indeterminate = false;
            return;
        }
        
        const selectedVisibleCount = visibleIds.filter(id => selectedGroupIds.has(id)).length;
        
        if (selectedVisibleCount === 0) {
            headerCheckboxRef.current.checked = false;
            headerCheckboxRef.current.indeterminate = false;
        } else if (selectedVisibleCount === visibleIds.length) {
            headerCheckboxRef.current.checked = true;
            headerCheckboxRef.current.indeterminate = false;
        } else {
            headerCheckboxRef.current.checked = false;
            headerCheckboxRef.current.indeterminate = true;
        }
    }, [selectedGroupIds, filteredGroups]);

    // Delete Handlers
    const confirmDeleteSelected = () => {
        const allRecordIdsToDelete: string[] = [];
        selectedGroupIds.forEach(gid => {
            const group = groups.find(g => g.groupId === gid);
            if(group) {
                allRecordIdsToDelete.push(...group.recordIds);
            }
        });
        
        if (onDeleteRecords) {
            onDeleteRecords(allRecordIdsToDelete);
        } else {
            // Fallback (or legacy behavior) if prop not provided
            DB.adminDeleteRecords(allRecordIdsToDelete);
        }
        
        setSelectedGroupIds(new Set());
        setShowDeleteConfirm(false);
    };

    // Custom Checkbox Style
    const customCheckboxClass = "appearance-none h-5 w-5 rounded border border-gray-300 bg-white cursor-pointer transition-all checked:bg-gray-100 checked:border-gray-300 relative checked:after:content-[''] checked:after:absolute checked:after:top-1/2 checked:after:left-1/2 checked:after:-translate-x-1/2 checked:after:-translate-y-1/2 checked:after:w-2.5 checked:after:h-2.5 checked:after:rounded-sm checked:after:bg-primary indeterminate:bg-gray-100 indeterminate:border-gray-300 indeterminate:after:content-[''] indeterminate:after:absolute indeterminate:after:top-1/2 indeterminate:after:left-1/2 indeterminate:after:-translate-x-1/2 indeterminate:after:-translate-y-1/2 indeterminate:after:w-2.5 indeterminate:after:h-0.5 indeterminate:after:bg-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

    return (
        <div>
             <div className="mb-6 flex flex-col md:flex-row gap-4 items-end md:items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">ประวัติการยืม-คืนทั้งหมด</h2>
                
                {selectedGroupIds.size > 0 && (
                    <Button 
                        variant="danger" 
                        size="sm" 
                        onClick={() => setShowDeleteConfirm(true)}
                        className="animate-in fade-in"
                    >
                        <Trash className="w-4 h-4 mr-2" />
                        ลบที่เลือก ({selectedGroupIds.size} รายการ)
                    </Button>
                )}
             </div>

             <div className="bg-gray-50 p-4 rounded-lg mb-6 grid grid-cols-1 md:grid-cols-2 gap-4 border border-gray-100 items-start">
                <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">ค้นหา</label>
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="ชื่อผู้ยืม, ชื่อกล่อง..." 
                            className="w-full bg-gray-100 border border-gray-300 text-gray-900 placeholder:text-gray-500 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                    </div>
                </div>
                <div>
                    <Select 
                        label="สถานะ"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        options={[
                            { value: 'all', label: 'ทั้งหมด' },
                            { value: 'borrowing', label: 'กำลังยืมอยู่' },
                            { value: 'returned', label: 'คืนแล้ว' },
                            { value: 'pendingReturn', label: 'รออนุมัติ (ดูได้เท่านั้น)' },
                        ]}
                    />
                </div>
             </div>

             <div className="mb-4 text-sm font-medium text-gray-600">
                พบ {filteredGroups.length} รายการ (กล่อง)
             </div>

             <div className="overflow-x-auto border border-gray-200 rounded-lg">
                 <table className="w-full text-sm text-left">
                     <thead className="bg-gray-50 text-gray-900 font-semibold border-b border-gray-200">
                         <tr>
                             <th className="py-3 px-4 w-10 text-center">
                                 <input 
                                     type="checkbox" 
                                     ref={headerCheckboxRef}
                                     onChange={toggleSelectAll}
                                     className={customCheckboxClass}
                                 />
                             </th>
                             <th className="py-3 px-4">วันที่ยืม</th>
                             <th className="py-3 px-4">ผู้ยืม</th>
                             <th className="py-3 px-4">กล่อง/จำนวน</th>
                             <th className="py-3 px-4">สถานะ</th>
                             <th className="py-3 px-4">วันที่คืน</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100">
                         {filteredGroups.length === 0 ? (
                             <tr>
                                 <td colSpan={6} className="py-8 text-center text-gray-500">ไม่พบข้อมูลที่ค้นหา</td>
                             </tr>
                         ) : (
                             filteredGroups.map(group => {
                                 const box = boxes.find(b => b.boxId === group.boxId);
                                 const returnDate = group.returnedAt 
                                    ? new Date(group.returnedAt).toLocaleDateString('th-TH') 
                                    : '-';
                                 
                                 const selectValue = group.status === 'pendingReturn' ? 'borrowing' : group.status;
                                 const isPending = group.status === 'pendingReturn';
                                 const isSelected = selectedGroupIds.has(group.groupId);
                                 
                                 // Calculate Due Info
                                 const dueInfo = getDueStatus(group.borrowedAt, group.daysBorrowed, group.status);

                                 return (
                                    <tr 
                                        key={group.groupId} 
                                        className={`transition-colors ${isSelected ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`}
                                    >
                                        <td className="py-3 px-4 text-center">
                                            <input 
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelectGroup(group.groupId)}
                                                className={customCheckboxClass}
                                            />
                                        </td>
                                        <td className="py-3 px-4 text-gray-800">{new Date(group.borrowedAt).toLocaleDateString('th-TH')}</td>
                                        <td className="py-3 px-4">
                                            <div className="font-medium text-gray-900">{group.userName}</div>
                                            <div className="text-xs text-gray-500">{group.userEmail}</div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="font-medium text-gray-900">{box?.boxName || 'Unknown Box'}</div>
                                            <div className="text-xs text-gray-500">ของทั้งหมด {group.records.length} รายการ</div>
                                        </td>
                                        <td className="py-3 px-4">
                                            {isPending ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-50 text-orange-600 border border-orange-100">
                                                    รออนุมัติ
                                                </span>
                                            ) : (
                                                <div className="flex flex-col gap-1">
                                                    <div className="relative inline-block w-fit">
                                                        <select 
                                                            className={`appearance-none text-xs rounded-full pl-3 pr-8 py-1 font-bold focus:outline-none focus:ring-2 cursor-pointer ${
                                                                group.status === 'returned'
                                                                ? 'bg-green-100 text-green-800 border border-green-200 focus:ring-green-500' 
                                                                : 'bg-amber-100 text-amber-800 border border-amber-200 focus:ring-amber-500'
                                                            }`}
                                                            value={selectValue}
                                                            onChange={(e) => {
                                                                const val = e.target.value as 'borrowing' | 'returned';
                                                                const confirmMsg = val === 'returned' 
                                                                    ? 'ยืนยันเปลี่ยนสถานะเป็น "คืนแล้ว" ใช่หรือไม่?'
                                                                    : 'ยืนยันเปลี่ยนสถานะเป็น "กำลังยืมอยู่" ใช่หรือไม่?';

                                                                if (confirm(confirmMsg)) {
                                                                    handleStatusChange(group.recordIds, val);
                                                                }
                                                            }}
                                                            disabled={isUpdating}
                                                        >
                                                            <option value="borrowing">กำลังยืมอยู่</option>
                                                            <option value="returned">คืนแล้ว</option>
                                                        </select>
                                                        <div className={`pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 ${group.status === 'returned' ? 'text-green-800' : 'text-amber-800'}`}>
                                                            <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                                        </div>
                                                    </div>
                                                    {dueInfo && (
                                                        <div className={`text-xs ${dueInfo.className}`}>
                                                            {dueInfo.label}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-gray-800">{returnDate}</td>
                                    </tr>
                                 )
                             })
                         )}
                     </tbody>
                 </table>
            </div>

            {/* Bulk Delete Confirm Modal */}
            <Modal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                title="ยืนยันการลบรายการ"
                maxWidth="max-w-md"
                footer={
                    <div className="flex gap-3 w-full">
                        <Button variant="secondary" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>ยกเลิก</Button>
                        <Button variant="danger" className="flex-1" onClick={confirmDeleteSelected}>ลบที่เลือก</Button>
                    </div>
                }
            >
                <div className="text-center py-4">
                    <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle size={24} />
                    </div>
                    <p className="text-gray-800 font-bold mb-2">
                        ยืนยันการลบ {selectedGroupIds.size} รายการหรือไม่?
                    </p>
                    <p className="text-sm text-gray-600">
                        การลบนี้จะลบประวัติการยืม-คืนออกจากระบบอย่างถาวร หากมีรายการที่กำลังยืมอยู่ สถานะของสิ่งของจะถูกปรับเป็น "ว่าง" โดยอัตโนมัติ
                    </p>
                </div>
            </Modal>
        </div>
    )
}

export default AdminDashboard;
