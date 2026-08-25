import { ImageResponse } from 'next/og';

// apple-touch-icon (Next detecta e injeta o <link rel="apple-touch-icon">) —
// mesmo desenho do favicon (app/icon.tsx), só maior: 180×180 é o tamanho
// de referência da Apple pra ícone de tela inicial em iOS.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#07090d',
      }}
    >
      <div
        style={{
          width: 124,
          height: 124,
          borderRadius: '50%',
          border: '14px solid #22d3ee',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: '#e64ce6',
          }}
        />
      </div>
    </div>,
    { ...size },
  );
}
