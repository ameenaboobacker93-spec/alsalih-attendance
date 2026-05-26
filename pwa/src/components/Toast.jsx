import React from 'react';
import { useApp } from '../hooks/useApp';

export default function Toast() {
  const { toast } = useApp();

  return (
    <div className={`toast ${toast.visible ? 'show' : ''} ${toast.isError ? 'error' : ''}`}>
      {toast.isError ? '⚠️ ' : '✅ '}{toast.message}
    </div>
  );
}
