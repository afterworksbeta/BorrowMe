
import React, { useState } from 'react';
import { Modal, Input, Button, PasswordInput } from './Common';
import * as DB from '../services/db';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: ''
  });
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      const user = DB.loginUser(formData.email, formData.password);
      if (user) {
        onSuccess();
        setFormData({ email: '', password: '', name: '', phone: '' });
      } else {
        setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      }
    } else {
      // Validate
      if (!formData.name || !formData.email || !formData.password || !formData.phone) {
          setError('กรุณากรอกข้อมูลให้ครบถ้วน');
          return;
      }
      const user = DB.registerUser({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        phone: formData.phone
      });
      if (user) {
        onSuccess();
        setFormData({ email: '', password: '', name: '', phone: '' });
      } else {
        setError('อีเมลนี้ถูกใช้งานแล้ว');
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={mode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'} zIndex="z-[60]">
      <form onSubmit={handleSubmit} className="space-y-4">
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
        
        {error && <p className="text-red-500 text-sm">{error}</p>}

        <Button type="submit" className="w-full" size="lg">
          {mode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
        </Button>

        <div className="text-center text-sm text-gray-600 mt-4">
          {mode === 'login' ? (
            <>
              ยังไม่มีบัญชี?{' '}
              <button type="button" onClick={() => setMode('register')} className="text-primary hover:underline font-medium">
                สมัครสมาชิก
              </button>
            </>
          ) : (
            <>
              มีบัญชีอยู่แล้ว?{' '}
              <button type="button" onClick={() => setMode('login')} className="text-primary hover:underline font-medium">
                เข้าสู่ระบบ
              </button>
            </>
          )}
        </div>
      </form>
    </Modal>
  );
};

export default AuthModal;
