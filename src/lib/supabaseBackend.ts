import { createClient } from '@supabase/supabase-js';
import type { Backend, Query } from './backend';

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export function createSupabaseBackend(url: string, anonKey: string): Backend {
  const sb = createClient(url, anonKey);

  const applyMatch = (q: any, match: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
    return q;
  };

  return {
    mode: 'supabase',

    async select(table, q: Query = {}) {
      let query: any = sb.from(table).select('*');
      if (q.eq) query = applyMatch(query, q.eq);
      if (q.in) {
        if (!q.in[1].length) return [];
        query = query.in(q.in[0], q.in[1]);
      }
      for (const [col, dir] of q.order ?? []) query = query.order(col, { ascending: dir === 'asc' });
      if (q.limit) query = query.limit(q.limit);
      const { data, error } = await query;
      fail(error);
      return data ?? [];
    },

    async insert(table, rows, returning = true) {
      const list = Array.isArray(rows) ? rows : [rows];
      if (!list.length) return [];
      if (!returning) {
        const { error } = await sb.from(table).insert(list as any);
        fail(error);
        return [];
      }
      const { data, error } = await sb.from(table).insert(list as any).select();
      fail(error);
      return (data ?? []) as any[];
    },

    async update(table, match, patch) {
      const { data, error } = await applyMatch(sb.from(table).update(patch as any), match).select();
      fail(error);
      return data ?? [];
    },

    async upsert(table, row, onConflict) {
      const { data, error } = await sb.from(table).upsert(row as any, { onConflict }).select();
      fail(error);
      return (data ?? []) as any[];
    },

    async remove(table, match) {
      const { error } = await applyMatch(sb.from(table).delete(), match);
      fail(error);
    },

    async rpc(fn, args) {
      const { data, error } = await sb.rpc(fn, args);
      fail(error);
      return data;
    },

    async upload(file, folder, ext) {
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const { error } = await sb.storage.from('media').upload(path, file, { cacheControl: '31536000', contentType: file.type });
      fail(error);
      return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
    },

    async invoke(fn, body) {
      const { data, error } = await sb.functions.invoke(fn, { body });
      fail(error);
      if (data?.error) throw new Error(data.error);
      return data;
    },

    auth: {
      async getUser() {
        const { data } = await sb.auth.getSession();
        const u = data.session?.user;
        return u ? { id: u.id, email: u.email ?? '' } : null;
      },
      onChange(cb) {
        const { data } = sb.auth.onAuthStateChange((event, session) => {
          const u = session?.user;
          cb(u ? { id: u.id, email: u.email ?? '' } : null, event);
        });
        return () => data.subscription.unsubscribe();
      },
      async signUp(email, password, meta) {
        const { data, error } = await sb.auth.signUp({
          email, password,
          options: { data: meta, emailRedirectTo: `${window.location.origin}/account` },
        });
        fail(error);
        return { needsConfirmation: !data.session };
      },
      async signIn(email, password) {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        fail(error);
      },
      async signOut() {
        const { error } = await sb.auth.signOut();
        fail(error);
      },
      async resetPassword(email) {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        fail(error);
      },
      async updatePassword(password) {
        const { error } = await sb.auth.updateUser({ password });
        fail(error);
      },
    },
  };
}
