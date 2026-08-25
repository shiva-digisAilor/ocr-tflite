import React from 'react';

export default function ResultViewer({ result }) {
  return (
    <div className="result-viewer">
      {result ? <p>{result}</p> : <p>No result available.</p>}
    </div>
  );
}