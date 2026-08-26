/**
 * MRZ (Machine Readable Zone) parser for TD3-format passports (ICAO 9303).
 *
 * Passports carry two 44-character lines at the bottom of the photo page,
 * e.g.
 *   P<INDKUMAR<<HITIKA<RAJESH<<<<<<<<<<<<<<<<<<<<
 *   S4093510<2IND0001225F2806125<<<<<<<<<<<<<<<2
 *
 * This is a MUCH more reliable source for structured fields than the
 * printed label lines above it ("Name", "Date of birth", ...), because:
 *  - its layout is fixed-width and identical across every country/passport
 *  - every important field has a check digit, so we can detect and even
 *    repair common OCR mistakes (O<->0, I/L<->1, S<->5, B<->8, Z<->2, G<->6)
 *
 * This module only depends on plain strings - no DOM/browser APIs - so it
 * can be unit-tested standalone.
 */

// ---- ICAO 9303 check-digit character values ------------------------------

const CHAR_VALUES = {};
'0123456789'.split('').forEach((c, i) => (CHAR_VALUES[c] = i));
'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((c, i) => (CHAR_VALUES[c] = 10 + i));
CHAR_VALUES['<'] = 0;

function charValue(ch) {
  return CHAR_VALUES[ch] ?? 0;
}

/** ICAO 9303 weighted (7,3,1) mod-10 check digit. */
export function computeCheckDigit(str) {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < str.length; i++) {
    sum += charValue(str[i]) * weights[i % 3];
  }
  return sum % 10;
}

function checkDigitOk(str, checkChar) {
  if (!/^[0-9]$/.test(checkChar)) return false;
  return computeCheckDigit(str) === Number(checkChar);
}

// ---- OCR error correction -------------------------------------------------

// Letters that OCR commonly confuses for digits, and vice versa. Only used
// inside zones where we already know which alphabet (digits-only vs
// letters-only) is expected by the MRZ spec.
const LETTER_TO_DIGIT = { O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', B: '8', G: '6', T: '7' };
const DIGIT_TO_LETTER = { '0': 'O', '1': 'I', '2': 'Z', '5': 'S', '6': 'G', '8': 'B' };

function coerceDigits(zone) {
  return zone
    .split('')
    .map((c) => (/[0-9<]/.test(c) ? c : LETTER_TO_DIGIT[c] || c))
    .join('');
}

function coerceLetters(zone) {
  return zone
    .split('')
    .map((c) => (/[A-Z<]/.test(c) ? c : DIGIT_TO_LETTER[c] || c))
    .join('');
}

// ---- Line discovery --------------------------------------------------------

// How "MRZ-like" a cleaned candidate string is: closer to 44 chars and
// denser with '<' fillers scores higher. Used to pick the best pair when
// line order can't be trusted (rotated scans, stray text near the MRZ).
function mrzLikelihood(s) {
  const lengthScore = 1 - Math.min(Math.abs(s.length - 44), 14) / 14;
  const fillerRatio = (s.match(/</g) || []).length / s.length;
  return lengthScore * 0.6 + Math.min(fillerRatio / 0.3, 1) * 0.4;
}

/**
 * Scan raw OCR line strings for the two TD3 MRZ lines. Returns
 * { line1, line2, sourceLines } or null if nothing MRZ-like was found.
 *
 * `lines` should be an array of strings, ideally in the order PaddleOCR
 * detected them (top-to-bottom), which is what result.location gives us.
 */
export function findMrzLines(lines) {
  // Split into whitespace tokens BEFORE stripping spaces. Real MRZ text
  // never contains a space, but noisy OCR often merges the MRZ with
  // trailing garbage (a barcode string, "File No.", an old-passport date)
  // onto the same detected line with a space in between. If we strip
  // spaces first, that garbage gets welded onto the MRZ and the combined
  // string blows past the ~44-char window, so the whole line was
  // previously rejected outright. Scoring tokens individually recovers
  // the clean MRZ substring even when it's buried in a longer noisy line.
  const candidates = [];
  lines.forEach((raw, idx) => {
    const line = String(raw || '');
    const tokens = line.split(/\s+/).filter(Boolean);
    // Also keep the whole line (space-stripped) as a fallback candidate,
    // for the normal case where PaddleOCR detected the MRZ as its own
    // clean line with no adjacent junk.
    const wholeLine = line.replace(/\s+/g, '');
    const pool = tokens.length > 1 ? [...tokens, wholeLine] : [wholeLine];

    const seen = new Set();
    for (const tok of pool) {
      const cleaned = tok.toUpperCase().replace(/[^A-Z0-9<]/g, '');
      if (seen.has(cleaned)) continue;
      seen.add(cleaned);
      // MRZ lines are long and close to 44 chars. Filler ('<') density is
      // a good signal but not required - a heavily-corrupted scan can
      // have digit noise crammed into what should be padding, so we only
      // require at least one filler char and lean on mrzLikelihood's
      // scoring (weighted mostly toward length) to rank real candidates
      // above unrelated text.
      if (cleaned.length >= 25 && cleaned.length <= 48 && (cleaned.match(/</g) || []).length >= 1) {
        candidates.push({ s: cleaned, idx, score: mrzLikelihood(cleaned) });
      }
    }
  });

  if (candidates.length < 2) return null;

  // Line 1 always starts with a document-type letter followed by '<' or
  // another letter (P<, PN, PD ...). Prefer a candidate that starts with 'P'.
  const line1Candidates = candidates.filter(({ s }) => /^[A-Z]</.test(s) || /^P/.test(s));
  const line1Pool = line1Candidates.length ? line1Candidates : candidates;
  const line1 = [...line1Pool].sort((a, b) => b.score - a.score)[0];

  // Line 2: prefer the detected line immediately after line1 (normal
  // top-to-bottom scans); if that isn't MRZ-like (rotated/reordered scan),
  // fall back to whichever remaining candidate scores best.
  const remaining = candidates.filter((c) => c !== line1);
  const adjacent = remaining.find((c) => c.idx === line1.idx + 1);
  const line2 =
    adjacent && adjacent.score > 0.4 ? adjacent : [...remaining].sort((a, b) => b.score - a.score)[0];

  if (!line2) return null;

  const l1 = normalizeLength(line1.s, 44);
  const l2 = normalizeLength(line2.s, 44);

  // Line 2 (passport number/dates/etc.) always starts with alnum, never '<',
  // and line 1 always starts with a document-type letter ('P'). If we picked
  // them backwards (can happen on rotated scans where reading order flips),
  // swap them.
  const looksLikeLine1 = (s) => /^[A-Z]</.test(s) || s.slice(0, 2) === 'P<';
  if (!looksLikeLine1(l1) && looksLikeLine1(l2)) {
    return { line1: l2, line2: l1, sourceLines: [lines[line2.idx], lines[line1.idx]] };
  }

  return {
    line1: l1,
    line2: l2,
    sourceLines: [lines[line1.idx], lines[line2.idx]]
  };
}

function normalizeLength(s, target) {
  if (s.length === target) return s;
  if (s.length > target) return s.slice(0, target);
  return s.padEnd(target, '<');
}

// ---- Field parsing ----------------------------------------------------------

function parseMrzDate(yyMMdd, { assumePast = true } = {}) {
  if (!/^[0-9]{6}$/.test(yyMMdd)) return { iso: null, display: null };
  const yy = Number(yyMMdd.slice(0, 2));
  const mm = Number(yyMMdd.slice(2, 4));
  const dd = Number(yyMMdd.slice(4, 6));

  const currentYY = new Date().getFullYear() % 100;
  let century;
  if (assumePast) {
    // Date of birth: can't be in the future.
    century = yy <= currentYY ? 2000 : 1900;
  } else {
    // Expiry date: modern passports expire in the 2000s/2100s.
    century = 2000;
  }
  const year = century + yy;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return { iso: null, display: null };

  const iso = `${String(year).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const display = `${String(dd).padStart(2, '0')} ${MONTHS[mm - 1]} ${year}`;
  return { iso, display };
}

const COUNTRY_NAMES = {
  IND: 'INDIAN', USA: 'AMERICAN', GBR: 'BRITISH', CAN: 'CANADIAN', AUS: 'AUSTRALIAN',
  DEU: 'GERMAN', FRA: 'FRENCH', CHN: 'CHINESE', JPN: 'JAPANESE', SGP: 'SINGAPOREAN',
  ARE: 'EMIRATI', PAK: 'PAKISTANI', BGD: 'BANGLADESHI', LKA: 'SRI LANKAN', NPL: 'NEPALESE'
};

/**
 * Parse two already-located 44-char MRZ lines into structured passport
 * fields. Applies zone-appropriate OCR correction and check-digit
 * validation so the caller can tell how much to trust the result.
 */
export function parseTd3(line1, line2) {
  line1 = normalizeLength(line1.toUpperCase(), 44);
  line2 = normalizeLength(line2.toUpperCase(), 44);

  // ---- Line 1: document type, issuing country, name ----
  const documentType = line1.slice(0, 1);
  const issuingCountry = coerceLetters(line1.slice(2, 5)).replace(/</g, '');
  const nameZone = line1.slice(5, 44);
  const [surnameRaw, givenRaw = ''] = nameZone.split('<<');
  const surname = coerceLetters(surnameRaw || '').replace(/</g, ' ').trim();
  const givenNames = coerceLetters(givenRaw)
    .replace(/<+$/, '')
    .split('<')
    .filter(Boolean)
    .join(' ')
    .trim();
  const fullName = [givenNames, surname].filter(Boolean).join(' ').trim() || null;

  // ---- Line 2: passport number, nationality, DOB, sex, expiry ----
  const passportNumberZone = line2.slice(0, 9);
  const passportNumberCheck = line2.slice(9, 10);
  const nationalityZone = coerceLetters(line2.slice(10, 13)).replace(/</g, '');
  const dobZone = coerceDigits(line2.slice(13, 19));
  const dobCheck = coerceDigits(line2.slice(19, 20));
  const sexRaw = line2.slice(20, 21);
  const expiryZone = coerceDigits(line2.slice(21, 27));
  const expiryCheck = coerceDigits(line2.slice(27, 28));
  const personalNumberZone = line2.slice(28, 42).replace(/<+$/, '');
  const compositeCheck = line2.slice(43, 44);

  const passportNumber = passportNumberZone.replace(/</g, '');
  const sex = sexRaw === 'M' || sexRaw === 'F' ? sexRaw : null;

  const dob = parseMrzDate(dobZone, { assumePast: true });
  const expiry = parseMrzDate(expiryZone, { assumePast: false });

  const validity = {
    passportNumber: checkDigitOk(passportNumberZone, passportNumberCheck),
    dateOfBirth: checkDigitOk(dobZone, dobCheck),
    expiryDate: checkDigitOk(expiryZone, expiryCheck)
  };
  const overallValid = validity.passportNumber && validity.dateOfBirth && validity.expiryDate;

  return {
    documentType,
    issuingCountry,
    surname: surname || null,
    givenNames: givenNames || null,
    fullName,
    passportNumber: passportNumber || null,
    nationality: nationalityZone || null,
    nationalityFull: COUNTRY_NAMES[nationalityZone] || nationalityZone || null,
    dateOfBirth: dob.display,
    dateOfBirthIso: dob.iso,
    sex,
    dateOfExpiry: expiry.display,
    dateOfExpiryIso: expiry.iso,
    personalNumber: personalNumberZone ? personalNumberZone.replace(/</g, '') : null,
    checkDigits: { passportNumberCheck, dobCheck, expiryCheck, compositeCheck },
    validity,
    mrzValid: overallValid,
    raw: { line1, line2 }
  };
}

/**
 * Convenience: find + parse in one call. Returns null if no MRZ was found.
 */
export function extractMrz(lines) {
  const found = findMrzLines(lines);
  if (!found) return null;
  return { ...parseTd3(found.line1, found.line2), sourceLines: found.sourceLines };
}