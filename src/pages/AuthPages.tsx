import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Field, Notice, PageLoader } from '../components/ui';
import { useAuth } from '../context/Auth';
import { db } from '../lib/backend';
import { useSeo } from '../lib/seo';
import { errorMessage } from '../lib/utils';

function Shell({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div className="container-x flex min-h-[70vh] items-center justify-center py-14">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img src="/brand/bird.png" alt="" className="mx-auto mb-5 h-14" />
          <h1 className="text-4xl text-walnut">{title}</h1>
          <p className="mt-2 text-sm text-espresso/60">{text}</p>
        </div>
        <div className="card p-7 sm:p-9">{children}</div>
      </div>
    </div>
  );
}

/** Only same-site paths are accepted as a post-login destination. */
const safeNext = (next: string | null) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/account');

export function Login() {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useSeo('Sign In');
  if (loading) return <PageLoader />;
  if (user) return <Navigate to={safeNext(params.get('next'))} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await db.auth.signIn(email, password); } catch (err) { setError(errorMessage(err)); setBusy(false); }
  };
  return (
    <Shell title="Welcome back" text="Sign in to your Woodture account.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email"><input required type="email" autoComplete="email" className="input" value={email} onChange={e => setEmail(e.target.value)} /></Field>
        <Field label="Password"><input required type="password" autoComplete="current-password" className="input" value={password} onChange={e => setPassword(e.target.value)} /></Field>
        {error && <Notice tone="error">{error}</Notice>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <div className="mt-6 flex justify-between text-sm">
        <Link to="/forgot-password" className="text-wood hover:text-walnut">Forgot password?</Link>
        <Link to={`/register${params.get('next') ? `?next=${encodeURIComponent(params.get('next')!)}` : ''}`} className="text-wood hover:text-walnut">Create account</Link>
      </div>
    </Shell>
  );
}

export function Register() {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useSeo('Create Account');
  if (loading) return <PageLoader />;
  if (user) return <Navigate to={safeNext(params.get('next'))} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const { needsConfirmation } = await db.auth.signUp(form.email, form.password, { full_name: form.full_name.trim(), phone: form.phone.trim() });
      if (needsConfirmation) setConfirm(true);
    } catch (err) { setError(errorMessage(err)); }
    setBusy(false);
  };
  const bind = (k: keyof typeof form) => ({ value: form[k], onChange: (e: { target: { value: string } }) => setForm(f => ({ ...f, [k]: e.target.value })) });

  return (
    <Shell title="Create account" text="Save your details, wishlist and order history.">
      {confirm ? (
        <Notice tone="ok">Almost done — we’ve sent a confirmation link to <strong>{form.email}</strong>. Open it to activate your account.</Notice>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Full name"><input required minLength={2} autoComplete="name" className="input" {...bind('full_name')} /></Field>
          <Field label="Phone" hint="(optional)"><input type="tel" autoComplete="tel" className="input" {...bind('phone')} /></Field>
          <Field label="Email"><input required type="email" autoComplete="email" className="input" {...bind('email')} /></Field>
          <Field label="Password" hint="(min. 8 characters)"><input required type="password" minLength={8} autoComplete="new-password" className="input" {...bind('password')} /></Field>
          {error && <Notice tone="error">{error}</Notice>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-espresso/60">Already have an account? <Link to="/login" className="text-wood hover:text-walnut">Sign in</Link></p>
    </Shell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [error, setError] = useState('');
  useSeo('Forgot Password');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState('busy'); setError('');
    try { await db.auth.resetPassword(email); setState('sent'); } catch (err) { setError(errorMessage(err)); setState('idle'); }
  };
  return (
    <Shell title="Reset password" text="We’ll email you a link to choose a new password.">
      {state === 'sent' ? (
        <Notice tone="ok">If an account exists for <strong>{email}</strong>, a reset link is on its way.</Notice>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email"><input required type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} /></Field>
          {error && <Notice tone="error">{error}</Notice>}
          <button className="btn-primary w-full" disabled={state === 'busy'}>Send reset link</button>
        </form>
      )}
      <p className="mt-6 text-center text-sm"><Link to="/login" className="text-wood hover:text-walnut">Back to sign in</Link></p>
    </Shell>
  );
}

/** Landing page for the emailed recovery link. */
export function ResetPassword() {
  const { user, loading } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [waited, setWaited] = useState(false);
  const navigate = useNavigate();
  useSeo('Choose a New Password');
  useEffect(() => { const t = setTimeout(() => setWaited(true), 2500); return () => clearTimeout(t); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await db.auth.updatePassword(password); navigate('/account', { replace: true }); }
    catch (err) { setError(errorMessage(err)); setBusy(false); }
  };
  if (loading || (!user && !waited)) return <PageLoader />;
  return (
    <Shell title="New password" text="Choose a new password for your account.">
      {!user ? (
        <Notice tone="error">This reset link is invalid or has expired. <Link to="/forgot-password" className="underline">Request a new one</Link>.</Notice>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="New password"><input required type="password" minLength={8} autoComplete="new-password" className="input" value={password} onChange={e => setPassword(e.target.value)} /></Field>
          {error && <Notice tone="error">{error}</Notice>}
          <button className="btn-primary w-full" disabled={busy}>Save password</button>
        </form>
      )}
    </Shell>
  );
}
