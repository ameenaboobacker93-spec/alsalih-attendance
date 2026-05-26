import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { BranchProvider } from './hooks/useBranch';
import { AppProvider } from './hooks/useApp';
import ErrorBoundary from './components/ErrorBoundary';
import BranchSelector from './screens/BranchSelector';
import Portal from './screens/Portal';
import Toast from './components/Toast';

export default function App() {
  return (
    <ErrorBoundary>
      <BranchProvider>
        <AppProvider>
          <Toast />
          <Routes>
            <Route path="/" element={<BranchSelector />} />
            <Route path="/portal/:branchCode" element={<Portal />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppProvider>
      </BranchProvider>
    </ErrorBoundary>
  );
}
