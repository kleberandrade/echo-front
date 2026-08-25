import { ImageResponse } from 'next/og';

// Favicon gerado via next/og (Next.js detecta este arquivo automaticamente
// e serve como /icon, com o <link rel="icon"> injetado no <head>). Gerado
// em vez de um PNG estático pra ficar fácil de re-tocar sem depender de um
// editor de imagem — usa exatamente a paleta do site (globals.css).
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#07090d',
        borderRadius: 6,
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          border: '2.5px solid #22d3ee',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#e64ce6',
          }}
        />
      </div>
    </div>,
    { ...size },
  );
}
