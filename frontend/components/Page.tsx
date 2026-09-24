import { ReactNode } from 'react';
export function Page({title,subtitle,action,children}:{title:string;subtitle?:string;action?:ReactNode;children:ReactNode}){return <><header className="pageHeader"><div><span className="eyebrow">PIÑA ROSA BEAUTY</span><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{action}</header>{children}</>}
export function Stat({label,value,help}:{label:string;value:any;help?:string}){return <article className="stat"><span>{label}</span><strong>{value}</strong>{help&&<small>{help}</small>}</article>}
