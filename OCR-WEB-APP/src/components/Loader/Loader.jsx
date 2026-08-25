export default function Loader({ label = 'Loading…' }) {
  return (
    <div className="loader">
      <div className="loader__spinner" />
      <p className="loader__label">{label}</p>
    </div>
  );
}
