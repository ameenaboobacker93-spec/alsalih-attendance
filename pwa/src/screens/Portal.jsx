import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBranch } from '../hooks/useBranch';
import { useApp } from '../hooks/useApp';
import { useStaffApi } from '../hooks/useStaffApi';
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
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [verifying, setVerifying] = useState(false);

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
      </header>

      {/* Tab Navigation */}
      <div className="container" style={{ maxWidth: 700 }}>
        <div className="tab-scroll" style={{
          justifyContent: 'center',
          marginBottom: 20,
          paddingBottom: 8,
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`nav-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              style={{
                paddingLeft: 'clamp(14px, 3vw, 20px)',
                paddingRight: 'clamp(14px, 3vw, 20px)',
                paddingTop: 'clamp(8px, 1.5vw, 10px)',
                paddingBottom: 'clamp(8px, 1.5vw, 10px)',
                borderRadius: 30,
                cursor: 'pointer',
                border: activeTab === tab.id
                  ? '1px solid transparent'
                  : '1px solid rgba(255,255,255,0.1)',
                background: activeTab === tab.id ? '#fff' : 'rgba(255,255,255,0.05)',
                fontWeight: 700,
                fontSize: 'clamp(0.7rem, 2vw, 0.8rem)',
                color: activeTab === tab.id ? '#000' : '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                minHeight: 'var(--touch-min)',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
          {isManager ? (
            <button
              onClick={logout}
              style={{
                padding: 'clamp(8px, 1.5vw, 10px) clamp(12px, 3vw, 16px)',
                borderRadius: 30,
                cursor: 'pointer',
                border: '1px solid rgba(239,68,68,0.3)',
                background: 'rgba(239,68,68,0.1)',
                fontWeight: 700,
                fontSize: 'clamp(0.65rem, 1.8vw, 0.75rem)',
                color: '#ef4444',
                minHeight: 'var(--touch-min)',
                whiteSpace: 'nowrap',
              }}
            >
              🔒 Logout
            </button>
          ) : (
            <button
              onClick={() => { setAdminPinInput(''); setShowAdminLogin(true); }}
              style={{
                padding: 'clamp(8px, 1.5vw, 10px) clamp(12px, 3vw, 16px)',
                borderRadius: 30,
                cursor: 'pointer',
                border: '1px solid rgba(6,182,212,0.3)',
                background: 'rgba(6,182,212,0.1)',
                fontWeight: 700,
                fontSize: 'clamp(0.65rem, 1.8vw, 0.75rem)',
                color: '#06b6d4',
                minHeight: 'var(--touch-min)',
                whiteSpace: 'nowrap',
              }}
            >
              🔐 Admin Login
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="fade-in" key={activeTab}>
          {activeTab === 'terminal' && (
            <Terminal
              branch={branch}
              staffList={staffList}
              api={api}
              selectedStaff={selectedStaff}
              setSelectedStaff={setSelectedStaff}
            />
          )}
          {activeTab === 'dashboard' && (
            <Dashboard
              branch={branch}
              staffList={staffList}
              api={api}
              isManager={isManager}
            />
          )}
          {activeTab === 'roster' && (
            <DutyRoster
              branch={branch}
              staffList={staffList}
              api={api}
              isManager={isManager}
            />
          )}
          {activeTab === 'admin' && isManager && (
            <AdminPanel
              branch={branch}
              staffList={staffList}
              setStaffList={setStaffList}
              api={api}
            />
          )}
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
