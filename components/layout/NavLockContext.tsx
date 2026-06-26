"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface NavLockContextValue {
  locked: boolean;
  setLocked: (locked: boolean) => void;
}

const NavLockContext = createContext<NavLockContextValue>({
  locked: false,
  setLocked: () => {},
});

export function NavLockProvider({ children }: { children: React.ReactNode }) {
  const [locked, setLockedState] = useState(false);
  const setLocked = useCallback((v: boolean) => setLockedState(v), []);
  const value = useMemo(() => ({ locked, setLocked }), [locked, setLocked]);
  return <NavLockContext.Provider value={value}>{children}</NavLockContext.Provider>;
}

export function useNavLock() {
  return useContext(NavLockContext);
}
