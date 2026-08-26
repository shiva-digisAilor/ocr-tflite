import { extractMrz } from './mrzParser.js';

export function extractPassportFields(ocrResult, language = 'english') {
  const lineTexts = (ocrResult.location || [])
    .map((l) => (typeof l === 'string' ? l : l.text))
    .filter(Boolean);

  const fullText = ocrResult.text_extracted || lineTexts.join('\n');

  const mrz = extractMrz(lineTexts.length ? lineTexts : fullText.split('\n'));

  const labelFields = extractLabeledFields(fullText, lineTexts);

  const name = mrz?.fullName || labelFields.name || null;
  const dateOfBirth = mrz?.dateOfBirth || labelFields.dateOfBirth || null;
  const nationality = mrz?.nationalityFull || mrz?.nationality || labelFields.nationality || null;
  const passportNumber = mrz?.passportNumber || labelFields.passportNumber || null;

  return {
    name,
    dateOfBirth,
    nationality,
    passportNumber,
    address: labelFields.address || null,
    language,

    surname: mrz?.surname || null,
    givenNames: mrz?.givenNames || null,
    sex: mrz?.sex || labelFields.sex || null,
    dateOfExpiry: mrz?.dateOfExpiry || labelFields.dateOfExpiry || null,
    dateOfIssue: labelFields.dateOfIssue || null,
    placeOfBirth: labelFields.placeOfBirth || null,
    placeOfIssue: labelFields.placeOfIssue || null,
    fatherName: labelFields.fatherName || null,
    motherName: labelFields.motherName || null,
    spouseName: labelFields.spouseName || null,
    fileNo: labelFields.fileNo || null,
    documentType: mrz?.documentType || labelFields.documentType || null,
    issuingCountry: mrz?.issuingCountry || null,

    _meta: {
      mrzDetected: Boolean(mrz),
      mrzValid: mrz?.mrzValid ?? false,
      mrzFieldValidity: mrz?.validity || null,
      mrz: mrz || null
    }
  };
}

const OTHER_LABELS_RE =
  /(place\s*of\s*issue|date\s*of\s*issue|date\s*of\s*expiry|nationality|\bsex\b|given\s*name|surname|passport\s*no)/i;

// Passport labels are always printed as "<Hindi text> / <English Label>".
// When OCR merges a value line with the start of the NEXT field's label
// (common when two fields sit close together or a signature overlaps a row),
// the value ends up with a trailing "<fragment>/<Label word>" tail, e.g.
// "H/Place of SSUe A" bleeding into a Place-of-Birth value. The English label
// word itself is sometimes OCR-garbled ("SSUe" for "Issue"), so we match on
// the slash + capitalized label word rather than the exact label text.
const LABEL_BLEED_RE = /\s*\S{0,4}\/\s*(Place|Date|Nationality|Sex|Given|Surname|Passport|Name|Type|Country)\b/i;

// Lines that mention "Old Passport No. ... Place of Issue" are the passport-
// history composite field, not the real Place of Issue / Date of Issue
// fields. Without this guard, scanLines() matches "place of issue" inside
// that composite label and grabs the wrong next line (e.g. "File No.") as
// the value.
const COMPOSITE_LABEL_RE = /old\s*passport/i;

// Printed field VALUES on these passports are always ALL CAPS. When OCR
// misreads a nearby Hindi glyph, a stray page-number digit, or a signature
// stroke, it shows up as a short lowercase/mixed-case token or a 1-2 digit
// number sitting inline with the real value (e.g. "7 v YAMUNA NAGAR,
// HARYANA GRi" — real content is "YAMUNA NAGAR, HARYANA"). This filters
// those tokens out wherever they land — start, middle, or end.
function isNoiseToken(tok) {
  const stripped = tok.replace(/[^A-Za-z0-9]/g, '');
  if (!stripped) return true; // pure punctuation
  const digits = (stripped.match(/[0-9]/g) || []).length;
  const letters = stripped.length - digits;

  if (letters === 0) return digits < 3; // bare short digit run = page/artifact noise
  if (digits > 0) return false; // alphanumeric code (file no., barcode, PIN) — always keep
  // pure letters, no digits: must be mostly uppercase and reasonably long
  const upper = (stripped.match(/[A-Z]/g) || []).length;
  return upper / letters < 0.7 || letters < 2;
}

function stripNoiseTokens(str) {
  const kept = str
    .split(/\s+/)
    .filter((tok) => tok && !isNoiseToken(tok))
    .join(' ');
  return kept.replace(/\s*,\s*/g, ', ').replace(/,\s*$/, '').trim();
}

function cutBeforeNextLabel(str) {
  let out = str;

  const bleed = out.match(LABEL_BLEED_RE);
  if (bleed && bleed.index > 2) out = out.slice(0, bleed.index).trim();

  const m = out.match(OTHER_LABELS_RE);
  if (m && m.index > 2) out = out.slice(0, m.index).trim();

  // Strip a trailing barcode/passport-number token that OCR sometimes reads
  // onto the same line as the real value, e.g. "RAJESHKUMAR S4093510" ->
  // "RAJESHKUMAR". Only trims from the very end, so it won't touch
  // meaningful trailing digits like "...PIN:410209,MAHARASHTRA,INDIA".
  out = out.replace(/\s+[A-Z]{0,2}\d{5,}[A-Z]?$/, '').trim();

  out = stripNoiseTokens(out);

  return out.trim();
}

const ANY_LABEL_RE =
  /(name\s*of\s*(father|mother|spouse|legal\s*guardian)|\baddress\b|old\s*passport|file\s*no|place\s*of\s*(issue|birth)|date\s*of\s*(issue|birth|expiry)|nationality|\bsex\b|given\s*name|surname|passport\s*no|\btype\b)/i;

// Barcodes and passport numbers (e.g. "S4093510") often get OCR'd as their
// own line sitting between a label and its real value. They're alphanumeric
// so a plain digits-only check won't catch them — this flags anything that's
// mostly digits or matches the letter(s)+digits shape of a passport number.
function isLikelyIdCode(str) {
  const compact = str.replace(/\s/g, '');
  if (!compact) return false;
  if (/^[A-Z]{0,2}\d{5,}[A-Z]?$/i.test(compact)) return true;
  const digitCount = (compact.match(/\d/g) || []).length;
  return digitCount / compact.length > 0.5;
}

// Name fields (Father / Mother / Spouse) on Indian passports are always
// printed on the line AFTER the label, never inline with it — the label
// itself is often a compound like "Name of Father / Legal Guardian", so
// trying a same-line match risks capturing "Legal Guardian" as if it were
// the value. Go straight to scanning forward.
function extractNameField(lineTexts, labelPattern, { maxLookahead = 3 } = {}) {
  const labelRe = new RegExp(labelPattern, 'i');
  const idx = lineTexts.findIndex((l) => labelRe.test(l) && !COMPOSITE_LABEL_RE.test(l));
  if (idx === -1) return null;

  for (let i = idx + 1; i < lineTexts.length && i <= idx + maxLookahead; i++) {
    const line = (lineTexts[i] || '').trim();
    if (!line) continue;
    if (isLikelyIdCode(line)) continue; // barcode/passport-number line — keep looking
    if (ANY_LABEL_RE.test(line)) break; // hit the next field before finding a value
    const cleaned = cutBeforeNextLabel(line);
    if (cleaned.length >= 3 && !isLikelyIdCode(cleaned)) return cleaned;
  }
  return null;
}

function scanLines(lineTexts, labelPattern, { maxLen = 70 } = {}) {
  const labelRe = new RegExp(labelPattern, 'i');
  const sameLineRe = new RegExp(
    '(?:' + labelPattern + ')[^A-Za-z0-9]{0,15}([A-Za-z0-9][A-Za-z0-9 ,./\\-]{2,' + maxLen + '})',
    'i'
  );

  for (let i = 0; i < lineTexts.length; i++) {
    const line = lineTexts[i];
    if (!labelRe.test(line)) continue;
    if (COMPOSITE_LABEL_RE.test(line)) continue; // "Old Passport No. with Date and Place of Issue" — not the real field

    const sameLineMatch = line.match(sameLineRe);
    if (sameLineMatch) {
      const cleaned = cutBeforeNextLabel(sameLineMatch[1].trim().replace(/\s{2,}/g, ' '));
      if (cleaned.length >= 3) return cleaned;
      // same-line capture was pure noise (e.g. "tio J") — fall through and
      // check the next line instead of giving up
    }

    const next = lineTexts[i + 1];
    if (next) {
      const cleaned = cutBeforeNextLabel(next.trim());
      if (cleaned.length >= 3) return cleaned;
    }
  }
  return null;
}

// Address is the one field on Indian passports that legitimately spans
// multiple OCR lines (street line, locality/city line, PIN+state line).
// scanLines() only ever grabs a single line, so it truncates real addresses
// like "FLAT NO.701,PRATHAMESH VILLA,SECTOR-18 / PLOT NO. 28,KAMOTHE,NAVI
// MUMBAI / PIN:410209,MAHARASHTRA,INDIA" down to just the first line.
// This walks forward from the "Address" label, collecting lines until it
// hits another known label (Old Passport No., File No., ...) or a blank line.
const ADDRESS_STOP_RE =
  /(old\s*passport|file\s*no|place\s*of\s*issue|date\s*of\s*issue|date\s*of\s*expiry|nationality|\bsex\b|given\s*name|surname|passport\s*no|name\s*of\s*(father|mother|spouse|legal\s*guardian))/i;

function extractAddress(lineTexts, { maxLines = 5 } = {}) {
  const labelIdx = lineTexts.findIndex((l) => /\baddress\b/i.test(l));
  if (labelIdx === -1) return null;

  const parts = [];
  const labelLine = lineTexts[labelIdx];
  const addressWordMatch = labelLine.match(/\baddress\b/i);

  // Content AFTER "address" on the same line, e.g. "Address: 12 Example St"
  // (rare on Indian passports, but keep it working).
  const afterMatch = labelLine.match(/address[^A-Za-z0-9]{0,15}([A-Za-z0-9][A-Za-z0-9 ,./\-]{2,70})/i);
  if (afterMatch && afterMatch[1].trim().length >= 3 && !ADDRESS_STOP_RE.test(afterMatch[1])) {
    parts.push(cutBeforeNextLabel(afterMatch[1].trim().replace(/\s{2,}/g, ' ')));
  } else if (addressWordMatch) {
    // Content BEFORE "address" on the same line — happens when OCR reads
    // the real value first and a garbled label fragment trails it, e.g.
    // "FLATNO.701,PRATHAMESH VILLA,SECTOR-18 T/AddreSS".
    const before = cutBeforeNextLabel(labelLine.slice(0, addressWordMatch.index)).trim();
    if (before.length >= 3) parts.push(before);
  }

  for (let i = labelIdx + 1; i < lineTexts.length && parts.length < maxLines; i++) {
    const line = (lineTexts[i] || '').trim();
    if (!line) break; // blank line = end of the address block
    if (ADDRESS_STOP_RE.test(line)) break; // next field's label = end of the address block
    parts.push(cutBeforeNextLabel(line).replace(/\s{2,}/g, ' '));
  }

  const joined = parts.filter(Boolean).join(', ').trim();
  return joined.length >= 3 ? joined : null;
}

function extractLabeledFields(fullText, lineTexts) {
  const lines = lineTexts && lineTexts.length ? lineTexts : fullText.split('\n');
  const joined = fullText.replace(/\r/g, '');

  const address = extractAddress(lines);
  const placeOfBirth = scanLines(lines, 'place\\s*of\\s*birth');
  const placeOfIssue = scanLines(lines, 'place\\s*of\\s*issue');
  const fatherName = extractNameField(lines, 'name\\s*of\\s*father|legal\\s*guardian');
  const motherName = extractNameField(lines, 'name\\s*of\\s*mother');
  const spouseName = extractNameField(lines, 'name\\s*of\\s*spouse');
  const fileNo = scanLines(lines, 'file\\s*no');

  const dateOfIssueMatch = joined.match(/date\s*of\s*issue[^0-9]{0,15}(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})/i);
  const dateOfExpiryMatch = joined.match(/date\s*of\s*expiry[^0-9]{0,15}(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})/i);
  const dobMatch = joined.match(/date\s*of\s*birth[^0-9]{0,15}(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})/i);

  const sexMatch = joined.match(/\bSex\b[^A-Za-z]{0,10}([MF])\b/i);
  const nationalityMatch = joined.match(/nationality[^A-Za-z]{0,15}([A-Za-z]{3,})/i);

  const passportNoMatch = joined.match(/passport\s*no\.?[^A-Za-z0-9]{0,10}([A-Z][0-9]{6,8})/i);

  const typeMatch = joined.match(/\bType\b[^A-Za-z0-9]{0,10}\b(P|PD|PN)\b/i);

  return {
    address,
    placeOfBirth,
    placeOfIssue,
    fatherName,
    motherName,
    spouseName,
    fileNo,
    dateOfIssue: dateOfIssueMatch?.[1] || null,
    dateOfExpiry: dateOfExpiryMatch?.[1] || null,
    dateOfBirth: dobMatch?.[1] || null,
    sex: sexMatch?.[1]?.toUpperCase() || null,
    nationality: nationalityMatch?.[1]?.toUpperCase() || null,
    passportNumber: passportNoMatch?.[1]?.toUpperCase() || null,
    documentType: typeMatch?.[1]?.toUpperCase() || null,
    name: null
  };
}