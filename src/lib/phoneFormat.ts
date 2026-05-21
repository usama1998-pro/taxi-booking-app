/**
 * Removes Viator-style country labels (US, GB, "United Kingdom") but keeps the dial code (+34, +1, …).
 */
export function phoneForDisplay(phone: string): string {
  let s = phone.trim();
  if (!s) {
    return s;
  }

  // ISO2/ISO3 immediately before + or digits: "US +1 …", "GB+44…", "ES +34 …"
  s = s.replace(/^[A-Z]{2,3}(?=\s*\+)/i, '').trim();
  s = s.replace(/^[A-Z]{2,3}(?=\s*\d)/i, '').trim();

  // Spelled-out country name before +: "United Kingdom +44 …", "Spain +34 …"
  const plusIdx = s.indexOf('+');
  if (plusIdx > 0) {
    const prefix = s.slice(0, plusIdx).trim();
    if (/^[A-Za-z][A-Za-z\s-]*$/.test(prefix) && !/\d/.test(prefix)) {
      s = s.slice(plusIdx).trim();
    }
  }

  return s.replace(/\s+/g, ' ').trim();
}
