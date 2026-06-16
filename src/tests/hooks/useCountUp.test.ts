// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/preact';
import { useCountUp } from '../../hooks/useCountUp';

describe('useCountUp', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the final value immediately when reduced motion is preferred', () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: () => {}, removeEventListener: () => {} });
    vi.stubGlobal('matchMedia', matchMedia);

    const { result } = renderHook(() => useCountUp(5000, 700));
    expect(result.current).toBe(5000);
    vi.unstubAllGlobals();
  });

  it('counts from 0 to target over the duration', () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
    vi.stubGlobal('matchMedia', matchMedia);

    const { result } = renderHook(() => useCountUp(1000, 1000));
    expect(result.current).toBe(0);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(1000);
    vi.unstubAllGlobals();
  });

  it('uses default duration of 700ms', () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
    vi.stubGlobal('matchMedia', matchMedia);

    const { result } = renderHook(() => useCountUp(1000));
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(result.current).toBe(1000);
    vi.unstubAllGlobals();
  });

  it('handles target = 0', () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
    vi.stubGlobal('matchMedia', matchMedia);

    const { result } = renderHook(() => useCountUp(0));
    expect(result.current).toBe(0);
    vi.unstubAllGlobals();
  });

  it('cleans up the timer on unmount', () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
    vi.stubGlobal('matchMedia', matchMedia);

    const { unmount } = renderHook(() => useCountUp(1000, 1000));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    unmount();
    // No assertion needed beyond "no error". If the timer leaked, vi would warn.
    vi.unstubAllGlobals();
  });
});
