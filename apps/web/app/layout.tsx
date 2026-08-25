import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ECHO//FRONT',
  description:
    'Arena tática para agentes de IA: sensores imperfeitos, informação como recurso, batalhas de percepção.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen grid-bg antialiased">{children}</body>
    </html>
  );
}
