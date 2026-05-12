'use client';

import { useState, useEffect, useRef } from 'react';

interface Doc {
  id: string;
  name: string;
  type: string;
  uploaded_at: string;
  chunk_count: number;
  status: 'processing' | 'ready' | 'error';
}

interface UploadProgress {
  phase: 'parsing' | 'embedding';
  embedded: number;
  total: number;
}

const STATUS_STYLES = {
  ready: 'bg-green-100 text-green-700',
  processing: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
};

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<'file' | 'url'>('file');
  const [url, setUrl] = useState('');
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const res = await fetch('/api/admin/documents');
    if (res.ok) setDocs(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function runEmbedding(docId: string, totalChunks: number) {
    let embedded = 0;
    setProgress({ phase: 'embedding', embedded: 0, total: totalChunks });

    while (true) {
      const res = await fetch(`/api/admin/documents/${docId}/embed`, { method: 'POST' });
      if (!res.ok) {
        setError('Embedding failed. The document was saved but may not be searchable.');
        break;
      }
      const data = await res.json();
      embedded += data.embedded;
      setProgress({ phase: 'embedding', embedded, total: totalChunks });
      if (data.done) break;
    }
  }

  async function handleUpload(body: FormData | { url: string }) {
    setError('');
    setProgress({ phase: 'parsing', embedded: 0, total: 0 });

    const isJson = !(body instanceof FormData);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    let res: Response;
    try {
      res = await fetch('/api/admin/documents', {
        method: 'POST',
        signal: controller.signal,
        ...(isJson
          ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
          : { body }),
      });
    } catch {
      clearTimeout(timeout);
      setError('Parsing timed out. Try a smaller file, or split large documents into parts.');
      setProgress(null);
      return;
    }
    clearTimeout(timeout);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Upload failed');
      setProgress(null);
      return;
    }

    const { id, totalChunks } = await res.json();
    await runEmbedding(id, totalChunks);

    setProgress(null);
    setShowModal(false);
    setUrl('');
    if (fileRef.current) fileRef.current.value = '';
    await load();
  }

  async function deleteDoc(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await fetch(`/api/admin/documents/${id}`, { method: 'DELETE' });
    setDocs((prev) => prev.filter((d) => d.id !== id));
  }

  function openModal() {
    setError('');
    setUrl('');
    setProgress(null);
    setShowModal(true);
  }

  const uploading = progress !== null;

  const progressPct =
    progress?.phase === 'embedding' && progress.total > 0
      ? Math.round((progress.embedded / progress.total) * 100)
      : null;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Documents</h1>
          <p className="text-sm text-gray-500 mt-0.5">Indexed documents teammates can ask questions about</p>
        </div>
        <button
          onClick={openModal}
          className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Add Document
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : docs.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-sm">No documents yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Chunks</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Added</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {docs.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{doc.name}</td>
                  <td className="px-4 py-3 text-gray-500 uppercase text-xs tracking-wide">{doc.type}</td>
                  <td className="px-4 py-3 text-gray-500">{doc.chunk_count}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[doc.status]}`}>
                      {doc.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(doc.uploaded_at).toLocaleDateString()}
</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteDoc(doc.id, doc.name)}
                      className="text-red-500 hover:text-red-700 text-xs transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold">Add Document</h2>
              {!uploading && (
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">
                  ×
                </button>
              )}
            </div>

            {!uploading && (
              <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-1">
                {(['file', 'url'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); setError(''); }}
                    className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                      mode === m ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {m === 'file' ? 'Upload File' : 'Website URL'}
                  </button>
                ))}
              </div>
            )}

            {uploading ? (
              <div className="py-4 space-y-4">
                <p className="text-sm text-gray-600 text-center">
                  {progress?.phase === 'parsing'
                    ? 'Parsing document…'
                    : `Embedding chunks… ${progress?.embedded} / ${progress?.total}`}
                </p>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressPct ?? 5}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 text-center">
                  {progressPct !== null ? `${progressPct}%` : 'Starting…'}
                </p>
              </div>
            ) : mode === 'file' ? (
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 transition-colors"
              >
                <p className="text-sm text-gray-500">Click to select a file</p>
                <p className="text-xs text-gray-400 mt-1">PDF, TXT, PPTX, XLSX, CSV</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.txt,.md,.pptx,.xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const form = new FormData();
                      form.append('file', file);
                      handleUpload(form);
                    }
                  }}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/page"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleUpload({ url })}
                />
                <button
                  onClick={() => handleUpload({ url })}
                  disabled={!url.trim()}
                  className="w-full rounded-lg bg-blue-600 text-white py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  Index URL
                </button>
              </div>
            )}

            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
