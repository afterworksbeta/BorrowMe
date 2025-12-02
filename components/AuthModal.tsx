

import React, { useState } from 'react';
import { Modal, Input, Button, PasswordInput } from './Common';
import * as DB from '../services/db';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot-password'>('login');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (mode === 'login') {
      const { user, error: loginError } = await DB.loginUser(formData.email, formData.password);
      if (user) {
        onSuccess();
        setFormData({ email: '', password: '', name: '', phone: '' });
      } else {
        // Map common errors
        if (loginError?.includes('Invalid login credentials')) {
            setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
        } else if (loginError?.includes('Email not confirmed')) {
             setError('กรุณายืนยันอีเมลตรวจสอบ');
        } else if (loginError?.includes('profiles" table missing')) {
             setError('System Error: Database table missing (profiles)');
        } else {
            setError(loginError || 'เข้าสู่ระบบไม่สำเร็จ');
        }
      }
    } else if (mode === 'register') {
      // Validate
      if (!formData.name || !formData.email || !formData.password || !formData.phone) {
          setError('กรุณากรอกข้อมูลให้ครบถ้วน');
          setLoading(false);
          return;
      }

      if (formData.password.length < 6) {
          setError('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
          setLoading(false);
          return;
      }

      const { user, error: apiError } = await DB.registerUser({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        phone: formData.phone
      });

      if (user) {
        onSuccess();
        setFormData({ email: '', password: '', name: '', phone: '' });
      } else {
        // Robust error handling with case-insensitivity
        const errString = apiError?.toLowerCase() || '';
        
        if (errString.includes('password should be at least') || errString.includes('weak password')) {
             setError('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
        } else if (errString.includes('user already registered') || errString.includes('email already in use')) {
             setError('อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบ');
        } else if (errString.includes('profiles" table missing')) {
             setError('System Error: Database table missing (profiles)');
        } else {
             setError(apiError || 'เกิดข้อผิดพลาดในการสมัครสมาชิก');
        }
      }
    } else if (mode === 'forgot-password') {
        if (!formData.email) {
            setError('กรุณากรอกอีเมล');
            setLoading(false);
            return;
        }
        const { success, error: resetError } = await DB.resetPasswordEmail(formData.email);
        if (success) {
            alert('ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว กรุณาตรวจสอบ (หากไม่พบโปรดเช็คใน Junk/Spam)');
            setMode('login');
        } else {
            setError(resetError || 'ไม่สามารถส่งอีเมลรีเซ็ตได้');
        }
    }
    setLoading(false);
  };

  let modalTitle = 'เข้าสู่ระบบ';
  if (mode === 'register') modalTitle = 'สมัครสมาชิก';
  if (mode === 'forgot-password') modalTitle = 'ลืมรหัสผ่าน';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} zIndex="z-[60]">
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'forgot-password' ? (
             <>
                <p className="text-sm text-gray-600 mb-2">
                    กรุณากรอกอีเมลที่ลงทะเบียนไว้ ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้คุณ
                </p>
                <Input 
                  label="อีเมล" 
                  type="email" 
                  name="email" 
                  value={formData.email} 
                  onChange={handleChange} 
                  placeholder="email@example.com"
                />
             </>
        ) : (
            <>
                {mode === 'register' && (
                <>
                    <Input 
                    label="ชื่อ-นามสกุล" 
                    name="name" 
                    value={formData.name} 
                    onChange={handleChange} 
                    placeholder="สมชาย ใจดี"
                    />
                    <Input 
                    label="เบอร์โทรศัพท์" 
                    name="phone" 
                    value={formData.phone} 
                    onChange={handleChange} 
                    placeholder="08xxxxxxxx"
                    />
                </>
                )}
                <Input 
                label="อีเมล" 
                type="email" 
                name="email" 
                value={formData.email} 
                onChange={handleChange} 
                placeholder="email@example.com"
                />
                <PasswordInput 
                label="รหัสผ่าน" 
                name="password" 
                value={formData.password} 
                onChange={handleChange} 
                placeholder="********"
                />
                
                {mode === 'login' && (
                    <div className="flex justify-end -mt-3 mb-2">
                        <button 
                            type="button" 
                            onClick={() => { setMode('forgot-password'); setError(''); }}
                            className="text-xs text-primary hover:underline font-medium"
                        >
                            ลืมรหัสผ่าน?
                        </button>
                    </div>
                )}
            </>
        )}
        
        {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-xl text-sm font-medium flex flex-col items-center gap-1 animate-in fade-in slide-in-from-top-1">
                <p>{error}</p>
                {error.includes('เข้าสู่ระบบ') && (
                    <button 
                        type="button" 
                        onClick={() => setMode('login')}
                        className="text-primary hover:underline font-bold"
                    >
                        สลับไปหน้าเข้าสู่ระบบ
                    </button>
                )}
            </div>
        )}

        <Button type="submit" className="w-full" size="lg" isLoading={loading}>
          {mode === 'login' ? 'เข้าสู่ระบบ' : mode === 'register' ? 'สมัครสมาชิก' : 'ส่งลิงก์รีเซ็ตรหัสผ่าน'}
        </Button>

        <div className="text-center text-sm text-gray-600 mt-4">
          {mode === 'login' ? (
            <>
              ยังไม่มีบัญชี?{' '}
              <button type="button" onClick={() => setMode('register')} className="text-primary hover:underline font-medium">
                สมัครสมาชิก
              </button>
            </>
          ) : mode === 'register' ? (
            <>
              มีบัญชีอยู่แล้ว?{' '}
              <button type="button" onClick={() => setMode('login')} className="text-primary hover:underline font-medium">
                เข้าสู่ระบบ
              </button>
            </>
          ) : (
             <button type="button" onClick={() => setMode('login')} className="text-primary hover:underline font-medium">
                กลับไปหน้าเข้าสู่ระบบ
             </button>
          )}
        </div>
      </form>
    </Modal>
  );
};

export default AuthModal;