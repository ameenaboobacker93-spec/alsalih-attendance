import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useBranch } from '../hooks/useBranch';
import { useApp } from '../hooks/useApp';

export default function BranchSelector() {
  const navigate = useNavigate();
  const { branches, loading, error } = useBranch();
  const { theme, toggleTheme } = useApp();

  function selectBranch(branch) {
    navigate(`/portal/${branch.code.toLowerCase()}`);
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      background: 'var(--bg-gradient)',
      position: 'relative',
    }}>
      {/* Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        style={{
          position: 'absolute',
          top: 'clamp(12px, 2vw, 20px)',
          right: 'clamp(12px, 3vw, 20px)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: '50%',
          width: 'clamp(36px, 4.5vw, 44px)',
          height: 'clamp(36px, 4.5vw, 44px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: 'clamp(0.95rem, 2vw, 1.15rem)',
          color: 'var(--text-primary)',
          transition: 'all 0.2s',
          zIndex: 10,
        }}
        title="Toggle Theme"
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
      {/* Brand */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 36,
          margin: '0 auto 16px',
          boxShadow: '0 8px 32px rgba(6, 182, 212, 0.3)',
        }}>
          <svg width="40" height="40" viewBox="0 0 100 100" fill="white">
            <rect x="38" y="20" width="24" height="60" rx="6"/>
            <rect x="20" y="38" width="60" height="24" rx="6"/>
          </svg>
        </div>
        <h1 style={{
          fontSize: 'clamp(1.3rem, 4vw, 1.8rem)',
          fontWeight: 900,
          letterSpacing: '1px',
        }}>
          AL SALIH PHARMACY
        </h1>
        <p style={{
          color: '#06b6d4',
          fontSize: 'clamp(0.6rem, 1.8vw, 0.75rem)',
          letterSpacing: 4,
          textTransform: 'uppercase',
          fontWeight: 700,
          marginTop: 6,
        }}>
          Staff Attendance Portal
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center' }}>
          <div className="loader" style={{ width: 32, height: 32, borderWidth: 3, borderColor: '#06b6d4', borderBottomColor: 'transparent' }} />
          <p style={{ color: '#06b6d4', fontSize: '0.75rem', marginTop: 12, letterSpacing: 1 }}>
            Loading branches...
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="card" style={{ textAlign: 'center', maxWidth: 400, borderColor: '#ef4444' }}>
          <p style={{ color: '#ef4444', fontWeight: 700, marginBottom: 8 }}>⚠ Connection Error</p>
          <p style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: 16 }}>{error}</p>
          <button className="btn-primary cyan" onClick={() => window.location.reload()} style={{ padding: 12 }}>
            RETRY
          </button>
        </div>
      )}

      {/* Branch Cards */}
      {!loading && !error && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          width: '100%',
          maxWidth: 400,
        }}>
          <p style={{
            textAlign: 'center',
            color: 'var(--text-secondary)',
            fontSize: '0.65rem',
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginBottom: 4,
          }}>
            Select a Branch
          </p>
          {branches.map((branch, index) => (
            <button
              key={branch.id}
              onClick={() => selectBranch(branch)}
              className="fade-in"
              style={{
                animationDelay: `${index * 100}ms`,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                borderRadius: 20,
                padding: 'clamp(18px, 3vw, 24px)',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                transition: 'all 0.3s',
                textAlign: 'left',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                width: '100%',
                minHeight: 'var(--touch-min)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#06b6d4';
                e.currentTarget.style.background = 'var(--accent-dim)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(6, 182, 212, 0.15)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.background = 'var(--bg-elevated)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{
                width: 50,
                height: 50,
                borderRadius: 14,
                background: `linear-gradient(135deg, ${branch.code === 'AJM' ? '#0891b2' : '#7c3aed'}, ${branch.code === 'AJM' ? '#06b6d4' : '#a855f7'})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                fontWeight: 900,
                flexShrink: 0,
              }}>
                {branch.code}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 'clamp(1rem, 2.5vw, 1.1rem)' }}>{branch.name}</div>
                <div style={{ fontSize: '0.65rem', opacity: 0.5, marginTop: 4 }}>
                  Tap to enter portal
                </div>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          ))}
        </div>
      )}

      {/* Footer */}
      <p style={{ marginTop: 40, fontSize: '0.55rem', opacity: 0.3, letterSpacing: 1 }}>
        v2.0 · Powered by Supabase + Cloudflare
      </p>
    </div>
  );
}
