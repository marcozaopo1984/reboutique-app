/**
 * ============================================
 *  IMPORT CLIENT EXCEL DATA  →  FIRESTORE
 * ============================================
 *
 * Usage:
 *   npx ts-node scripts/import-excel.ts --holder=UID --dry
 *   npx ts-node scripts/import-excel.ts --holder=UID
 *
 */

import * as admin from 'firebase-admin';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';


const args = process.argv.slice(2);
const holderId = args.find(a => a.startsWith('--holder='))?.split('=')[1];
const dryRun = args.includes('--dry');
const csvOnly = args.includes('--csv-only');

// colleziona le righe per ogni "collezione" logica
const csvBuffers: Record<string, any[]> = {};


if (!holderId) {
  console.error('❌ ERROR: missing --holder=HOLDER_UID');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}
const db = admin.firestore();

console.log(`
==========================================
🔥 STARTING IMPORT FOR HOLDER: ${holderId}
Dry run: ${dryRun ? 'YES (no writes)' : 'NO (writes enabled)'}
CSV only: ${csvOnly ? 'YES (no Firestore writes, only CSV output)' : 'NO'}
==========================================
`);

async function write(colPath: string, data: any) {
  // Modalità CSV-ONLY: non tocchiamo Firestore, accumuliamo in memoria
  if (csvOnly) {
    if (!csvBuffers[colPath]) csvBuffers[colPath] = [];
    const id = `row_${csvBuffers[colPath].length + 1}`;
    const row = { id, ...clean(data) };
    csvBuffers[colPath].push(row);
    console.log(`📄 [CSV-ONLY] Captured row for ${colPath}`);
    return { id };
  }

  // Modalità DRY-RUN: log a console, niente Firestore
  if (dryRun) {
    console.log(`🟡 [DRY] Would write to ${colPath}:`, clean(data));
    return { id: 'dry_' + Math.random() };
  }

  // Modalità normale: scrittura reale su Firestore
  const ref = db.collection(colPath).doc();
  await ref.set(clean(data));
  console.log(`🟢 Wrote ${colPath}/${ref.id}`);
  return ref;
}


function clean(data: any) {
  const out: any = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && v !== null && v !== '') {
      out[k] = v;
    }
  }
  return out;
}

function findSheet(wb: XLSX.WorkBook, candidates: string[]) {
  const normalized = wb.SheetNames.map(n => n.toLowerCase().trim());
  for (const name of candidates) {
    const idx = normalized.indexOf(name.toLowerCase().trim());
    if (idx !== -1) return wb.Sheets[wb.SheetNames[idx]];
  }
  return undefined;
}

function loadRows(sheet: XLSX.WorkSheet) {
  return XLSX.utils.sheet_to_json(sheet) as Record<string, any>[];
}

function writeCsvFiles() {
  const outDir = path.join(__dirname, '..', 'mnt', 'preview');
  fs.mkdirSync(outDir, { recursive: true });

  for (const [colPath, rows] of Object.entries(csvBuffers)) {
    if (!rows || rows.length === 0) continue;

    // nome file "sanitizzato"
    const fileName = colPath.replace(/[\/\\]/g, '__') + '.csv';
    const filePath = path.join(outDir, fileName);

    // headers = unione di tutte le chiavi
    const headerSet = new Set<string>();
    for (const row of rows) {
      Object.keys(row).forEach(k => headerSet.add(k));
    }
    const headers = Array.from(headerSet);

    const lines: string[] = [];

    // riga header
    lines.push(headers.join(','));

    // righe dati
    for (const row of rows) {
      const values = headers.map(h => {
        const v = (row as any)[h];
        if (v === undefined || v === null) return '';
        const s = v instanceof Date ? v.toISOString() : String(v);
        const escaped = s.replace(/"/g, '""');
        return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
      });
      lines.push(values.join(','));
    }

    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log(`📄 CSV written: ${filePath}`);
  }
}


////////////////////////////////////////////////////////////////////////////////
// 1️⃣ IMPORT TENANTS
////////////////////////////////////////////////////////////////////////////////

async function importTenants() {
  const file = path.join(__dirname, '..', 'mnt', 'data', 'Conduttori.xlsx');
  const wb = XLSX.readFile(file);
  const sheet = findSheet(wb, ['Current']);
  if (!sheet) throw new Error('❌ Missing sheet "Current" in Conduttori');

  const rows = loadRows(sheet);
  console.log(`➡ Found ${rows.length} tenants`);

  const tenantMap: Record<string, string> = {};

  for (const row of rows) {
    const firstName = row['Name'] || row['Nome'];
    const lastName = row['Surname'] || row['Cognome'];

    if (!firstName || !lastName) continue;

    const data = clean({
      firstName,
      lastName,
      email: row['Email'],
      phone: row['Phone'],
      nationality: row['nationality'],
      euCitizen: row['EU/Not EU'] === 'EU',
      birthday: row['Birthday'] ? new Date(row['Birthday']) : undefined,
      deposit: row['Deposit'],
      adminFee: row['Admin fee'],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const ref = await write(`holders/${holderId}/tenants`, data);
    tenantMap[`${firstName} ${lastName}`.trim()] = ref.id;
  }

  return tenantMap;
}

////////////////////////////////////////////////////////////////////////////////
// 2️⃣ IMPORT PROPERTIES
////////////////////////////////////////////////////////////////////////////////

async function importProperties() {
  const file = path.join(__dirname, '..', 'mnt', 'data', 'Prezzi e disponibilità.xlsx');

  const wb = XLSX.readFile(file);
  const sheet = findSheet(wb, ['Master', 'MASTER']);
  if (!sheet) throw new Error('❌ Missing sheet "Master" in Prezzi');

  const rows = loadRows(sheet);
  console.log(`➡ Found ${rows.length} properties`);

  const propertyMap: Record<string, string> = {};

  for (const row of rows) {
    const code = row['Flat'] || row['Codice'] || row['Code'];
    if (!code) continue;

    const type =
      row['room'] !== undefined ? 'ROOM' :
      row['Bed'] !== undefined ? 'BED' :
      'APARTMENT';

    const data = clean({
      code,
      name: row['app'] || code,
      type,
      roomSizeM2: row['room size'],
      baseMonthlyRent: row['Prices'],
      monthlyUtilities: row['€/ Monthly Utilities'],
      depositMonths: row['Deposit (months)'],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const ref = await write(`holders/${holderId}/properties`, data);
    propertyMap[code] = ref.id;
  }

  return propertyMap;
}

////////////////////////////////////////////////////////////////////////////////
// 3️⃣ IMPORT LEASES
////////////////////////////////////////////////////////////////////////////////

async function importLeases(tenantMap: any, propertyMap: any) {
  const file = path.join(__dirname, '..', 'mnt', 'data', 'Gestionalone.xlsx');
  console.log(`\n📘 Reading leases from ${file}`);

  const wb = XLSX.readFile(file);
  const sheet = findSheet(wb, ['Contratti', 'CONTRATTI']);

  if (!sheet) {
    throw new Error('❌ Missing sheet "Contratti" in Gestionalone.xlsx');
  }

  const rows = loadRows(sheet);
  console.log(`➡ Found ${rows.length} leases`);

  const leaseMap: Record<string, string> = {};

  for (const row of rows) {
    const tenantKey = `${row['Nome']} ${row['Cognome']}`.trim();
    const tenantId = tenantMap[tenantKey];

    const propertyCode = row['Appartamento'] || row['Flat'];
    const propertyId = propertyMap[propertyCode];

    // Se non riusciamo a mappare tenant o property
    if (!tenantId || !propertyId) {
      if (csvOnly) {
        const unmatchedData = clean({
          tenantKey,
          tenantId: tenantId ?? null,
          propertyCode,
          propertyId: propertyId ?? null,
          startDateRaw: row['Data Inizio'] ?? null,
          expectedEndDateRaw: row['Data Fine'] ?? null,
          monthlyRent: row['Valore Contratto Mensile'],
          depositAmount: row['Deposito Versato'],
          note: 'UNMATCHED_LEASE_MISSING_TENANT_OR_PROPERTY',
        });

        await write(
          `holders/${holderId}/leases_unmatched`,
          unmatchedData,
        );
      }
      continue; // non crea un lease "valido"
    }

    const data = clean({
      tenantId,
      propertyId,
      startDate: row['Data Inizio'] ? new Date(row['Data Inizio']) : undefined,
      expectedEndDate: row['Data Fine'] ? new Date(row['Data Fine']) : undefined,
      monthlyRent: row['Valore Contratto Mensile'],
      depositAmount: row['Deposito Versato'],
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const ref = await write(`holders/${holderId}/leases`, data);

    // chiave di mappatura tenant+property, usata poi per i pagamenti
    leaseMap[`${tenantKey}_${propertyCode}`] = ref.id;
  }

  return leaseMap;
}

////////////////////////////////////////////////////////////////////////////////
// 4️⃣ IMPORT EXPENSES
////////////////////////////////////////////////////////////////////////////////

async function importExpenses(propertyMap: any) {
  const file = path.join(__dirname, '..', 'mnt', 'data', 'Gestionalone.xlsx');
  console.log(`\n📘 Reading expenses from ${file}`);

  const wb = XLSX.readFile(file);
  const sheet = findSheet(wb, ['Database Costi', 'DATABASE COSTI']);

  if (!sheet) {
    console.log('⚠️ No "Database Costi" sheet → skipping expenses');
    return;
  }

  const rows = loadRows(sheet);
  console.log(`➡ Found ${rows.length} expenses`);

  for (const row of rows) {
    const propertyCode = row['Appartamento'] || row['Flat'];
    const propertyId = propertyMap[propertyCode];

    // Se non troviamo la property per quella spesa
    if (!propertyId) {
      if (csvOnly) {
        const unmatched = clean({
          propertyCode,
          propertyId: null,
          type: row['Tipologia'],
          description: row['Dettaglio'],
          amount: row['Costo'],
          costDateRaw: row['Data Spesa'] ?? null,
          costMonth: row['Mese Spesa'],
          frequency: row['Frequenza'],
          note: 'UNMATCHED_EXPENSE_MISSING_PROPERTY',
        });

        await write(
          `holders/${holderId}/expenses_unmatched`,
          unmatched,
        );
      }
      continue;
    }

    const data = clean({
      propertyId,
      type: row['Tipologia'],
      description: row['Dettaglio'],
      amount: row['Costo'],
      currency: 'EUR',
      costDate: row['Data Spesa'] ? new Date(row['Data Spesa']) : undefined,
      costMonth: row['Mese Spesa'],
      frequency: row['Frequenza'] || 'ONCE',
      scope: 'UNIT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await write(`holders/${holderId}/expenses`, data);
  }
}


////////////////////////////////////////////////////////////////////////////////
// 5️⃣ GENERATE PAYMENTS (FROM CONDUTTORI)
////////////////////////////////////////////////////////////////////////////////

function monthRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const d = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (d <= last) {
    dates.push(new Date(d.getFullYear(), d.getMonth(), 1));
    d.setMonth(d.getMonth() + 1);
  }
  return dates;
}



async function generatePaymentsFromConduttori(
  tenantMap: any,
  propertyMap: any,
  leaseMap: any,
) {
  const file = path.join(__dirname, '..', 'mnt', 'data', 'Conduttori.xlsx');
  console.log(`\n📘 Generating payments from ${file}`);

  const wb = XLSX.readFile(file);

  const currentSheet = findSheet(wb, ['Current']);
  const pastSheet = findSheet(wb, ['Past Tenants', 'Past']);

  if (!currentSheet && !pastSheet) {
    console.log('⚠️ No Current/Past Tenants sheets → skipping payments generation');
    return;
  }

  const rows = [
    ...(currentSheet ? loadRows(currentSheet) : []),
    ...(pastSheet ? loadRows(pastSheet) : []),
  ];

  console.log(`➡ Found ${rows.length} total tenant rows for payment reconstruction`);

  for (const row of rows) {
    const firstName = row['Name'] || row['Nome'];
    const lastName = row['Surname'] || row['Cognome'];
    const flatCode = row['Flat'] || row['Apartment'];

    const rentFrom = row['Rent From - Month'] || row['Start of rental'];
    const rentEnd = row['Rent End - Month'] || row['Expected end of rental'];
    const monthlyRent = row['Monthly rent (bills included)'];

    if (!firstName || !lastName || !flatCode || !rentFrom || !rentEnd || !monthlyRent) {
      // dati insufficienti per ricostruire un piano pagamenti
      if (csvOnly) {
        const unmatched = clean({
          firstName,
          lastName,
          flatCode,
          rentFrom,
          rentEnd,
          monthlyRent,
          note: 'UNMATCHED_PAYMENT_INCOMPLETE_ROW',
        });
        await write(
          `holders/${holderId}/payments_unmatched`,
          unmatched,
        );
      }
      continue;
    }

    const tenantKey = `${firstName} ${lastName}`.trim();
    const tenantId = tenantMap[tenantKey];
    const propertyId = propertyMap[flatCode];
    const leaseKey = `${tenantKey}_${flatCode}`;
    const leaseId = leaseMap[leaseKey];

    if (!tenantId || !propertyId || !leaseId) {
      if (csvOnly) {
        const unmatched = clean({
          tenantKey,
          flatCode,
          tenantId: tenantId ?? null,
          propertyId: propertyId ?? null,
          leaseId: leaseId ?? null,
          rentFrom,
          rentEnd,
          monthlyRent,
          note: 'UNMATCHED_PAYMENT_MISSING_TENANT_PROPERTY_OR_LEASE',
        });
        await write(
          `holders/${holderId}/payments_unmatched`,
          unmatched,
        );
      }
      continue;
    }

    const start = new Date(rentFrom);
    const end = new Date(rentEnd);
    const months = monthRange(start, end);

    for (const d of months) {
      const data = clean({
        tenantId,
        propertyId,
        leaseId,
        amount: monthlyRent,
        currency: 'EUR',
        dueDate: d,
        status: 'PLANNED',
        kind: 'RENT',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await write(`holders/${holderId}/payments`, data);
    }
  }
}


////////////////////////////////////////////////////////////////////////////////
// 🏁 MAIN
////////////////////////////////////////////////////////////////////////////////

(async () => {
  console.log('➡ Importing Tenants...');
  const tenantMap = await importTenants();

  console.log('\n➡ Importing Properties...');
  const propertyMap = await importProperties();

  console.log('\n➡ Importing Leases...');
  const leaseMap = await importLeases(tenantMap, propertyMap);

  console.log('\n➡ Importing Expenses...');
  await importExpenses(propertyMap);

  console.log('\n➡ Generating Payments from Conduttori...');
  await generatePaymentsFromConduttori(tenantMap, propertyMap, leaseMap);

  console.log('\n🎉 DONE!');

  if (csvOnly) {
    console.log('\n📝 Writing CSV preview files...');
    writeCsvFiles();
  }
})();