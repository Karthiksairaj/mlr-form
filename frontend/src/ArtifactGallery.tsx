import { useEffect, useState } from 'react';
import { authHeaders, errorMessage, responseError } from './api';
import type { Artifact } from './types';

function ArtifactCard({ artifact, token }: { artifact: Artifact; token: string }) {
  const [objectUrl, setObjectUrl] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let blobUrl: string | undefined;
    setObjectUrl('');
    setError('');
    async function load() {
      try {
        const response = await fetch(artifact.url, { headers: authHeaders(token), signal: controller.signal });
        if (!response.ok) throw await responseError(response);
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        blobUrl = URL.createObjectURL(blob);
        setObjectUrl(blobUrl);
      } catch (failure) {
        if (!controller.signal.aborted) setError(errorMessage(failure));
      }
    }
    void load();
    return () => {
      controller.abort();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [artifact.url, token, attempt]);

  const pdf = artifact.contentType === 'application/pdf';
  return <figure className={`artifact ${pdf ? 'artifact-pdf' : ''}`}>
    {objectUrl ? <a href={objectUrl} target="_blank" rel="noopener noreferrer" title={pdf ? 'Open generated PDF' : 'Open full-size screenshot'}>
      {pdf ? <div className="pdf-preview"><span>PDF</span><strong>Form report</strong><small>Open generated PDF ↗</small></div>
        : <img src={objectUrl} alt={artifact.stage} loading="lazy" />}
    </a> : <div className="artifact-placeholder">{error ? <><p role="alert">{error}</p><button type="button" className="text-button" onClick={() => setAttempt(value => value + 1)}>Retry preview</button></> : 'Loading preview…'}</div>}
    <figcaption>{artifact.stage}<span>{pdf ? 'PDF report' : 'Screenshot · click to expand'}</span></figcaption>
  </figure>;
}

export function ArtifactGallery({ artifacts, token }: { artifacts: Artifact[]; token: string }) {
  return <section className="evidence-section" aria-labelledby="evidence-title">
    <div className="section-heading"><h3 id="evidence-title">Screenshots & reports</h3><span className="count">{artifacts.length}</span></div>
    <div id="artifacts" className="artifacts">{artifacts.map(artifact => <ArtifactCard key={artifact.url} artifact={artifact} token={token} />)}</div>
  </section>;
}
