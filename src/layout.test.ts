import { describe, expect, it } from 'vitest';
import { sizePage } from './viewport';

describe('page layout (issue #11: the game was cut off at the height iOS reports)', () => {
  it('sizes html, body and #app to the game size, not only #app', () => {
    const el = () => ({ style: { width: '', height: '', position: '' } });
    const els = { html: el(), body: el(), app: el() };
    sizePage(els, 402, 874);
    for (const e of Object.values(els)) expect(e.style).toMatchObject({ width: '402px', height: '874px' });
    // A fixed #app taller than the reported window is what got cut off.
    expect(els.app.style.position).toBe('absolute');
    expect(els.html.style.position).toBe('');
  });
});
