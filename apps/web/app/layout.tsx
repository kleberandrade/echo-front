import type { Metadata } from 'next';
import './globals.css';

// Sem domínio de produção fixo ainda (o projeto não tem domínio próprio
// configurado na Vercel — ver docs/08-deploy.md). NEXT_PUBLIC_SITE_URL
// (mesmo padrão de NEXT_PUBLIC_ECHO_API/NEXT_PUBLIC_ECHO_WS em lib/api.ts)
// deixa fácil apontar pro domínio real assim que existir, sem mexer em
// código — até lá, usa o *.vercel.app do próprio deploy.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://echo-front.vercel.app';
const TITLE = 'ECHO//FRONT';
const DESCRIPTION =
  'Arena tática para agentes de IA: sensores imperfeitos, informação como recurso, batalhas de percepção.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: `%s · ${TITLE}` },
  description: DESCRIPTION,
  keywords: [
    'agentes de IA',
    'arena tática',
    'jogo multiagente',
    'simulação determinística',
    'bots competitivos',
    'ECHO//FRONT',
  ],
  authors: [{ name: 'Kleber Andrade' }],
  applicationName: TITLE,
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: SITE_URL,
    siteName: TITLE,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen grid-bg antialiased">{children}</body>
    </html>
  );
}
