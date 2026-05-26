import React, { useState, useRef, useCallback } from 'react';

export default function PullToRefresh({ onRefresh, children, disabled = false }) {
  const [pullState, setPullState] = useState('idle'); // idle | pulling | refreshing
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const pullDistanceRef = useRef(0); // Real-time track to avoid stale closures
  const containerRef = useRef(null);
  const isPulling = useRef(false);

  const handleTouchStart = useCallback((e) => {
    if (disabled) return;
    // Only activate if at the very top of the container
    const scrollTop = containerRef.current?.scrollTop ?? 0;
    if (scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = false;
      pullDistanceRef.current = 0;
    }
  }, [disabled]);

  const handleTouchMove = useCallback((e) => {
    if (disabled || pullState === 'refreshing') return;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0) {
      // Pulling down
      const scrollTop = containerRef.current?.scrollTop ?? 0;
      if (scrollTop <= 0) {
        isPulling.current = true;
        // Stop propagation to prevent tab swipe from firing
        e.stopPropagation();
        // Apply resistance: sqrt scaling makes it feel natural
        const distance = Math.min(Math.sqrt(dy * 8), 150);
        pullDistanceRef.current = distance;
        setPullDistance(distance);
        setPullState('pulling');
      }
    }
  }, [disabled, pullState]);

  const handleTouchEnd = useCallback(async () => {
    if (disabled || !isPulling.current) return;
    isPulling.current = false;

    // Use ref to get real-time value (not stale state)
    if (pullDistanceRef.current >= 70) {
      // Trigger refresh
      setPullState('refreshing');
      setPullDistance(44); // Spinner size while refreshing
      try {
        if (onRefresh) {
          await onRefresh();
        }
      } finally {
        // Snap back
        pullDistanceRef.current = 0;
        setPullDistance(0);
        setPullState('idle');
      }
    } else {
      // Snap back without refresh
      pullDistanceRef.current = 0;
      setPullDistance(0);
      setPullState('idle');
    }
  }, [disabled, onRefresh]);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ position: 'relative', overscrollBehavior: 'none' }}
    >
      {/* Pull indicator */}
      <div
        className={`ptr-indicator ${pullState}`}
        style={{
          height: pullDistance,
          opacity: pullState === 'refreshing' ? 1 : Math.min(pullDistance / 70, 1),
          transition: pullState === 'idle' ? 'height 0.3s ease, opacity 0.3s ease' : 'none',
          overflow: 'hidden',
        }}
      >
        <div className="ptr-content">
          {pullState === 'refreshing' ? (
            <span className="ptr-spinner" />
          ) : pullDistance >= 50 ? (
            <span className="ptr-arrow down">↓</span>
          ) : (
            <span className="ptr-arrow">↓</span>
          )}
          <span className="ptr-text">
            {pullState === 'refreshing' ? 'Refreshing...' : pullDistance >= 70 ? 'Release to refresh' : 'Pull to refresh'}
          </span>
        </div>
      </div>

      {children}
    </div>
  );
}
