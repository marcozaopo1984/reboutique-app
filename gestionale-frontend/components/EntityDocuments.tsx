'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '@/lib/firebaseClient';
import { fetchWithAuth } from '@/lib/apiClient';

type EntityKind = 'tenants' | 'leases' | 'properties' | 'payments' | 'expenses' | 'landlords';

type FileDoc = {
  id: string;
  fileName?: string;
  storagePath?: string;
  path?: string;
  downloadUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
  createdAt?: any;
};

function bytesToSize(n?: number) {
  if (n === undefined || n === null) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function EntityDocuments(props: {
  entityKind: EntityKind;
  entityId: string;
  label?: string;
}) {
  const { entityKind, entityId, label } = props;

  const holderId = auth.currentUser?.uid; // in questo progetto holderId = uid
  const baseApi = useMemo(() => `/${entityKind}/${entityId}/files`, [entityKind, entityId]);

  const [files, setFiles] = useState<FileDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<File | null>(null);

  // ✅ per aprire file picker via bottone
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await fetchWithAuth(baseApi)) as FileDoc[];
      setFiles(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message ?? 'Errore caricamento documenti');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseApi]);

  const openPicker = () => {
    // i browser permettono l’apertura del picker SOLO su gesto utente (click) ✅
    fileInputRef.current?.click();
  };

  const handleUpload = async () => {
    setError(null);

    if (!holderId) return setError('Utente non autenticato (holderId mancante)');
    if (!selected) return setError('Seleziona un file');

    setBusy(true);
    try {
      // path coerente con storage rules: holders/{holderId}/{entityKind}/{entityId}/files/...
      const storagePath = `holders/${holderId}/${entityKind}/${entityId}/files/${selected.name}`;

      // 1) Upload su Firebase Storage
      const sref = storageRef(storage, storagePath);
      await uploadBytes(sref, selected);

      // 2) Download URL
      const downloadUrl = await getDownloadURL(sref);

      // 3) Salva metadati su Firestore via backend
      const payload = {
        fileName: selected.name,
        storagePath,
        downloadUrl,
        mimeType: selected.type || undefined,
        sizeBytes: selected.size || undefined,
      };

      await fetchWithAuth(baseApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setSelected(null);
      // reset input (così puoi ricaricare lo stesso file se vuoi)
      if (fileInputRef.current) fileInputRef.current.value = '';

      await loadFiles();
    } catch (e: any) {
      setError(e?.message ?? 'Errore upload documento');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (fileId: string) => {
    setError(null);
    setBusy(true);
    try {
      await fetchWithAuth(`${baseApi}/${fileId}`, { method: 'DELETE' });
      await loadFiles();
    } catch (e: any) {
      setError(e?.message ?? 'Errore eliminazione documento');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 border rounded-lg p-3 bg-slate-50">
      <div className="font-medium mb-2">{label ?? 'Documenti'}</div>

      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}

      {/* ✅ file input nascosto + bottone che apre file picker */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => setSelected(e.target.files?.[0] ?? null)}
        disabled={busy}
      />

      <div className="flex flex-col md:flex-row gap-2 md:items-center">
        <button
          type="button"
          onClick={openPicker}
          disabled={busy}
          className="px-3 py-2 text-sm rounded border bg-white hover:bg-slate-50 disabled:opacity-50"
        >
          Seleziona file
        </button>

        <div className="text-sm text-slate-700">
          {selected ? (
            <>
              <span className="font-medium">{selected.name}</span>{' '}
              <span className="text-slate-500">({bytesToSize(selected.size)})</span>
            </>
          ) : (
            <span className="text-slate-500">Nessun file selezionato</span>
          )}
        </div>

        <button
          type="button"
          onClick={handleUpload}
          disabled={busy || !selected}
          className="px-3 py-2 text-sm rounded bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {busy ? 'Operazione in corso...' : 'Carica documento'}
        </button>

        <button
          type="button"
          onClick={loadFiles}
          disabled={busy}
          className="px-3 py-2 text-sm rounded border bg-white hover:bg-slate-50 disabled:opacity-50"
        >
          Aggiorna lista
        </button>
      </div>

      {/* Lista */}
      <div className="mt-3">
        {loading ? (
          <div className="text-sm text-slate-600">Caricamento documenti...</div>
        ) : files.length === 0 ? (
          <div className="text-sm text-slate-500">Nessun documento.</div>
        ) : (
          <div className="space-y-2">
            {files.map((f) => {
              const url = f.downloadUrl;
              const sp = f.storagePath ?? f.path;
              return (
                <div key={f.id} className="flex items-center justify-between border rounded p-2 bg-white">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{f.fileName ?? 'Documento'}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {bytesToSize(f.sizeBytes)} {f.mimeType ? `· ${f.mimeType}` : ''} {sp ? `· ${sp}` : ''}
                    </div>
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Apri / scarica
                      </a>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(f.id)}
                    disabled={busy}
                    className="text-sm text-red-600 hover:underline disabled:opacity-50"
                  >
                    Elimina
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
