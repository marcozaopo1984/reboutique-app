'use client';

import React, { useEffect, useState, FormEvent, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, storage } from '../../lib/firebaseClient';
import { fetchWithAuth } from '../../lib/apiClient';
import { useRouter } from 'next/navigation';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface Tenant {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

interface TenantFile {
  id: string;
  fileName: string;
  storagePath: string;
  downloadUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadedAt?: string;
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [holderId, setHolderId] = useState<string | null>(null); 
  const router = useRouter();

  // form create tenant
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [email, setEmail]         = useState('');
  const [phone, setPhone]         = useState('');
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // files state per-tenant
  const [fileInputs, setFileInputs] = useState<Record<string, File | null>>({});
  const [uploading, setUploading]   = useState<Record<string, boolean>>({});
  const [files, setFiles]           = useState<Record<string, TenantFile[]>>({});
  const [loadingFiles, setLoadingFiles] = useState<Record<string, boolean>>({});
  const [fileError, setFileError]   = useState<string | null>(null);

  // ref agli input file per-tenant (per aprire il picker con un bottone)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }
      setUserEmail(user.email ?? user.uid);
      setHolderId(user.uid);
      try {
        const data = await fetchWithAuth('/tenants');
        setTenants(data);
        setLoading(false);
      } catch (err: any) {
        setError(err.message ?? 'Error fetching tenants');
        setLoading(false);
      }
    });
    return () => unsub();
  }, [router]);

  const handleCreateTenant = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setFormError('First name e Last name sono obbligatori');
      return;
    }

    setSaving(true);
    try {
      const body = {
        firstName: firstName.trim(),
        lastName : lastName.trim(),
        email    : email.trim() || undefined,
        phone    : phone.trim() || undefined,
      };
      const created: Tenant = await fetchWithAuth('/tenants', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setTenants((prev) => [...prev, created]);
      setFirstName(''); setLastName(''); setEmail(''); setPhone('');
    } catch (err: any) {
      setFormError(err.message ?? 'Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
  };

  // ------- FILES -------

  const onFileChange = (tenantId: string, f: File | null) => {
    setFileInputs((prev) => ({ ...prev, [tenantId]: f }));
  };

  const loadFiles = async (tenantId: string) => {
  setLoadingFiles((p) => ({ ...p, [tenantId]: true }));
  try {
    const list: TenantFile[] = await fetchWithAuth(`/tenants/${tenantId}/files`);
    console.log('GET files for', tenantId, list);
    setFiles((prev) => ({ ...prev, [tenantId]: list }));
  } catch (err: any) {
    setFileError(err.message ?? 'Errore caricamento lista file');
    // 🔎 NON sovrascrivere la lista con [] in caso di errore
  } finally {
    setLoadingFiles((p) => ({ ...p, [tenantId]: false }));
  }
};


 const uploadForTenant = async (tenantId: string) => {
  setFileError(null);
  const f = fileInputs[tenantId];
  if (!f) {
    setFileError('Seleziona un file prima di caricare');
    return;
  }
  setUploading((p) => ({ ...p, [tenantId]: true }));
  if (!holderId) {
  setFileError('Holder non inizialized reload page and retry)');
  return;}
  try {
    const safeName = f.name.replace(/\s+/g, '_');
    const storagePath = `holders/${holderId}/tenants/${tenantId}/files/${safeName}`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, f);
    const downloadUrl = await getDownloadURL(storageRef);

    const meta = {
      fileName: safeName,
      storagePath,
      downloadUrl,
      mimeType: f.type || 'application/octet-stream',
      sizeBytes: f.size,
    };

    const created: TenantFile = await fetchWithAuth(`/tenants/${tenantId}/files`, {
      method: 'POST',
      body: JSON.stringify(meta),
    });
    console.log('Created meta', created);

    
    await loadFiles(tenantId);

    // pulisci input
    setFileInputs((prev) => ({ ...prev, [tenantId]: null }));
  } catch (err: any) {
    setFileError(err.message ?? 'Errore durante upload/metadati');
  } finally {
    setUploading((p) => ({ ...p, [tenantId]: false }));
  }
};


const deleteFile = async (tenantId: string, fileId: string) => {
  try {
    await fetchWithAuth(`/tenants/${tenantId}/files/${fileId}`, {
      method: 'DELETE',
    });
    await loadFiles(tenantId);   // ricarica la lista dopo la cancellazione
  } catch (err: any) {
    setFileError(err.message ?? 'Errore durante delete');
  }
};

  if (loading) return <div className="p-4">Loading tenants...</div>;
  if (error)   return <div className="p-4 text-red-500">Error: {error}</div>;

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6">
      <p className="text-sm">
        Logged as: <strong>{userEmail}</strong>
      </p>
      <h1 className="text-2xl font-semibold">Tenants</h1>

      {/* FORM CREAZIONE TENANT */}
      <div className="border rounded-md p-4 bg-slate-50">
        <h2 className="text-lg font-semibold mb-3">Add new tenant</h2>
        <form onSubmit={handleCreateTenant} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm mb-1">First name *</label>
            <input className="w-full border rounded-md px-2 py-1 text-sm"
              value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1">Last name *</label>
            <input className="w-full border rounded-md px-2 py-1 text-sm"
              value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input type="email" className="w-full border rounded-md px-2 py-1 text-sm"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1">Phone</label>
            <input className="w-full border rounded-md px-2 py-1 text-sm"
              value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="md:col-span-4 flex justify-end mt-1">
            <button type="submit" disabled={saving}
              className="border rounded-md px-4 py-1 text-sm disabled:opacity-60">
              {saving ? 'Saving...' : 'Save tenant'}
            </button>
          </div>
        </form>
        {formError && <p className="text-red-500 text-sm mt-2">{formError}</p>}
      </div>

      {/* TABELLA TENANTS + UPLOAD */}
      {tenants.length === 0 ? (
        <p>No tenants found.</p>
      ) : (
        <table className="min-w-full border text-sm">
          <thead>
            <tr className="bg-slate-100">
              <th className="border px-2 py-1 text-left">Name</th>
              <th className="border px-2 py-1 text-left">Email</th>
              <th className="border px-2 py-1 text-left">Phone</th>
              <th className="border px-2 py-1 text-left">Files</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => {
              const isUploading = !!uploading[t.id];
              const fList = files[t.id] || [];
              const isLoadingList = !!loadingFiles[t.id];

              return (
                <tr key={t.id} className="align-top">
                  <td className="border px-2 py-1">{t.firstName} {t.lastName}</td>
                  <td className="border px-2 py-1">{t.email ?? '-'}</td>
                  <td className="border px-2 py-1">{t.phone ?? '-'}</td>
                  <td className="border px-2 py-1">
                    {/* Selettore + azioni */}
                    <div className="flex items-center gap-2 mb-2">
                      {/* input file nascosto */}
                      <input
                        ref={(el) => { inputRefs.current[t.id] = el; }} 
                        type="file"
                        accept=".pdf,image/*"
                        className="hidden"
                        onChange={(e) => onFileChange(t.id, e.target.files?.[0] ?? null)}
                      />

                      {/* SELECT FILE */}
                      <button
                        type="button"
                        onClick={() => inputRefs.current[t.id]?.click()}
                        className="border rounded-md px-2 py-1 text-xs"
                      >
                        Select file
                      </button>

                      {/* UPLOAD */}
                      <button
                        onClick={() => uploadForTenant(t.id)}
                        disabled={isUploading || !fileInputs[t.id]}
                        className="border rounded-md px-2 py-1 text-xs disabled:opacity-60"
                      >
                        {isUploading ? 'Uploading...' : 'Upload'}
                      </button>

                      {/* LOAD FILES */}
                      <button
                        onClick={() => loadFiles(t.id)}
                        className="border rounded-md px-2 py-1 text-xs"
                      >
                        {isLoadingList ? 'Loading...' : 'Load files'}
                      </button>
                    </div>

                    {/* nome del file selezionato */}
                    {fileInputs[t.id]?.name && (
                      <p className="text-xs text-slate-600 mb-2">
                        Selected: <span className="font-medium">{fileInputs[t.id]!.name}</span>
                      </p>
                    )}

                    {/* Lista file */}
                    {fList.length > 0 && (
                      <ul className="list-disc ml-5 space-y-1">
                        {fList.map((file) => (
                          <li key={file.id}>
                            <a
                              href={file.downloadUrl || '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="underline"
                            >
                              {file.fileName}
                            </a>
                            <button
                              onClick={() => deleteFile(t.id, file.id)}
                              className="ml-2 text-red-600 underline"
                            >
                              delete
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {fileError && <p className="text-red-500 text-sm">{fileError}</p>}
    </div>
  );
}
