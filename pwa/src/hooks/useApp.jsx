import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [toast, setToast] = useState({ message: '', isError: false, visible: false });
  const [loadingMsg, setLoadingMsg] = useState('');
  const [isManager, setIsManager] = useState(false);
  const [currentBranch, setCurrentBranch] = useState(null);
  const sessionTimerRef = useRef(null);

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('app-theme') || 'dark';
    document.documentElement.classList.toggle('light-theme', saved === 'light');
    return saved;
  });

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('app-theme', next);
      document.documentElement.classList.toggle('light-theme', next === 'light');
      return next;
    });
  }, []);

  // ── Toast ──
  const showToast = useCallback((message, isError = false) => {
    setToast({ message, isError, visible: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 3500);
  }, []);

  // ── Loading ──
  const showLoading = useCallback((msg = 'Loading...') => {
    setLoadingMsg(msg);
  }, []);

  const hideLoading = useCallback(() => {
    setLoadingMsg('');
  }, []);

  // ── Session Timer (15 min inactivity → logout) ──
  const resetSessionTimer = useCallback(() => {
    if (!isManager) return;
    clearTimeout(sessionTimerRef.current);
    sessionTimerRef.current = setTimeout(() => {
      showToast('Session expired due to inactivity', true);
      setIsManager(false);
    }, 15 * 60 * 1000);
  }, [isManager, showToast]);

  // ── Login / Logout ──
  const login = useCallback(() => {
    setIsManager(true);
    resetSessionTimer();
  }, [resetSessionTimer]);

  const logout = useCallback(() => {
    setIsManager(false);
    clearTimeout(sessionTimerRef.current);
    showToast('LOGGED OUT');
  }, [showToast]);

  return (
    <AppContext.Provider value={{
      toast,
      showToast,
      loadingMsg,
      showLoading,
      hideLoading,
      isManager,
      setIsManager,
      login,
      logout,
      currentBranch,
      setCurrentBranch,
      resetSessionTimer,
      theme,
      toggleTheme,
    }}>
      {children}
      {loadingMsg && (
        <div className="loading-overlay show">
          <div className="loader" style={{ width: 24, height: 24, borderWidth: 3, borderColor: 'var(--accent)', borderBottomColor: 'transparent' }} />
          <span>{loadingMsg}</span>
        </div>
      )}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
