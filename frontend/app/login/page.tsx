'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setMsg(error.message); return; }
    router.replace('/');
  }

  return (
    <div className="loginWrap">
      <form className="loginCard" onSubmit={submit}>
        <div className="brandMark" style={{ margin: '0 auto 12px' }}>PR</div>
        <h1>Piña Rosa Inventory</h1>
        <p className="muted">Iniciá sesión para continuar</p>
        {msg && <div className="notice error">{msg}</div>}
        <div className="field">
          <label>Email</label>
          <input className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>Contraseña</label>
          <input className="input" type="password" required value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <button className="btn primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
