import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

export default function handler() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0D1117',
          position: 'relative',
          fontFamily: 'Arial Black, sans-serif',
        }}
      >
        {/* Top green bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: '#4ade80', display: 'flex' }} />

        {/* Glow circle behind logo */}
        <div style={{
          position: 'absolute',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(74,222,128,0.12) 0%, transparent 70%)',
          display: 'flex',
        }} />

        {/* Logo */}
        <img
          src="https://cashout.inc/cashout-icon.png"
          width={200}
          height={200}
          style={{ objectFit: 'contain', marginBottom: '24px' }}
        />

        {/* Title */}
        <div style={{
          fontSize: '96px',
          fontWeight: 900,
          color: '#FFFFFF',
          letterSpacing: '-2px',
          lineHeight: 1,
          display: 'flex',
        }}>
          CASHOUT
        </div>

        {/* Tagline */}
        <div style={{
          fontSize: '22px',
          color: '#4ade80',
          letterSpacing: '6px',
          marginTop: '16px',
          fontWeight: 400,
          display: 'flex',
        }}>
          AI-POWERED SHARP PICKS
        </div>

        {/* Domain */}
        <div style={{
          fontSize: '18px',
          color: 'rgba(255,255,255,0.35)',
          letterSpacing: '3px',
          marginTop: '20px',
          display: 'flex',
        }}>
          cashout.inc
        </div>

        {/* Bottom accent */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', background: 'rgba(74,222,128,0.3)', display: 'flex' }} />
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
