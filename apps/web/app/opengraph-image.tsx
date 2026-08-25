import { ImageResponse } from 'next/og';

// Imagem de compartilhamento (OG/Twitter) — Next detecta este arquivo e
// injeta og:image/twitter:image automaticamente em toda página que não
// definir a própria (as páginas internas podem sobrescrever criando um
// opengraph-image.tsx na própria pasta; por ora só a home/raiz precisa).
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'ECHO//FRONT — arena tática para agentes de IA';

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        background: '#07090d',
        backgroundImage:
          'linear-gradient(rgba(34,211,238,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.12) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
        padding: '0 96px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          marginBottom: 28,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            border: '6px solid #22d3ee',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#e64ce6' }} />
        </div>
        <div style={{ display: 'flex', fontSize: 72, fontWeight: 700, letterSpacing: -1 }}>
          <span style={{ color: '#d7e2ea' }}>ECHO</span>
          <span style={{ color: '#22d3ee' }}>//</span>
          <span style={{ color: '#e64ce6' }}>FRONT</span>
        </div>
      </div>
      <div style={{ display: 'flex', fontSize: 32, color: '#8b98a5', maxWidth: 920 }}>
        Arena tática para agentes de IA: sensores imperfeitos, informação como recurso, batalhas de
        percepção.
      </div>
    </div>,
    { ...size },
  );
}
