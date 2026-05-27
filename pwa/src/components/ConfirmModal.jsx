import React from 'react';

export default function ConfirmModal({
  visible,
  title = 'CONFIRM ACTION',
  message = '',
  onConfirm,
  onCancel,
  confirmText = 'YES, PROCEED',
  confirmColor = '#10b981',
}) {
  if (!visible) return null;

  return (
    <div className="modal-overlay show" onClick={onCancel}>
      <div className="modal-body" style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ color: 'var(--accent)', marginTop: 0, marginBottom: 16 }}>{title}</h3>
        <p style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: 24, lineHeight: 1.6 }}>{message}</p>
        <div className="grid-2">
          <button className="btn-primary slate" onClick={onCancel} style={{ padding: 12 }}>
            CANCEL
          </button>
          <button
            className="btn-primary"
            style={{ background: confirmColor, padding: 12 }}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
