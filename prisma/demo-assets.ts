// Demo uchun lokal ravishda yaratiladigan rasmlar (SVG → PNG) va oddiy PDF hujjatlar. Internetdan hech narsa yuklanmaydi.
import sharp from 'sharp';

type Motif = 'building' | 'laptop' | 'gear' | 'book' | 'trophy' | 'people' | 'handshake' | 'calendar';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const ICONS: Record<Motif, string> = {
  building: '<path d="M-90 80V-20L0-80l90 60V80z" fill="#fff" fill-opacity=".92"/><rect x="-60" y="-5" width="30" height="30" fill="#12345B"/><rect x="30" y="-5" width="30" height="30" fill="#12345B"/><rect x="-15" y="30" width="30" height="50" fill="#087F5B"/>',
  laptop: '<rect x="-95" y="-70" width="190" height="115" rx="8" fill="#fff" fill-opacity=".92"/><rect x="-80" y="-56" width="160" height="87" fill="#12345B"/><path d="M-120 60h240l-18-15h-204z" fill="#fff"/><path d="M-50-30l-25 20 25 20M50-30l25 20-25 20M10-40l-20 60" stroke="#6ee7b7" stroke-width="7" fill="none" stroke-linecap="round"/>',
  gear: '<circle r="62" fill="#fff" fill-opacity=".92"/><circle r="26" fill="#12345B"/><g fill="#fff" fill-opacity=".92"><rect x="-14" y="-92" width="28" height="30"/><rect x="-14" y="62" width="28" height="30"/><rect x="62" y="-14" width="30" height="28"/><rect x="-92" y="-14" width="30" height="28"/></g>',
  book: '<path d="M-100-60h90a20 20 0 0 1 20 20v110a20 20 0 0 0-20-20h-90z" fill="#fff" fill-opacity=".92"/><path d="M100-60h-90a20 20 0 0 0-20 20v110a20 20 0 0 1 20-20h90z" fill="#fff" fill-opacity=".8"/><path d="M-80-30h60M-80 0h60M40-30h40M40 0h40" stroke="#12345B" stroke-width="7" stroke-linecap="round"/>',
  trophy: '<path d="M-50-70h100v50a50 50 0 0 1-100 0z" fill="#fff" fill-opacity=".92"/><path d="M-50-55h-30v20a30 30 0 0 0 30 30M50-55h30v20a30 30 0 0 1-30 30" stroke="#fff" stroke-width="10" fill="none"/><rect x="-10" y="30" width="20" height="30" fill="#fff"/><rect x="-45" y="60" width="90" height="16" rx="4" fill="#fff"/>',
  people: '<circle cx="-55" cy="-40" r="26" fill="#fff" fill-opacity=".92"/><circle cx="0" cy="-55" r="30" fill="#fff"/><circle cx="55" cy="-40" r="26" fill="#fff" fill-opacity=".92"/><path d="M-100 70a45 55 0 0 1 90 0zM-45 70a45 55 0 0 1 90 0zM10 70a45 55 0 0 1 90 0z" fill="#fff" fill-opacity=".92"/>',
  handshake: '<path d="M-110-10l50-40 40 10 40-10 50 40-40 60-30 10-20-15-20 15-30-10z" fill="#fff" fill-opacity=".92"/><path d="M-30 10l30 25 30-25" stroke="#12345B" stroke-width="8" fill="none" stroke-linecap="round"/>',
  calendar: '<rect x="-90" y="-70" width="180" height="150" rx="14" fill="#fff" fill-opacity=".92"/><rect x="-90" y="-70" width="180" height="40" rx="14" fill="#087F5B"/><g fill="#12345B"><rect x="-65" y="-10" width="30" height="24"/><rect x="-15" y="-10" width="30" height="24"/><rect x="35" y="-10" width="30" height="24"/><rect x="-65" y="30" width="30" height="24"/><rect x="-15" y="30" width="30" height="24"/></g>',
};

const PALETTES: [string, string][] = [
  ['#12345B', '#1f6f9c'], ['#087F5B', '#12345B'], ['#1a4172', '#087F5B'], ['#0e2947', '#2a7f8e'], ['#12345B', '#6b4fa0'], ['#065f46', '#1d4ed8'],
];

function wrap(text: string, max: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) {
      lines.push(cur.trim());
      cur = w;
    } else cur = `${cur} ${w}`;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

export async function illustration(opts: { width: number; height: number; motif: Motif; palette: number; title?: string; subtitle?: string }): Promise<Buffer> {
  const { width: w, height: h, motif } = opts;
  const [c1, c2] = PALETTES[opts.palette % PALETTES.length]!;
  const scale = Math.min(w, h) / 380;
  const textLines = opts.title ? wrap(opts.title, Math.max(14, Math.round(w / (h > w * 0.7 ? 34 : 38)))).slice(0, 3) : [];
  const fs = Math.round(Math.min(w, h) * (w > h * 2 ? 0.1 : 0.075));
  const textX = w > h * 1.5 ? w * 0.08 : w * 0.07;
  const textY = h * (w > h * 1.5 ? 0.42 : 0.74) - (textLines.length - 1) * fs * 0.6;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <circle cx="${w * 0.9}" cy="${h * 0.1}" r="${h * 0.5}" fill="#fff" fill-opacity=".06"/>
  <circle cx="${w * 0.75}" cy="${h * 1.05}" r="${h * 0.45}" fill="#fff" fill-opacity=".06"/>
  <g transform="translate(${w > h * 1.5 ? w * 0.78 : w * 0.5} ${w > h * 1.5 ? h * 0.5 : h * 0.36}) scale(${scale})">${ICONS[motif]}</g>
  ${textLines.map((l, i) => `<text x="${textX}" y="${textY + i * fs * 1.25}" font-family="Segoe UI, Arial, sans-serif" font-size="${fs}" font-weight="600" fill="#fff">${esc(l)}</text>`).join('\n')}
  ${opts.subtitle ? `<text x="${textX}" y="${textY + textLines.length * fs * 1.25 + fs * 0.4}" font-family="Segoe UI, Arial, sans-serif" font-size="${Math.round(fs * 0.55)}" fill="#fff" fill-opacity=".85">${esc(opts.subtitle)}</text>` : ''}
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function logoImage(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#12345B"/><path d="M14 46V26l18-10 18 10v20" fill="none" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/><path d="M22 46V32h20v14" fill="none" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/><rect x="28" y="36" width="8" height="10" fill="#087F5B"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function portrait(initials: string, palette: number): Promise<Buffer> {
  const [c1, c2] = PALETTES[palette % PALETTES.length]!;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)"/><circle cx="200" cy="155" r="62" fill="#fff" fill-opacity=".85"/><path d="M70 400a130 150 0 0 1 260 0z" fill="#fff" fill-opacity=".85"/><text x="200" y="372" text-anchor="middle" font-family="Segoe UI, Arial" font-size="34" font-weight="600" fill="#fff">${esc(initials)}</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Lotin harflaridagi PDF uchun: Helvetica faqat ASCII ni qo'llab-quvvatlaydi. */
const ascii = (s: string) => s.normalize('NFKD').replace(/[ʻʼ‘’`´]/g, "'").replace(/[^\x20-\x7E]/g, '');

export function makePdf(title: string, lines: string[]): Buffer {
  const pdfEsc = (s: string) => ascii(s).replace(/[\\()]/g, '\\$&');
  const stream = [
    `BT /F1 20 Tf 60 780 Td (${pdfEsc(title)}) Tj ET`,
    ...lines.map((l, i) => `BT /F1 12 Tf 60 ${735 - i * 22} Td (${pdfEsc(l)}) Tj ET`),
  ].join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

export type { Motif };
