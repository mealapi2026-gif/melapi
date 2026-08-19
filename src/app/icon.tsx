import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';
export const runtime = 'nodejs';

export default async function Icon() {
  const logoData = await readFile(new URL('../../public/images/logo-sim-api.png', import.meta.url));
  const logo = `data:image/png;base64,${logoData.toString('base64')}`;

  return new ImageResponse(
    (
      <div style={{ background: '#ffffff', display: 'flex', height: '100%', overflow: 'hidden', width: '100%' }}>
        <img
          alt=""
          src={logo}
          style={{ height: '100%', objectFit: 'contain', objectPosition: 'center', width: '100%' }}
        />
      </div>
    ),
    size,
  );
}
