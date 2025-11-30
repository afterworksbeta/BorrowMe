
import React, { useState, useEffect, useRef } from 'react';
import { Modal, Input, Button, Toggle, PasswordInput } from './Common';
import { User } from '../types';
import * as DB from '../services/db';
import { User as UserIcon, Shield, Settings, CheckCircle2, Upload, Trash2, UserPlus, Users } from 'lucide-react';

type SettingsTab = 'profile' | 'security' | 'account' | 'admin';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  initialTab?: SettingsTab;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, currentUser, initialTab = 'profile' }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync activeTab with initialTab when isOpen becomes true or initialTab changes
  useEffect(() => {
    if (isOpen) {
        setActiveTab(initialTab);
        setSuccessMsg(null);
    }
  }, [isOpen, initialTab]);

  const showSuccess = (msg: string) => {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title="ตั้งค่าโปรไฟล์" 
        maxWidth="max-w-2xl"
    >
        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
            <TabBtn active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<UserIcon size={16} />} label="โปรไฟล์" />
            <TabBtn active={activeTab === 'security'} onClick={() => setActiveTab('security')} icon={<Shield size={16} />} label="ความปลอดภัย" />
            <TabBtn active={activeTab === 'account'} onClick={() => setActiveTab('account')} icon={<Settings size={16} />} label="บัญชี & ความเป็นส่วนตัว" />
            
            {currentUser.role === 'admin' && (
                <TabBtn active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon={<Users size={16} />} label="ผู้ดูแลระบบ" />
            )}
        </div>

        {successMsg && (
            <div className="mb-4 bg-green-50 text-green-700 px-4 py-2 rounded-lg flex items-center gap-2 text-sm border border-green-200 animate-in fade-in">
                <CheckCircle2 size={16} /> {successMsg}
            </div>
        )}

        {activeTab === 'profile' && <ProfileTab user={currentUser} onSuccess={showSuccess} />}
        {activeTab === 'security' && <SecurityTab user={currentUser} onSuccess={showSuccess} />}
        {activeTab === 'account' && <AccountTab user={currentUser} onSuccess={showSuccess} />}
        {activeTab === 'admin' && currentUser.role === 'admin' && <AdminTab user={currentUser} onSuccess={showSuccess} />}

    </Modal>
  );
};

const TabBtn = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            active 
            ? 'border-primary text-primary' 
            : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
        }`}
    >
        {icon} {label}
    </button>
);

const ProfileTab = ({ user, onSuccess }: { user: User, onSuccess: (msg: string) => void }) => {
    // 1. Local State for Form Fields
    const [name, setName] = useState(user.name);
    const [phone, setPhone] = useState(user.phone);
    const [isSaving, setIsSaving] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    // 2. Validation Logic
    const isProfileValid = name.trim().length > 0 && phone.trim().length > 0;

    const handleSave = () => {
        if (!isProfileValid) return;
        setIsSaving(true);

        setTimeout(() => {
            DB.updateUserProfile(user.userId, { 
                name, 
                phone
            });
            setIsSaving(false);
            onSuccess('บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว');
        }, 500);
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const mockUrl = URL.createObjectURL(file); 
            DB.updateUserProfile(user.userId, { avatarUrl: mockUrl });
            onSuccess('อัปโหลดรูปโปรไฟล์เรียบร้อยแล้ว');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col items-center mb-6">
                <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
                    {user.avatarUrl ? (
                         <img 
                            src={user.avatarUrl} 
                            className="w-24 h-24 rounded-full object-cover shadow-md mb-3 ring-4 ring-white" 
                            alt={user.name} 
                         />
                    ) : (
                        <div className="w-24 h-24 bg-primary text-white rounded-full flex items-center justify-center text-3xl font-bold shadow-md mb-3 ring-4 ring-white">
                            {name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity mb-3">
                        <Upload className="text-white w-8 h-8" />
                    </div>
                </div>
                <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
                <button onClick={() => fileRef.current?.click()} className="text-sm text-primary font-medium hover:underline">เปลี่ยนรูปโปรไฟล์</button>
            </div>
            
            <div className="space-y-4">
                <Input 
                    label="ชื่อ-นามสกุล" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                />
                <Input 
                    label="เบอร์โทรศัพท์" 
                    value={phone} 
                    onChange={e => setPhone(e.target.value)} 
                />
                <Input 
                    label="อีเมล (เปลี่ยนไม่ได้)" 
                    value={user.email} 
                    disabled 
                    className="opacity-70 cursor-not-allowed" 
                />
            </div>

            <div className="pt-2">
                <Button 
                    onClick={handleSave} 
                    className="w-full"
                    disabled={!isProfileValid || isSaving}
                    isLoading={isSaving}
                >
                    บันทึกข้อมูลส่วนตัว
                </Button>
            </div>
        </div>
    );
};

const SecurityTab = ({ user, onSuccess }: { user: User, onSuccess: (msg: string) => void }) => {
    const [pwdData, setPwdData] = useState({ current: '', new: '', confirm: '' });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleChangePassword = () => {
        setError('');
        if (!pwdData.current || !pwdData.new || !pwdData.confirm) {
            setError('กรุณากรอกข้อมูลให้ครบถ้วน');
            return;
        }
        if (pwdData.new !== pwdData.confirm) {
            setError('รหัสผ่านใหม่ไม่ตรงกัน');
            return;
        }

        setIsLoading(true);
        setTimeout(() => {
            const success = DB.changePassword(user.userId, pwdData.current, pwdData.new);
            setIsLoading(false);
            if (success) {
                onSuccess('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว');
                setPwdData({ current: '', new: '', confirm: '' });
            } else {
                setError('รหัสผ่านปัจจุบันไม่ถูกต้อง');
            }
        }, 500);
    };

    return (
        <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                    <h4 className="text-sm font-bold text-blue-900">สถานะความปลอดภัย</h4>
                    <ul className="mt-1 text-xs text-blue-800 list-disc list-inside">
                        <li>อีเมลยืนยันแล้ว</li>
                        <li>แนะนำให้ใช้รหัสผ่านที่คาดเดายาก</li>
                    </ul>
                </div>
            </div>

            <div className="space-y-4 border-b border-gray-100 pb-6">
                <h4 className="font-bold text-gray-900">เปลี่ยนรหัสผ่าน</h4>
                <PasswordInput 
                    label="รหัสผ่านปัจจุบัน" 
                    value={pwdData.current} 
                    onChange={e => setPwdData({...pwdData, current: e.target.value})}
                />
                <PasswordInput 
                    label="รหัสผ่านใหม่" 
                    value={pwdData.new}
                    onChange={e => setPwdData({...pwdData, new: e.target.value})}
                />
                <PasswordInput 
                    label="ยืนยันรหัสผ่านใหม่" 
                    value={pwdData.confirm}
                    onChange={e => setPwdData({...pwdData, confirm: e.target.value})}
                />
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <Button onClick={handleChangePassword} variant="outline" className="w-full" isLoading={isLoading}>อัปเดตรหัสผ่าน</Button>
            </div>
        </div>
    );
};

const AdminTab = ({ user, onSuccess }: { user: User, onSuccess: (msg: string) => void }) => {
    // Create Admin State
    const [newAdmin, setNewAdmin] = useState({
        name: '', phone: '', email: '', password: '', confirm: ''
    });
    const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);
    const [adminError, setAdminError] = useState('');

    const handleCreateAdmin = () => {
        setAdminError('');
        if (!newAdmin.name || !newAdmin.email || !newAdmin.password || !newAdmin.confirm) {
            setAdminError('กรุณากรอกข้อมูลให้ครบถ้วน');
            return;
        }
        if (newAdmin.password !== newAdmin.confirm) {
            setAdminError('รหัสผ่านไม่ตรงกัน');
            return;
        }

        setIsCreatingAdmin(true);
        setTimeout(() => {
            const result = DB.adminCreateAdminUser(user.userId, {
                name: newAdmin.name,
                phone: newAdmin.phone,
                email: newAdmin.email,
                password: newAdmin.password
            });

            setIsCreatingAdmin(false);

            if (result.success) {
                onSuccess('สร้างบัญชีแอดมินใหม่เรียบร้อยแล้ว');
                setNewAdmin({ name: '', phone: '', email: '', password: '', confirm: '' });
            } else {
                setAdminError(result.message || 'เกิดข้อผิดพลาด');
            }
        }, 500);
    };

    return (
        <div className="space-y-6">
            <div>
                <div className="flex items-center gap-2 border-b border-gray-100 pb-2 mb-4">
                    <UserPlus size={18} className="text-gray-900" />
                    <h4 className="font-bold text-gray-900">จัดการผู้ดูแลระบบ</h4>
                </div>
                <p className="text-xs text-gray-500 mb-4">สร้างบัญชีผู้ดูแลระบบใหม่สำหรับทีมของคุณ</p>
                
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input 
                            label="ชื่อ-นามสกุล" 
                            value={newAdmin.name} 
                            onChange={e => setNewAdmin({...newAdmin, name: e.target.value})}
                            placeholder="Admin Name"
                        />
                        <Input 
                            label="เบอร์โทรศัพท์" 
                            value={newAdmin.phone} 
                            onChange={e => setNewAdmin({...newAdmin, phone: e.target.value})}
                            placeholder="08xxxxxxxx"
                        />
                    </div>
                    <Input 
                        label="อีเมล" 
                        type="email"
                        value={newAdmin.email} 
                        onChange={e => setNewAdmin({...newAdmin, email: e.target.value})}
                        placeholder="admin@example.com"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <PasswordInput 
                            label="รหัสผ่านเริ่มต้น" 
                            value={newAdmin.password} 
                            onChange={e => setNewAdmin({...newAdmin, password: e.target.value})}
                        />
                        <PasswordInput 
                            label="ยืนยันรหัสผ่าน" 
                            value={newAdmin.confirm} 
                            onChange={e => setNewAdmin({...newAdmin, confirm: e.target.value})}
                        />
                    </div>
                    
                    {adminError && <p className="text-red-500 text-sm">{adminError}</p>}
                    
                    <Button 
                        className="w-full" 
                        onClick={handleCreateAdmin}
                        isLoading={isCreatingAdmin}
                    >
                        สร้างบัญชี Admin ใหม่
                    </Button>
                </div>
            </div>
        </div>
    );
};

const AccountTab = ({ user, onSuccess }: { user: User, onSuccess: (msg: string) => void }) => {
    const [notif, setNotif] = useState({
        borrow: user.notifyOnBorrow ?? true,
        return: user.notifyOnReturn ?? true,
        rejected: user.notifyOnRejected ?? true
    });
    
    // Delete Account State
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteInput, setDeleteInput] = useState('');

    const updateNotif = (key: keyof typeof notif, val: boolean) => {
        const newNotif = { ...notif, [key]: val };
        setNotif(newNotif);
        // Map to DB fields
        DB.updateUserProfile(user.userId, {
            notifyOnBorrow: newNotif.borrow,
            notifyOnReturn: newNotif.return,
            notifyOnRejected: newNotif.rejected
        });
    };

    const handleConfirmDelete = () => {
        if (deleteInput === 'delete') {
            DB.deleteAccount(user.userId);
            // Wait a tick then reload to guest mode
            setTimeout(() => {
                window.location.reload();
            }, 500);
        }
    };

    if (showDeleteConfirm) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center animate-in fade-in zoom-in-95">
                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trash2 size={24} />
                </div>
                <h4 className="text-lg font-bold text-red-900 mb-2">ยืนยันการลบบัญชี</h4>
                <p className="text-sm text-red-800 mb-4">
                    คุณกำลังจะลบบัญชีนี้ถาวร ข้อมูลประวัติการยืม–คืนและข้อมูลส่วนบุคคลอาจถูกลบตามนโยบายระบบ และไม่สามารถกู้คืนได้
                </p>
                <div className="mb-4 text-left">
                    <label className="text-xs font-bold text-red-700 uppercase mb-1 block">
                        พิมพ์คำว่า "delete" เพื่อยืนยัน
                    </label>
                    <input 
                        className="w-full border border-red-300 bg-white text-gray-900 rounded-lg p-2 focus:ring-2 focus:ring-red-500 focus:outline-none"
                        value={deleteInput}
                        onChange={(e) => setDeleteInput(e.target.value)}
                        placeholder="delete"
                    />
                </div>
                <div className="flex gap-3">
                    <Button variant="secondary" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>ยกเลิก</Button>
                    <Button 
                        variant="danger" 
                        className="flex-1" 
                        disabled={deleteInput !== 'delete'}
                        onClick={handleConfirmDelete}
                    >
                        ยืนยันการลบบัญชี
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h4 className="font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">การแจ้งเตือน</h4>
                <div className="space-y-1">
                    <Toggle 
                        label="แจ้งเตือนเมื่อยืมของสำเร็จ" 
                        checked={notif.borrow} 
                        onChange={v => updateNotif('borrow', v)} 
                    />
                    <Toggle 
                        label="แจ้งเตือนเมื่ออนุมัติคืนของแล้ว" 
                        checked={notif.return} 
                        onChange={v => updateNotif('return', v)} 
                    />
                    <Toggle 
                        label="แจ้งเตือนเมื่อคำขอคืนถูกไม่อนุมัติ" 
                        checked={notif.rejected} 
                        onChange={v => updateNotif('rejected', v)} 
                    />
                </div>
            </div>

            <div className="opacity-50 pointer-events-none">
                 {/* Placeholder for Email Management */}
                <h4 className="font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">จัดการอีเมล (เร็วๆ นี้)</h4>
                <div className="flex justify-between items-center bg-gray-50 p-3 rounded">
                    <span className="text-sm text-gray-700">{user.email}</span>
                    <Button size="sm" variant="outline">เปลี่ยนอีเมล</Button>
                </div>
            </div>

            <div>
                <h4 className="font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2 text-red-600">โซนอันตราย</h4>
                <div className="space-y-3">
                    <Button variant="danger" className="w-full" onClick={() => setShowDeleteConfirm(true)}>ลบบัญชีนี้ถาวร</Button>
                    <p className="text-xs text-gray-500">
                        การลบบัญชีจะทำให้ประวัติการใช้งานและข้อมูลส่วนตัวของคุณถูกลบออกจากระบบอย่างถาวร ไม่สามารถกู้คืนได้
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
