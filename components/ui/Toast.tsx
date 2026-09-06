'use client';

import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  isOpen: boolean;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, isOpen, onClose, duration = 3000 }) => {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-[#1F232C] text-[#F2F3F5] text-sm font-medium border border-[#2A2F3A] shadow-xl flex items-center gap-2 animate-bounce">
      <span className="w-2 h-2 rounded-full bg-[#7C5CFC]" />
      <span>{message}</span>
    </div>
  );
};
