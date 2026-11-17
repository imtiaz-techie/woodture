// One small data interface, two implementations:
//   * supabaseBackend — production (PostgreSQL + Auth + Storage, secured by RLS)
//   * localBackend    — demo mode, used only when no Supabase keys are configured
import { createSupabaseBackend } from './supabaseBackend';
import { createLocalBackend } from './localBackend';

export interface Query {
  eq?: Record<string, unknown>;
  in?: [string, unknown[]];
  order?: [string, 'asc' | 'desc'][];
  limit?: number;
}

export interface AuthUser { id: string; email: string }

export interface Backend {
  mode: 'supabase' | 'local';
  select<T = any>(table: string, q?: Query): Promise<T[]>;
  /** `returning: false` is required where the caller may not read the row back (e.g. contact form). */
  insert<T = any>(table: string, rows: Partial<T> | Partial<T>[], returning?: boolean): Promise<T[]>;
  update<T = any>(table: string, match: Record<string, unknown>, patch: Partial<T>): Promise<T[]>;
  upsert<T = any>(table: string, row: Partial<T>, onConflict: string): Promise<T[]>;
  remove(table: string, match: Record<string, unknown>): Promise<void>;
  rpc<T = any>(fn: string, args?: Record<string, unknown>): Promise<T>;
  upload(file: Blob, folder: string, ext: string): Promise<string>;
  /** Calls a Supabase Edge Function (payment gateway). Not available in demo mode. */
  invoke<T = any>(fn: string, body: Record<string, unknown>): Promise<T>;
  auth: {
    getUser(): Promise<AuthUser | null>;
    onChange(cb: (user: AuthUser | null, event: string) => void): () => void;
    signUp(email: string, password: string, meta: { full_name: string; phone: string }): Promise<{ needsConfirmation: boolean }>;
    signIn(email: string, password: string): Promise<void>;
    signOut(): Promise<void>;
    resetPassword(email: string): Promise<void>;
    updatePassword(password: string): Promise<void>;
  };
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const db: Backend = url && key ? createSupabaseBackend(url, key) : createLocalBackend();
export const isDemo = db.mode === 'local';
