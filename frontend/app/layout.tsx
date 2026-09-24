import './globals.css'; import { AuthGate } from '@/components/AuthGate';
export const metadata={title:'Piña Rosa Inventory',description:'Inventario mayorista de maquillaje'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body><AuthGate>{children}</AuthGate></body></html>}
