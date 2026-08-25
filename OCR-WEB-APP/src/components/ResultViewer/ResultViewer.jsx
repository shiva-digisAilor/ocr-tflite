const FIELD_LABELS = [
  { key: 'name', label: 'Name' },
  { key: 'dateOfBirth', label: 'Date of Birth' },
  { key: 'nationality', label: 'Nationality' },
  { key: 'passportNumber', label: 'Passport No.' },
  { key: 'sex', label: 'Sex' },
  { key: 'dateOfExpiry', label: 'Date of Expiry' },
  { key: 'dateOfIssue', label: 'Date of Issue' },
  { key: 'placeOfBirth', label: 'Place of Birth' },
  { key: 'placeOfIssue', label: 'Place of Issue' },
  { key: 'address', label: 'Address' },
  { key: 'fatherName', label: 'Name of Father' },
  { key: 'motherName', label: 'Name of Mother' },
  { key: 'spouseName', label: 'Name of Spouse' },
  { key: 'fileNo', label: 'File No.' },
  { key: 'issuingCountry', label: 'Issuing Country' }
];

// Fields that come straight from the check-digit-verified MRZ when it's
// present - shown with a "verified" badge instead of a plain value.
const MRZ_BACKED_FIELDS = new Set(['name', 'dateOfBirth', 'nationality', 'passportNumber', 'sex', 'dateOfExpiry']);

function FieldsPanel({ fields }) {
  if (!fields) return null;
  const mrzOk = fields._meta?.mrzDetected;
  const mrzValid = fields._meta?.mrzValid;

  // Build the exact shape the user asked for as the primary JSON output.
  const primaryJson = {
    name: fields.name,
    dateOfBirth: fields.dateOfBirth,
    nationality: fields.nationality,
    passportNumber: fields.passportNumber,
    address: fields.address,
    fatherName: fields.fatherName,
    motherName: fields.motherName,
    spouseName: fields.spouseName,
    fileNo: fields.fileNo,
    language: fields.language
  };

  return (
    <div className="fields">
      <div className="fields__header">
        <h3>Structured Fields</h3>
        {mrzOk ? (
          <span className={`fields__badge ${mrzValid ? 'fields__badge--ok' : 'fields__badge--warn'}`}>
            {mrzValid ? 'MRZ verified ✓' : 'MRZ found (check digits failed)'}
          </span>
        ) : (
          <span className="fields__badge fields__badge--muted">No MRZ detected</span>
        )}
      </div>

      <dl className="fields__grid">
        {FIELD_LABELS.map(({ key, label }) => {
          const value = fields[key];
          if (!value) return null;
          return (
            <div className="fields__row" key={key}>
              <dt>
                {label}
                {mrzOk && mrzValid && MRZ_BACKED_FIELDS.has(key) && (
                  <span className="fields__verified" title="Confirmed by MRZ check digit">✓</span>
                )}
              </dt>
              <dd>{value}</dd>
            </div>
          );
        })}
      </dl>

      <details className="result__details" open>
        <summary>Structured JSON (name / dateOfBirth / nationality / passportNumber / address / fatherName / motherName / spouseName / fileNo / language)</summary>
        <pre className="result__json">{JSON.stringify(primaryJson, null, 2)}</pre>
      </details>

      <details className="result__details">
        <summary>Full field object (includes MRZ debug info)</summary>
        <pre className="result__json">{JSON.stringify(fields, null, 2)}</pre>
      </details>
    </div>
  );
}

export default function ResultViewer({ imageUrl, result }) {
  if (!imageUrl && !result) return null;

  return (
    <div className="result">
      {imageUrl && (
        <div className="result__image-wrap">
          <img src={imageUrl} alt="Uploaded" className="result__image" />
        </div>
      )}

      {result && (
        <div className="result__text-wrap">
          <FieldsPanel fields={result.fields} />

          <h3>Extracted Text</h3>
          <pre className="result__text">{result.text_extracted || '(no text found)'}</pre>

          {result.location?.length > 0 && (
            <details className="result__details">
              <summary>Line details ({result.location.length} lines)</summary>
              <ul>
                {result.location.map((line, i) => (
                  <li key={i}>
                    <strong>{line.text || JSON.stringify(line)}</strong>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <details className="result__details">
            <summary>Raw JSON</summary>
            <pre className="result__json">
              {JSON.stringify(
                {
                  name: result.name,
                  text_extracted: result.text_extracted,
                  location: result.location
                },
                null,
                2
              )}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}