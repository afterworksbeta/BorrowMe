

import React, { useState, useEffect, useRef } from 'react';
import { Modal, Input, Button, Toggle, PasswordInput } from './Common';
import { User } from '../types';
import * as DB from '../services/db';
import { User as UserIcon, Shield, Settings, CheckCircle2, Upload, Trash2, UserPlus, Users, Search, Mail, AlertTriangle } from 'lucide-react';

type SettingsTab = 'profile' | 'security' | 'account' | 'admin' | 'users';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  initialTab?: SettingsTab;
  onLogout: () => void; // New prop for handling logout action
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, currentUser, initialTab = 'profile', onLogout }) => {
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
        maxWidth={activeTab === 'users' ? "max-w-4xl" : "max-w-2xl"}
    >
        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
            <TabBtn active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<UserIcon size={16} />} label="โปรไฟล์" />
            <TabBtn active={activeTab === 'security'} onClick={() => setActiveTab('security')} icon={<Shield size={16} />} label="ความปลอดภัย" />
            <TabBtn active={activeTab === 'account'} onClick={() => setActiveTab('account')} icon={<Settings size={16} />} label="บัญชี & ความเป็นส่วนตัว" />
            
            {currentUser.role === 'admin' && (
                <>
                    <TabBtn active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon={<UserPlus size={16} />} label="ผู้ดูแลระบบ" />
                    <TabBtn active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<Users size={16} />} label="จัดการผู้ใช้" />
                </>
            )}
        </div>

        {successMsg && (
            <div className="mb-4 bg-green-50 text-green-700 px-4 py-2 rounded-lg flex items-center gap-2 text-sm border border-green-200 animate-in fade-in">
                <CheckCircle2 size={16} /> {successMsg}
            </div>
        )}

        {activeTab === 'profile' && <ProfileTab user={currentUser} onSuccess={showSuccess} />}
        {activeTab === 'security' && <SecurityTab user={currentUser} onSuccess={showSuccess} />}
        {activeTab === 'account' && <AccountTab user={currentUser} onSuccess={showSuccess} onLogout={onLogout} />}
        {activeTab === 'admin' && currentUser.role === 'admin' && <AdminTab user={currentUser} onSuccess={showSuccess} />}
        {activeTab === 'users' && currentUser.role === 'admin' && <UsersManagementTab currentUser={currentUser} onSuccess={showSuccess} onLogout={onLogout} />}

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
    const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
    const [isUploading, setIsUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    // Sync state with props if user updates externally
    useEffect(() => {
        setAvatarUrl(user.avatarUrl);
    }, [user.avatarUrl]);

    // 2. Validation Logic
    const isProfileValid = name.trim().length > 0 && phone.trim().length > 0;

    const handleSave = async () => {
        if (!isProfileValid) return;
        setIsSaving(true);

        await DB.updateUserProfile(user.userId, { 
            name, 
            phone
        });
        
        setIsSaving(false);
        onSuccess('บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว');
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            // Optimistic Preview
            const previewUrl = URL.createObjectURL(file);
            setAvatarUrl(previewUrl);
            setIsUploading(true);
            
            const uploadedUrl = await DB.uploadFile(file, 'avatars');
            if (uploadedUrl) {
                await DB.updateUserProfile(user.userId, { avatarUrl: uploadedUrl });
                setAvatarUrl(uploadedUrl); // Update with real URL
                onSuccess('อัปโหลดรูปโปรไฟล์เรียบร้อยแล้ว');
            }
            setIsUploading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col items-center mb-6">
                <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
                    {avatarUrl ? (
                         <div className="relative w-24 h-24 mb-3">
                            <img 
                                src={avatarUrl} 
                                className="w-full h-full rounded-full object-cover shadow-md ring-4 ring-white" 
                                alt={user.name} 
                                onError={(e) => {
                                    // Fallback to initials if image load fails
                                    e.currentTarget.style.display = 'none';
                                    const fallback = document.getElementById('avatar-fallback');
                                    if(fallback) fallback.style.display = 'flex';
                                }}
                            />
                            {/* Loading Spinner Overlay */}
                            {isUploading && (
                                <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center">
                                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}
                            {/* Fallback Element (Hidden by default) */}
                            <div 
                                id="avatar-fallback"
                                className="hidden absolute inset-0 bg-primary text-white rounded-full items-center justify-center text-3xl font-bold shadow-md ring-4 ring-white"
                            >
                                {name.charAt(0).toUpperCase()}
                            </div>
                         </div>
                    ) : (
                        <div className="w-24 h-24 bg-primary text-white rounded-full flex items-center justify-center text-3xl font-bold shadow-md mb-3 ring-4 ring-white relative">
                            {name.charAt(0).toUpperCase()}
                            {isUploading && (
                                <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center">
                                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}
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
    // Removed 'current' from state since UI doesn't use it
    const [pwdData, setPwdData] = useState({ new: '', confirm: '' });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleChangePassword = async () => {
        setError('');
        // Removed validation for 'current'
        if (!pwdData.new || !pwdData.confirm) {
            setError('กรุณากรอกข้อมูลให้ครบถ้วน');
            return;
        }
        if (pwdData.new !== pwdData.confirm) {
            setError('รหัสผ่านใหม่ไม่ตรงกัน');
            return;
        }
        if (pwdData.new.length < 6) {
            setError('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
            return;
        }

        setIsLoading(true);
        // Pass dummy string for oldPass since we don't verify it in this simple flow
        const success = await DB.changePassword(user.userId, '', pwdData.new);
        setIsLoading(false);
        if (success) {
            onSuccess('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว');
            setPwdData({ new: '', confirm: '' });
        } else {
            setError('เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน');
        }
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
                {/* Note: Current password verification not strictly enforced in basic supabase client update, assumes logged in */}
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

    const handleCreateAdmin = async () => {
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
        const result = await DB.adminCreateAdminUser(user.userId, {
            name: newAdmin.name,
            phone: newAdmin.phone,
            email: newAdmin.email,
            password: newAdmin.password
        });

        setIsCreatingAdmin(false);

        if (result.success) {
            onSuccess(result.message || 'สร้างบัญชีแอดมินใหม่เรียบร้อยแล้ว');
            setNewAdmin({ name: '', phone: '', email: '', password: '', confirm: '' });
        } else {
            setAdminError(result.message || 'เกิดข้อผิดพลาด');
        }
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
                    
                    {adminError && (
                        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                            <AlertTriangle size={18} className="flex-shrink-0" />
                            {adminError}
                        </div>
                    )}
                    
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

const UsersManagementTab = ({ currentUser, onSuccess, onLogout }: { currentUser: User, onSuccess: (msg: string) => void, onLogout: () => void }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
    const [loading, setLoading] = useState(true);

    // Message Modal State
    const [msgModalUser, setMsgModalUser] = useState<User | null>(null);
    const [msgSubject, setMsgSubject] = useState('');
    const [msgBody, setMsgBody] = useState('');

    // Delete Modal State
    const [deleteModalUser, setDeleteModalUser] = useState<User | null>(null);
    const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

    useEffect(() => {
        DB.getAllUsers().then(data => {
            setUsers(data);
            setLoading(false);
        });
    }, []);

    const filteredUsers = users.filter(u => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
        const matchesRole = roleFilter === 'all' || u.role === roleFilter;
        
        // Hide the current user from the list
        if (u.userId === currentUser.userId) return false;

        return matchesSearch && matchesRole;
    });

    const handleSendMessage = async () => {
        if (!msgModalUser) return;
        await DB.adminSendUserMessage(msgModalUser.userId, msgSubject, msgBody);
        onSuccess(`ส่งข้อความถึง ${msgModalUser.name} แล้ว`);
        setMsgModalUser(null);
        setMsgSubject('');
        setMsgBody('');
    };

    const handleDeleteUser = async () => {
        if (!deleteModalUser) return;
        const result = await DB.adminDeleteUser(currentUser.userId, deleteModalUser.userId);
        if (result.success) {
            // Check if admin accidentally deleted themselves via logic (though filtered out in list)
            if (deleteModalUser.userId === currentUser.userId) {
                onLogout();
            } else {
                setUsers(prev => prev.filter(u => u.userId !== deleteModalUser.userId));
                onSuccess(`ลบบัญชี ${deleteModalUser.name} เรียบร้อยแล้ว`);
            }
        } else {
            alert(result.message || 'ไม่สามารถลบบัญชีนี้ได้');
        }
        setDeleteModalUser(null);
        setDeleteConfirmInput('');
    };

    return (
        <div>
             <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
                 <div>
                    <h4 className="font-bold text-gray-900 flex items-center gap-2">
                        <Users size={18} /> จัดการผู้ใช้ทั้งหมด
                    </h4>
                    <p className="text-sm text-gray-500">รายชื่อผู้ใช้ทั้งหมดในระบบ ({users.length} คน)</p>
                 </div>
                 
                 <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    {/* Role Filter */}
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button 
                            onClick={() => setRoleFilter('all')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${roleFilter === 'all' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            ทั้งหมด
                        </button>
                        <button 
                            onClick={() => setRoleFilter('admin')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${roleFilter === 'admin' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            Admin
                        </button>
                        <button 
                            onClick={() => setRoleFilter('user')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${roleFilter === 'user' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            User
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative w-full sm:w-64">
                        <input 
                            type="text" 
                            placeholder="ค้นหาชื่อหรืออีเมล..." 
                            className="w-full bg-gray-100 border border-gray-300 text-gray-900 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    </div>
                 </div>
             </div>

             <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-900 font-semibold border-b border-gray-200">
                        <tr>
                            <th className="py-3 px-4">ชื่อผู้ใช้</th>
                            <th className="py-3 px-4">บทบาท</th>
                            <th className="py-3 px-4">วันที่สมัคร</th>
                            <th className="py-3 px-4 text-right">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr><td colSpan={4} className="p-4 text-center">กำลังโหลด...</td></tr>
                        ) : filteredUsers.length === 0 ? (
                            <tr><td colSpan={4} className="p-4 text-center text-gray-500">ไม่พบผู้ใช้ที่ค้นหา</td></tr>
                        ) : (
                            filteredUsers.map(u => {
                                const isMainAdminTarget = u.email === 'admin@example.com';
                                const isCurrentMainAdmin = currentUser.email === 'admin@example.com';
                                const canDelete = !isMainAdminTarget || isCurrentMainAdmin;

                                return (
                                <tr key={u.userId} className="hover:bg-gray-50 group">
                                    <td className="py-3 px-4">
                                        <div className="font-medium text-gray-900">{u.name}</div>
                                        <div className="text-xs text-gray-500">{u.email}</div>
                                        {u.phone && <div className="text-xs text-gray-400">{u.phone}</div>}
                                    </td>
                                    <td className="py-3 px-4">
                                        {u.role === 'admin' ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                                                Admin
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                                                User
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-3 px-4 text-gray-500">
                                        {new Date(u.createdAt).toLocaleDateString('th-TH')}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <div className="flex justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button 
                                                size="sm" 
                                                variant="secondary" 
                                                onClick={() => setMsgModalUser(u)}
                                                title="ส่งข้อความ"
                                                className="px-2"
                                            >
                                                <Mail size={14} />
                                            </Button>
                                            
                                            {canDelete ? (
                                                <Button 
                                                    size="sm" 
                                                    variant="danger" 
                                                    onClick={() => setDeleteModalUser(u)}
                                                    title="ลบบัญชี"
                                                    className="px-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                                                >
                                                    <Trash2 size={14} />
                                                </Button>
                                            ) : (
                                                <div className="px-2 py-1.5 opacity-30 cursor-not-allowed" title="ลบผู้ดูแลระบบหลักไม่ได้">
                                                    <Trash2 size={14} className="text-gray-400" />
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )})
                        )}
                    </tbody>
                </table>
             </div>

             {/* Message Modal */}
             <Modal
                isOpen={!!msgModalUser}
                onClose={() => setMsgModalUser(null)}
                title={`ส่งข้อความถึง ${msgModalUser?.name}`}
                maxWidth="max-w-md"
                footer={
                    <div className="flex gap-3 w-full">
                        <Button variant="secondary" className="flex-1" onClick={() => setMsgModalUser(null)}>ยกเลิก</Button>
                        <Button className="flex-1" onClick={handleSendMessage} disabled={!msgSubject || !msgBody}>ส่งข้อความ</Button>
                    </div>
                }
             >
                <div className="space-y-4">
                    <Input 
                        label="หัวข้อ"
                        value={msgSubject}
                        onChange={(e) => setMsgSubject(e.target.value)}
                        placeholder="เช่น แจ้งเตือนการคืนของ"
                    />
                    <div>
                        <label className="block text-sm font-medium text-gray-800 mb-1">ข้อความ</label>
                        <textarea 
                            className="w-full bg-gray-100 border border-gray-300 text-gray-900 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all min-h-[100px]"
                            value={msgBody}
                            onChange={(e) => setMsgBody(e.target.value)}
                            placeholder="รายละเอียดข้อความ..."
                        />
                    </div>
                    <p className="text-xs text-gray-500">
                        * ระบบจะส่งอีเมลไปยัง {msgModalUser?.email}
                    </p>
                </div>
             </Modal>

             {/* Delete Modal */}
             <Modal
                isOpen={!!deleteModalUser}
                onClose={() => { setDeleteModalUser(null); setDeleteConfirmInput(''); }}
                title="ยืนยันการลบบัญชี"
                maxWidth="max-w-md"
                footer={
                    <div className="flex gap-3 w-full">
                        <Button variant="secondary" className="flex-1" onClick={() => { setDeleteModalUser(null); setDeleteConfirmInput(''); }}>ยกเลิก</Button>
                        <Button 
                            variant="danger" 
                            className="flex-1" 
                            onClick={handleDeleteUser}
                            disabled={deleteConfirmInput !== 'DELETE'}
                        >
                            ยืนยันลบ
                        </Button>
                    </div>
                }
             >
                <div className="text-center py-4">
                    <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle size={24} />
                    </div>
                    <h4 className="font-bold text-gray-900 mb-2">คุณต้องการลบบัญชี "{deleteModalUser?.name}" ใช่หรือไม่?</h4>
                    <p className="text-sm text-gray-600 mb-4">
                        การดำเนินการนี้ไม่สามารถย้อนกลับได้ ประวัติการใช้งานของผู้ใช้นี้อาจได้รับผลกระทบ
                    </p>
                    <div className="text-left">
                        <label className="block text-xs font-bold text-gray-700 mb-1">พิมพ์คำว่า "DELETE" เพื่อยืนยัน</label>
                        <input 
                             className="w-full border border-red-300 bg-white text-gray-900 rounded-lg p-2 focus:ring-2 focus:ring-red-500 focus:outline-none"
                             value={deleteConfirmInput}
                             onChange={(e) => setDeleteConfirmInput(e.target.value)}
                             placeholder="DELETE"
                        />
                    </div>
                </div>
             </Modal>
        </div>
    );
};

const AccountTab = ({ user, onSuccess, onLogout }: { user: User, onSuccess: (msg: string) => void, onLogout: () => void }) => {
    const [notif, setNotif] = useState({
        borrow: user.notifyOnBorrow ?? true,
        return: user.notifyOnReturn ?? true,
        rejected: user.notifyOnRejected ?? true
    });
    
    // Delete Account State
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteInput, setDeleteInput] = useState('');

    const updateNotif = async (key: keyof typeof notif, val: boolean) => {
        const newNotif = { ...notif, [key]: val };
        setNotif(newNotif);
        // Map to DB fields
        await DB.updateUserProfile(user.userId, {
            notifyOnBorrow: newNotif.borrow,
            notifyOnReturn: newNotif.return,
            notifyOnRejected: newNotif.rejected
        });
    };

    const handleConfirmDelete = async () => {
        if (deleteInput === 'delete') {
            await DB.deleteAccount(user.userId);
            // Replace reload with app-level logout for smoother UX
            onLogout();
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
                    <label className="text-xs font-bold text-red-700 mb-1 block">
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
