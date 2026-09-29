'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type LocalBack = { run: () => void; disabled: boolean } | null;
const BackContext = createContext<Dispatch<SetStateAction<LocalBack>> | null>(null);
const STORAGE_KEY = 'reboutique-navigation-v1';
const isPage = (path: unknown): path is string =>
  typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') &&
  path !== '/' && path !== '/login';

// A form is an in-page view: return to its list before leaving the route.
export function usePageBack(active: boolean, onBack: () => void, disabled = false) {
  const register = useContext(BackContext);
  const callback = useRef(onBack);
  useEffect(() => { callback.current = onBack; }, [onBack]);
  useEffect(() => {
    if (!register || !active) return;
    register({ run: () => callback.current(), disabled });
    return () => register(null);
  }, [register, active, disabled]);
}

export default function AppNavigation({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [localBack, setLocalBack] = useState<LocalBack>(null);
  const [pages, setPages] = useState<string[]>([]);
  const history = useRef<string[]>([]);
  const initialized = useRef(false);
  const browserBack = useRef(false);
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    const onPop = () => {
      browserBack.current = window.location.pathname !== history.current[history.current.length - 1];
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      try {
        const saved: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
        if (Array.isArray(saved)) history.current = saved.filter(isPage).slice(-100);
      } catch { /* Navigation also works when session storage is unavailable. */ }
    }
    if (!isPage(pathname)) {
      history.current = [];
    } else {
      const previousIndex = history.current.lastIndexOf(pathname);
      if (browserBack.current && previousIndex >= 0) {
        history.current = history.current.slice(0, previousIndex + 1);
      } else if (history.current[history.current.length - 1] !== pathname) {
        history.current = [...history.current, pathname].slice(-100);
      }
    }
    browserBack.current = false;
    setPages([...history.current]);
    setNavigating(false);
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history.current)); } catch {}
  }, [pathname]);

  const goBack = () => {
    if (localBack) {
      if (!localBack.disabled) localBack.run();
      return;
    }
    const target = history.current.length > 1
      ? history.current[history.current.length - 2]
      : '/dashboard';
    if (target === pathname) return;
    if (history.current.length > 1) history.current = history.current.slice(0, -1);
    setNavigating(true);
    router.replace(target);
  };

  return (
    <BackContext.Provider value={setLocalBack}>
      {isPage(pathname) && (
        <nav aria-label="Navigazione" className="border-b border-slate-200 bg-white print:hidden">
          <div className="mx-auto max-w-[96rem] px-4 py-3 pr-20">
            <button
              type="button"
              onClick={goBack}
              disabled={navigating || !!localBack?.disabled || (!localBack && pages.length < 2 && pathname === '/dashboard')}
              title={localBack ? 'Torna alla lista' : 'Torna alla pagina precedente'}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span aria-hidden="true">←</span> Indietro
            </button>
          </div>
        </nav>
      )}
      {children}
    </BackContext.Provider>
  );
}
