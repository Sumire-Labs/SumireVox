import { useState, useCallback, useEffect, useRef } from 'react';

type ToastState = 'hidden' | 'saving' | 'success' | 'error';

export function useToast() {
  const [toastState, setToastState] = useState<ToastState>('hidden');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const hideToast = useCallback(() => {
    clearTimer();
    setToastState('hidden');
  }, []);

  const showSaving = useCallback(() => {
    clearTimer();
    setToastState('saving');
  }, []);

  const showSuccess = useCallback(() => {
    clearTimer();
    setToastState('success');
    timerRef.current = setTimeout(() => setToastState('hidden'), 2000);
  }, []);

  const showError = useCallback(() => {
    clearTimer();
    setToastState('error');
    timerRef.current = setTimeout(() => setToastState('hidden'), 3000);
  }, []);

  useEffect(() => () => clearTimer(), []);

  return { toastState, showSaving, showSuccess, showError, hideToast };
}

export function Toast({ state }: { state: ToastState }) {
  const [opacity, setOpacity] = useState(false);
  const prevState = useRef<ToastState>('hidden');

  useEffect(() => {
    if (state !== 'hidden') {
      // フェードイン: 次のフレームで opacity を立てる
      const raf = requestAnimationFrame(() => setOpacity(true));
      prevState.current = state;
      return () => cancelAnimationFrame(raf);
    } else {
      // フェードアウト
      setOpacity(false);
    }
  }, [state]);

  // hidden かつ opacity=false になったら DOM から除去
  if (state === 'hidden' && !opacity) return null;

  const configs = {
    saving: {
      bg: 'bg-indigo-600',
      icon: (
        <svg className="w-4 h-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      ),
      text: '保存中…',
    },
    success: {
      bg: 'bg-green-600',
      icon: (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      ),
      text: '保存しました',
    },
    error: {
      bg: 'bg-red-600',
      icon: (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      ),
      text: '保存に失敗しました',
    },
    // hidden は上で除去されるので到達しないが型を満たすため
    hidden: { bg: '', icon: null, text: '' },
  } as const;

  const current = state === 'hidden' ? prevState.current : state;
  const { bg, icon, text } = configs[current];

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 ${bg} text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium transition-opacity duration-300 ${opacity ? 'opacity-100' : 'opacity-0'}`}
    >
      {icon}
      {text}
    </div>
  );
}
