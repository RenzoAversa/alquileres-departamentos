// ============================================================
// Paleta de colores compartida para exports (Excel y PDF).
// Espejo de colorPaleta() en core/graficos.js, pero resuelta a hex fijo:
// una celda de Excel o un PDF no entienden var(--color-primario) etc.
// ============================================================
const PALETA_HEX_BASE = ['2563EB', '16A34A', 'B45309', 'DC2626', '64748B'];

export function colorPaletaHex(i) {
  const base = PALETA_HEX_BASE[i % PALETA_HEX_BASE.length];
  const vuelta = Math.floor(i / PALETA_HEX_BASE.length);
  if (vuelta === 0) return base;
  const pct = Math.max(35, 75 - vuelta * 20) / 100;
  return mezclarHex(base, 'FFFFFF', pct);
}

function mezclarHex(hexA, hexB, pctA) {
  const [ra, ga, ba] = hexA.match(/.{2}/g).map((h) => parseInt(h, 16));
  const [rb, gb, bb] = hexB.match(/.{2}/g).map((h) => parseInt(h, 16));
  const mezcla = (a, b) => Math.round(a * pctA + b * (1 - pctA)).toString(16).padStart(2, '0');
  return `${mezcla(ra, rb)}${mezcla(ga, gb)}${mezcla(ba, bb)}`.toUpperCase();
}

// Texto blanco o negro según qué tan clara es la celda (legibilidad).
export function colorTextoPara(hex) {
  const [r, g, b] = hex.match(/.{2}/g).map((h) => parseInt(h, 16));
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia > 0.6 ? '1E293B' : 'FFFFFF';
}

// 'RRGGBB' -> [r,g,b] (0-255), para APIs que piden componentes sueltos
// (ej. doc.setFillColor(...) de jsPDF).
export function hexARgb(hex) {
  return hex.match(/.{2}/g).map((h) => parseInt(h, 16));
}
