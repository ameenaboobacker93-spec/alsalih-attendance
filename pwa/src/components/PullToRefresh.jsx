import React, { useState, useRef, useEffect } from 'react';

export default function PullToRefresh({ onRefresh, children, disabled = false }) {
  const [pullState, setPullState] = useState('idle'); // idle | pulling | refreshing
  const [pullDistance, setPullDistance] = useState(0);
  const wrapperRef = useRef(null);
  const pullDist = useRef(0);
  const refreshing = useRef(false);

  // Use native DOM listeners with { passive: true } for smooth mobile scrolling.
  // React's synthetic touch events are always non-passive, which causes iOS Safari
  // to delay scroll initiation (waiting to see if preventDefault() is called).
  // Passive listeners tell the browser: "scroll immediately, I won't block it."
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || disabled) return;

    let startY = 0;
    let isPulling = false;

    const onTouchStart = (e) => {
      if (refreshing.current) return;
      const scrollY = window.scrollY || window.pageYOffset || 0;
      if (scrollY <= 0) {
        startY = e.touches[0].clientY;
        isPulling = false;
        pullDist.current = 0;
      }
    };

    const onTouchMove = (e) => {
      if (refreshing.current) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0) {
        const scrollY = window.scrollY || window.pageYOffset || 0;
        if (scrollY <= 0) {
          isPulling = true;
          const distance = Math.min(Math.sqrt(dy * 8), 150);
          pullDist.current = distance;
          setPullDistance(distance);
          setPullState('pulling');
        }
      }
    };

    const onTouchEnd = () => {
      if (refreshing.current || !isPulling) return;
      isPulling = false;

      if (pullDist.current >= 70) {
        setPullState('refreshing');
        setPullDistance(44);
        refreshing.current = true;

        // Trigger refresh asynchronously, then reset
        Promise.resolve(typeof onRefresh === 'function' ? onRefresh() : null)
          .catch(() => {})
          .finally(() => {
            pullDist.current = 0;
            setPullDistance(0);
            setPullState('idle');
            refreshing.current = false;
          });
      } else {
        pullDist.current = 0;
        setPullDistance(0);
        setPullState('idle');
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [disabled, onRefresh]);

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'relative' }}
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
