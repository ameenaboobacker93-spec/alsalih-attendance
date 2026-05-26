import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBranch } from '../hooks/useBranch';
import { useApp } from '../hooks/useApp';
import { useStaffApi } from '../hooks/useStaffApi';
import PullToRefresh from '../components/PullToRefresh';
import Terminal from './Terminal';
import Dashboard from './Dashboard';
import AdminPanel from './AdminPanel';
import DutyRoster from './DutyRoster';

export default function Portal() {
  const { branchCode } = useParams();
  const navigate = useNavigate();
  const { branches, setSelectedBranch } = useBranch();
  const { showToast, isManager, login, logout } = useApp();
  const [branch, setBranch] = useState(null);
  const [activeTab, setActiveTab] = useState('terminal');
  const [swipeDir, setSwipeDir] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = useCallback(async () => {
    setRefreshKey(k => k + 1);
  }, []);

  // ── Swipe to switch tabs (native passive listeners — no scroll blocking) ──
  const touchSwipeRef = useRef({ startX: 0, startY: 0 });
  const tabContentRef = useRef(null);
  const tabOrder = useMemo(() => [
    'terminal',
    'dashboard',
    'roster',
    ...(isManager ? ['admin'] : []),
  ], [isManager]);

  // Attach native passive touch listeners for swipe detection
  useEffect(() => {
    const el = tabContentRef.current;
    if (!el) return;

    const swipe = touchSwipeRef.current;

    const onTouchStart = (e) => {
      swipe.startX = e.touches[0].clientX;
      swipe.startY = e.touches[0].clientY;
    };

    const onTouchEnd = (e) => {
      const dx = e.changedTouches[0].clientX - swipe.startX;
      const dy = e.changedTouches[0].clientY - swipe.startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx > 60 && absDx > absDy * 1.5) {
        const currentIdx = tabOrder.indexOf(activeTab);
        if (dx < 0 && currentIdx < tabOrder.length - 1) {
          setSwipeDir('left');
          setTimeout(() => {
            setActiveTab(tabOrder[currentIdx + 1]);
            setSwipeDir(null);
          }, 50);
        } else if (dx > 0 && currentIdx > 0) {
          setSwipeDir('right');
          setTimeout(() => {
            setActiveTab(tabOrder[currentIdx - 1]);
            setSwipeDir(null);
          }, 50);
        }
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [activeTab, tabOrder]);

  // The previous tabOrder reference for swipe detection (stable across renders)
  // Updated in the effect above which depends on activeTab and tabOrder

  const api = useStaffApi(branch?.id);

  // Find branch by code
  useEffect(() => {
    const found = branches.find(b => b.code.toLowerCase() === branchCode?.toLowerCase());
    if (found) {
      setBranch(found);
      setSelectedBranch(found);
    } else if (branches.length > 0 && !found) {
      navigate('/', { replace: true });
    }
  }, [branchCode, branches, setSelectedBranch, navigate]);

  // Load staff list when branch changes
  useEffect(() => {
    if (branch?.id) {
      api.getStaffList()
        .then(setStaffList)
        .catch(err => showToast('Failed to load staff: ' + err.message, true));
    }
  }, [branch?.id]);

  // Admin login
  async function handleAdminLogin() {
    if (!adminPinInput) return showToast('Enter admin PIN', true);
    setVerifying(true);
    try {
      const valid = await api.verifyPin(adminPinInput);
      if (valid) {
        login();
        setShowAdminLogin(false);
        setAdminPinInput('');
        showToast('✅ Admin access granted');
      } else {
        setAdminPinInput('');
        showToast('❌ Incorrect PIN', true);
      }
    } catch (err) {
      showToast('Error: ' + err.message, true);
    } finally {
      setVerifying(false);
    }
  }

  // Clock display
  const [clock, setClock] = useState('');
  useEffect(() => {
    const tick = () => {
      setClock(new Date().toLocaleTimeString('en-US', {
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }));
    };
    tick();
    const int = setInterval(tick, 1000);
    return () => clearInterval(int);
  }, []);

  const tabs = [
    { id: 'terminal', label: 'Terminal', icon: '⏱' },
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'roster', label: 'Roster', icon: '📅' },
    ...(isManager ? [{ id: 'admin', label: 'Admin', icon: '⚙' }] : []),
  ];

  if (!branch) return null;

  return (
    <div>
      {/* Header */}
      <header style={{
        padding: 'clamp(16px, 3vw, 24px) clamp(12px, 3vw, 20px) clamp(12px, 2vw, 16px)',
        textAlign: 'center',
        background: 'radial-gradient(circle at top, #083344, transparent)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          marginBottom: 4,
        }}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none',
              border: 'none',
              color: '#06b6d4',
              fontSize: 'clamp(1rem, 3vw, 1.2rem)',
              padding: '4px 8px',
              cursor: 'pointer',
              minHeight: 'var(--touch-min)',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Change branch"
          >
            ←
          </button>
          <div style={{
            fontWeight: 900,
            fontSize: 'clamp(1.1rem, 3.5vw, 1.4rem)',
            lineHeight: 1.2,
          }}>
            {branch.name}
          </div>
        </div>
        <span style={{
          color: '#06b6d4',
          fontSize: 'clamp(0.55rem, 1.5vw, 0.65rem)',
          letterSpacing: 3,
          textTransform: 'uppercase',
          fontWeight: 700,
        }}>
          Attendance Portal
        </span>
        <div id="clock" style={{
          fontSize: 'clamp(1.5rem, 5vw, 2rem)',
          fontWeight: 300,
          padding: 'clamp(6px, 1.5vw, 8px) clamp(20px, 6vw, 32px)',
          borderRadius: 50,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.1)',
          margin: 'clamp(8px, 2vw, 12px) auto 0',
          display: 'inline-block',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {clock}
        </div>
      </header>        {/* Tab Navigation */}
        <div className="container" style={{ maxWidth: 700 }}>
          <div className="tab-bar">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`nav-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
            {isManager ? (
              <button
                onClick={logout}
                className="nav-btn auth-btn logout"
              >
                🔒
              </button>
            ) : (
              <button
                onClick={() => { setAdminPinInput(''); setShowAdminLogin(true); }}
                className="nav-btn auth-btn login"
              >
                🔐
              </button>
            )}
          </div>

        {/* Tab Content — with swipe + pull-to-refresh support */}
        {/* Uses native passive touch listeners (via ref) for smooth scrolling */}
        <div
          ref={tabContentRef}
          className={`tab-content ${swipeDir ? 'swipe-' + swipeDir : ''}`}
          key={activeTab}
        >
          <PullToRefresh
            onRefresh={handleRefresh}
          >
            {activeTab === 'terminal' && (
              <Terminal
                branch={branch}
                staffList={staffList}
                api={api}
                selectedStaff={selectedStaff}
                setSelectedStaff={setSelectedStaff}
                refreshKey={refreshKey}
              />
            )}
            {activeTab === 'dashboard' && (
              <Dashboard
                branch={branch}
                staffList={staffList}
                api={api}
                isManager={isManager}
                refreshKey={refreshKey}
              />
            )}
            {activeTab === 'roster' && (
              <DutyRoster
                branch={branch}
                staffList={staffList}
                api={api}
                isManager={isManager}
                refreshKey={refreshKey}
              />
            )}
            {activeTab === 'admin' && isManager && (
              <AdminPanel
                branch={branch}
                staffList={staffList}
                setStaffList={setStaffList}
                api={api}
                refreshKey={refreshKey}
              />
            )}
          </PullToRefresh>
        </div>
      </div>

      {/* Admin Login Modal */}
      <div
        className={`modal-overlay ${showAdminLogin ? 'show' : ''}`}
        onClick={() => { if (!verifying) setShowAdminLogin(false); }}
      >
        <div
          className="modal-body"
          style={{ maxWidth: 360, textAlign: 'center' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{
            width: 50,
            height: 50,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            margin: '0 auto 16px',
          }}>
            🔐
          </div>
          <h3 style={{ marginTop: 0, color: '#06b6d4', fontSize: 'clamp(0.9rem, 2.5vw, 1rem)' }}>
            ADMIN ACCESS
          </h3>
          <p style={{
            fontSize: 'clamp(0.65rem, 1.8vw, 0.7rem)',
            opacity: 0.6,
            marginBottom: 16,
            lineHeight: 1.4,
          }}>
            Enter the admin PIN to access staff management, settlements, and reports
          </p>
          <input
            type="password"
            value={adminPinInput}
            onChange={e => setAdminPinInput(e.target.value)}
            placeholder="Enter PIN"
            style={{
              fontSize: '1.5rem',
              textAlign: 'center',
              letterSpacing: 8,
              padding: '14px 16px',
              width: '100%',
              maxWidth: 200,
              margin: '0 auto 16px',
            }}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter' && !verifying) handleAdminLogin(); }}
          />
          <div className="grid-2" style={{ gap: 8 }}>
            <button
              className="btn-primary slate"
              style={{ padding: 12 }}
              onClick={() => setShowAdminLogin(false)}
              disabled={verifying}
            >
              CANCEL
            </button>
            <button
              className="btn-primary cyan"
              style={{ padding: 12 }}
              onClick={handleAdminLogin}
              disabled={verifying}
            >
              {verifying ? '⏳ VERIFYING...' : 'UNLOCK'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
