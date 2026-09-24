import { supabase } from './supabaseClient';

export const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
export async function api<T=any>(path:string,init:RequestInit={}){
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const r = await fetch(`${API}${path}`,{...init,headers:{'Content-Type':'application/json','ngrok-skip-browser-warning':'true',...(token?{Authorization:`Bearer ${token}`}:{}),...(init.headers||{})},cache:'no-store'});
  if(r.status===401){ await supabase.auth.signOut(); if(typeof window!=='undefined') window.location.href='/login'; throw new Error('Sesión expirada'); }
  const responseData = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(responseData.message||`Error ${r.status}`);
  return responseData as T;
}
export const money=(n:number|string)=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(Number(n||0));
