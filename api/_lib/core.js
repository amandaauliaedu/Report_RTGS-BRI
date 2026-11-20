import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

const SHEET_ID = process.env.SHEET_ID || '1VH5vk5rT3sOhE-XP3zpxbmdfXiCmo2nSNnxA7daNcNc';
const RESPONSE_TAB = process.env.RESPONSE_TAB || 'Form Response';
const UKER_TAB = process.env.UKER_TAB || 'Database_Uker';
const COLS = ['Timestamp','Tanggal Transaksi','Branch Office','Kode Uker','Unit Kerja','Jenis Uker','Nama Teller','Status','Nama Rekening Pengirim','Nomor Rekening Pengirim','Bank Tujuan','Nama Rekening Penerima','Nomor Rekening Penerima','Nomor Rekening BRI','Nominal','Nomor HP'];
const ST = ['Berhasil', 'Gagal Dibelokkan', 'Gagal Tidak Punya Rekening'];
const COLOR = { Berhasil: '#16a34a', 'Gagal Dibelokkan': '#dc2626', 'Gagal Tidak Punya Rekening': '#ea580c' };

const key = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
// Cadangan bila sheet Database_Uker gagal dibaca (25 BO)
const FALLBACK_BOS = ['BO Bangkalan','BO Bojonegoro','BO Gresik','BO Jombang','BO Krian','BO Lamongan','BO Mojokerto','BO Pamekasan','BO Sampang','BO Sidoarjo','BO Sumenep','BO Surabaya Diponegoro','BO Surabaya HR Muhammad','BO Surabaya Jemursari','BO Surabaya Kaliasin','BO Surabaya Kapas Krampung','BO Surabaya Kertajaya','BO Surabaya Kusuma Bangsa','BO Surabaya Manukan','BO Surabaya Mulyosari','BO Surabaya Pahlawan','BO Surabaya Rajawali','BO Surabaya Tanjung Perak','BO Tuban','BO Waru'];
// kunci pencocokan BO: abaikan awalan KC/BO agar "KC Waru" = "BO Waru"
const ALIAS = { mulyosari: 'surabaya mulyosari' };
const keyBO = s => { const k = key(s).replace(/^(kc|bo)\s+/, ''); return ALIAS[k] || k; };
function normStatus(s) {
  const k = key(s);
  if (/berhasil|sukses/.test(k)) return 'Berhasil';
  if (/belok/.test(k)) return 'Gagal Dibelokkan';
  if (/rekening|rek\b/.test(k) && /gagal|tidak|tanpa/.test(k)) return 'Gagal Tidak Punya Rekening';
  return String(s || '').trim();
}

function parseCSV(t) {
  const out = []; let row = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(f); out.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); out.push(row); }
  return out;
}

const cache = {};
async function sheet(tab) {
  const hit = cache[tab];
  if (hit && Date.now() - hit.t < 10000) return hit.v;
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Gagal membaca sheet "${tab}" (${r.status}). Pastikan spreadsheet dibagikan "Anyone with the link can view".`);
  const v = parseCSV(await r.text());
  cache[tab] = { t: Date.now(), v };
  return v;
}

function normDate(s = '') {
  s = s.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return s;
}

// Database_Uker: kolom Branch Office, Kode Uker, Nama Uker, Jenis Uker
async function getUnits() {
  try {
    const [head, ...body] = await sheet(UKER_TAB);
    const h = re => head.findIndex(x => re.test(x.trim()));
    const b = h(/^branch office$/i) >= 0 ? h(/^branch office$/i) : h(/office|^bo$/i);
    const kd = h(/kode uker/i), u = h(/nama uker|unit kerja|^uker$/i), j = h(/jenis/i);
    if (b < 0 || u < 0) return [];
    const clean = v => String(v || '').replace(/\s+/g, ' ').trim();
    const seen = new Set();
    return body.map(r => ({ bo: clean(r[b]), kode: clean(r[kd]), uker: clean(r[u]), jenis: clean(r[j]) }))
      .filter(x => x.bo && x.uker)
      .filter(x => { const k = x.bo + '|' + key(x.uker); return seen.has(k) ? false : seen.add(k); });
  } catch { return []; }
}

async function getCtx() {
  const units = await getUnits();
  const bos = units.length ? [...new Set(units.map(u => u.bo))].sort((a, b) => a.localeCompare(b)) : FALLBACK_BOS;
  const boMap = Object.fromEntries(bos.map(b => [keyBO(b), b]));
  const byName = {}, byKode = {};
  units.forEach(u => { byName[u.bo + '|' + key(u.uker)] = u.uker; (byKode[u.bo + '|' + u.kode] ??= []).push(u.uker); });
  return { units, bos, boMap, byName, byKode };
}

// Samakan nama BO dan Unit Kerja di Form Response dengan Database_Uker
async function getRows(ctx) {
  const [head, ...body] = await sheet(RESPONSE_TAB);
  const idx = Object.fromEntries(head.map((h, i) => [key(h), i]));
  return body
    .map(r => Object.fromEntries(COLS.map(c => [c, (r[idx[key(c)]] ?? '').trim()])))
    .filter(r => r.Timestamp || r.Status)
    .map(r => {
      const bo = ctx.boMap[keyBO(r['Branch Office'])] || r['Branch Office'];
      const byK = ctx.byKode[bo + '|' + r['Kode Uker']];
      const uker = ctx.byName[bo + '|' + key(r['Unit Kerja'])] || (byK && byK.length === 1 ? byK[0] : r['Unit Kerja'].replace(/\s+/g, ' ').trim());
      return { ...r, 'Tanggal Transaksi': normDate(r['Tanggal Transaksi'] || r.Timestamp), 'Branch Office': bo, 'Unit Kerja': uker, Status: normStatus(r.Status) };
    });
}

function filt(rows, q) {
  return rows.filter(r =>
    (!q.from || r['Tanggal Transaksi'] >= q.from) &&
    (!q.to || r['Tanggal Transaksi'] <= q.to) &&
    (!q.bo || r['Branch Office'] === q.bo) &&
    (!q.uker || r['Unit Kerja'] === q.uker) &&
    (!q.status || r.Status === q.status) &&
    (!q.q || Object.values(r).join(' ').toLowerCase().includes(String(q.q).toLowerCase())));
}

function toPDF(res, title, cols, data, size = 'A4', fs = 7.5) {
  const d = new PDFDocument({ size, layout: 'landscape', margin: 30 });
  d.pipe(res);
  d.fontSize(14).fillColor('#0857C3').text(title);
  d.fontSize(8).fillColor('#64748b').text(`Dicetak ${new Date().toLocaleString('id-ID')} • ${data.length} baris`);
  let y = d.y + 8;
  const W = cols.reduce((s, c) => s + c[2], 0);
  const cell = (txt, x, w, color) => d.fillColor(color).fontSize(fs).text(String(txt ?? ''), x + 2, y, { width: w - 4, height: fs + 3, ellipsis: true, lineBreak: false });
  const head = () => {
    d.rect(30, y - 3, W, fs + 9).fill('#0857C3');
    let x = 30;
    cols.forEach(c => { cell(c[1], x, c[2], '#ffffff'); x += c[2]; });
    y += fs + 9;
  };
  const line = r => {
    if (y > d.page.height - 45) { d.addPage(); y = 30; head(); }
    let x = 30;
    cols.forEach(c => { cell(r[c[0]], x, c[2], c[0] === 'Status' && COLOR[r.Status] ? COLOR[r.Status] : '#111827'); x += c[2]; });
    y += fs + 7;
  };
  head(); data.forEach(line); d.end();
}

// Excel dengan template: header biru (#0857C3), teks putih tebal, border, baris selang-seling, header dibekukan + filter
async function toXlsx(sheetName, cols, out) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Report RTGS Out - BRI Region 12 Surabaya';
  const ws = wb.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = cols.map(c => ({ header: c[0], key: c[0], width: c[3] }));
  const line = { style: 'thin', color: { argb: 'FFD0DCEE' } };
  const border = { top: line, left: line, bottom: line, right: line };
  const hr = ws.getRow(1);
  hr.height = 26;
  hr.eachCell(c => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0857C3' } };
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 11 };
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c.border = border;
  });
  const argb = { Berhasil: 'FF16A34A', 'Gagal Dibelokkan': 'FFDC2626', 'Gagal Tidak Punya Rekening': 'FFEA580C' };
  out.forEach((r, i) => {
    const row = ws.addRow(Object.fromEntries(cols.map(c => {
      let v = r[c[0]];
      if (c[0] === 'Nominal') v = Number(String(v ?? '').replace(/[.,]\d{1,2}$/, '').replace(/[^\d]/g, '')) || 0;
      return [c[0], v];
    })));
    const total = r['Branch Office'] === 'TOTAL';
    row.eachCell({ includeEmpty: true }, (c, n) => {
      c.border = border;
      c.alignment = { vertical: 'middle' };
      c.font = { name: 'Calibri', size: 10.5, bold: total };
      if (total) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCEBFB' } };
      else if (i % 2) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F6FD' } };
      const key = cols[n - 1] && cols[n - 1][0];
      if (key === 'Nominal') c.numFmt = '#,##0';
      if (key === 'Status' && argb[c.value]) c.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: argb[c.value] } };
    });
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  return wb.xlsx.writeBuffer();
}

const DETAIL = [['Timestamp','Timestamp',74,20],['Tanggal Transaksi','Tanggal',58,16],['Branch Office','Branch Office',80,26],['Kode Uker','Kode Uker',38,12],['Unit Kerja','Unit Kerja',80,28],['Jenis Uker','Jenis',36,12],['Nama Teller','Nama Teller',70,24],['Status','Status',100,28],['Nama Rekening Pengirim','Nama Rek Pengirim',80,28],['Nomor Rekening Pengirim','No Rek Pengirim',82,22],['Bank Tujuan','Bank Tujuan',70,24],['Nama Rekening Penerima','Nama Rek Penerima',80,28],['Nomor Rekening Penerima','No Rek Penerima',82,22],['Nomor Rekening BRI','No Rek BRI',70,22],['Nominal','Nominal',62,18],['Nomor HP','Nomor HP',62,16]];

export async function dataPayload() {
  const ctx = await getCtx();
  const rows = await getRows(ctx);
  return { rows, units: ctx.units.map(({ bo, uker, jenis }) => ({ bo, uker, jenis })), bos: ctx.bos, updated: new Date().toISOString() };
}

// q = query string (from, to, bo, uker, status, q, format, type); res = Node ServerResponse (Express / Vercel)
export async function sendExport(q, res) {
  const fmt = q.format === 'pdf' ? 'pdf' : 'xlsx';
  const ctx = await getCtx();
  const data = filt(await getRows(ctx), q);
  const summary = q.type === 'summary';
  let cols, out, title, name;

  if (summary) {
    const map = {};
    const add = (bo, uker) => (map[`${bo}|${uker}`] ??= { 'Branch Office': bo, 'Unit Kerja': uker, Berhasil: 0, 'Gagal Dibelokkan': 0, 'Gagal Tidak Punya Rekening': 0 });
    ctx.units.filter(u => (!q.bo || u.bo === q.bo) && (!q.uker || u.uker === q.uker)).forEach(u => add(u.bo, u.uker));
    data.filter(r => ctx.bos.includes(r['Branch Office'])).forEach(r => { const m = add(r['Branch Office'], r['Unit Kerja']); if (ST.includes(r.Status)) m[r.Status]++; });
    out = Object.values(map)
      .sort((a, b) => ctx.bos.indexOf(a['Branch Office']) - ctx.bos.indexOf(b['Branch Office']) || a['Unit Kerja'].localeCompare(b['Unit Kerja']))
      .map(m => ({ ...m, Total: ST.reduce((s, k) => s + m[k], 0) }));
    if (out.length) out.push({ 'Branch Office': 'TOTAL', 'Unit Kerja': '', ...Object.fromEntries([...ST, 'Total'].map(k => [k, out.reduce((s, r) => s + r[k], 0)])) });
    cols = [['Branch Office', 'Branch Office', 170, 28], ['Unit Kerja', 'Unit Kerja', 190, 32], ['Berhasil', 'Berhasil', 65, 12], ['Gagal Dibelokkan', 'Gagal Dibelokkan', 105, 18], ['Gagal Tidak Punya Rekening', 'Gagal Tidak Punya Rekening', 170, 28], ['Total', 'Total', 60, 10]];
    title = 'Report RTGS Out - Rekap per Unit Kerja' + (q.bo ? ` (${q.bo})` : '');
    name = 'Rekap_RTGS' + (q.bo ? '_' + q.bo : '');
  } else {
    cols = DETAIL;
    out = data;
    title = 'Report RTGS Out - Live Response' + (q.uker ? ` (${q.uker})` : q.bo ? ` (${q.bo})` : '');
    name = q.uker ? 'RTGS_' + q.uker : q.bo ? 'RTGS_' + q.bo : 'Live_Response_RTGS';
  }
  const file = `${name}${q.status ? '_' + q.status : ''}_${q.from || 'awal'}_${q.to || 'akhir'}`.replace(/[^\w-]+/g, '_');

  if (fmt === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${file}.pdf"`);
    return toPDF(res, title, cols, out, summary ? 'A4' : 'A3', summary ? 7.5 : 7);
  }
  const buf = await toXlsx(summary ? 'Rekap' : 'Live Response', cols, out);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${file}.xlsx"`);
  res.end(Buffer.from(buf));
}
