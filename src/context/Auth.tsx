import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { db, type AuthUser } from '../lib/backend';
import type { Profile } from '../lib/types';

interface AuthState {
  user: AuthUser | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  recovery: boolean;
  refreshProfile: () => Promise<void>;
}

const Ctx = createContext<AuthState>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [booting, setBooting] = useState(true);
  const [profileFor, setProfileFor] = useState<string | null>(null);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    const apply = (u: AuthUser | null) => setUser(prev => (prev?.id === u?.id ? prev : u));
    db.auth.getUser().then(apply).catch(() => undefined).finally(() => setBooting(false));
    return db.auth.onChange((u, event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      apply(u);
    });
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) { setProfile(null); setProfileFor(null); return; }
    try {
      const rows = await db.select<Profile>('profiles', { eq: { id: user.id } });
      setProfile(rows[0] ?? null);
    } catch {
      setProfile(null);
    }
    setProfileFor(user.id);
  }, [user]);

  useEffect(() => { void refreshProfile(); }, [refreshProfile]);

  const loading = booting || (!!user && profileFor !== user.id);
  return (
    <Ctx.Provider value={{ user, profile, isAdmin: profile?.role === 'admin', loading, recovery, refreshProfile }}>
      {children}
    </Ctx.Provider>
  );
}
