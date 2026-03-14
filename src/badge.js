/**
 * SVG badge generator — shields.io style
 * Generates badges like: skill-audit | A 100
 */

const GRADE_COLORS = {
  A: '#4c1',      // green
  B: '#97ca00',   // yellow-green
  C: '#dfb317',   // yellow
  D: '#fe7d37',   // orange
  F: '#e05d44',   // red
};

const LABEL = 'skill-audit';
const LABEL_COLOR = '#555';

export function generateBadge(score, grade) {
  const color = GRADE_COLORS[grade] || GRADE_COLORS.F;
  const value = `${grade} ${score}`;

  // Approximate text widths (6.5px per char for 11px Verdana)
  const labelWidth = LABEL.length * 6.5 + 10;
  const valueWidth = value.length * 6.5 + 10;
  const totalWidth = labelWidth + valueWidth;

  const labelX = labelWidth / 2;
  const valueX = labelWidth + valueWidth / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${LABEL}: ${value}">
  <title>${LABEL}: ${value}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="${LABEL_COLOR}"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text x="${labelX}" y="15" fill="#010101" fill-opacity=".3">${LABEL}</text>
    <text x="${labelX}" y="14" fill="#fff">${LABEL}</text>
    <text x="${valueX}" y="15" fill="#010101" fill-opacity=".3">${value}</text>
    <text x="${valueX}" y="14" fill="#fff">${value}</text>
  </g>
</svg>`;
}
