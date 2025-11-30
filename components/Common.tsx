import React, { useState } from 'react';
import { LucideIcon, Eye, EyeOff } from 'lucide-react';

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
    available: "ว่าง",
    
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