import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Radio, LayoutGrid, BarChart3, Download, ChevronDown, X, Wifi, RefreshCw, FileSpreadsheet, FileText } from 'lucide-react';

const today = () => new Date().toISOString().slice(0, 10);
const qs = o => new URLSearchParams(Object.fromEntries(Object.entries(o).filter(([, v]) => v))).toString();
const dl = p => { window.location.href = '/api/export?' + qs(p); };
const D = 'Tanggal Transaksi', BO = 'Branch Office', UK = 'Unit Kerja';
const LIVE_COLS = ['Timestamp', D, BO, 'Kode Uker', UK, 'Jenis Uker', 'Bank Tujuan', 'Status'];
const ST = ['Berhasil', 'Gagal Dibelokkan', 'Gagal Tidak Punya Rekening'];
const CLS = { Berhasil: 'ok', 'Gagal Dibelokkan': 'bad', 'Gagal Tidak Punya Rekening': 'warn' };
const HEX = { Berhasil: '#16a34a', 'Gagal Dibelokkan': '#dc2626', 'Gagal Tidak Punya Rekening': '#f97316' };
const zero = () => ({ Berhasil: 0, 'Gagal Dibelokkan': 0, 'Gagal Tidak Punya Rekening': 0 });

const filterRows = (rows, f) => rows.filter(r =>
  (!f.from || r[D] >= f.from) && (!f.to || r[D] <= f.to) && (!f.bo || r[BO] === f.bo) &&
  (!f.uker || r[UK] === f.uker) && (!f.status || r.Status === f.status));

const page = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.35 } };
const stagger = i => ({ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.08, duration: 0.4 } });

function Logo({ size = 40 }) {
  return <img src="/logo.png" width={size} height={size} alt="BRI" style={{ borderRadius: size * 0.22, display: 'block' }} />;
}

function Dl2({ p, size = 15 }) {
  return (
    <>
      <button className="btn icon sm" title="Download Excel" onClick={() => dl({ ...p, format: 'xlsx' })}><FileSpreadsheet size={size} /></button>
      <button className="btn icon sm" title="Download PDF" onClick={() => dl({ ...p, format: 'pdf' })}><FileText size={size} /></button>
    </>
  );
}

function Filters({ f, set, rows, units, bos, uker = false, status = false, extra }) {
  const ukers = [...new Set([...units.filter(u => !f.bo || u.bo === f.bo).map(u => u.uker), ...rows.filter(r => !f.bo || r[BO] === f.bo).map(r => r[UK])].filter(Boolean))].sort();
  const up = k => e => set({ ...f, [k]: e.target.value, ...(k === 'bo' ? { uker: '' } : {}) });
  return (
    <div className="card filters">
      <label>Tanggal Awal<input type="date" value={f.from} onChange={up('from')} /></label>
      <label>Tanggal Akhir<input type="date" value={f.to} onChange={up('to')} /></label>
      <label>Branch Office
        <select value={f.bo} onChange={up('bo')}><option value="">Semua BO</option>{bos.map(b => <option key={b}>{b}</option>)}</select>
      </label>
      {uker && <label>Unit Kerja
        <select value={f.uker} onChange={up('uker')}><option value="">Semua Uker</option>{ukers.map(b => <option key={b}>{b}</option>)}</select>
      </label>}
      {status && <label>Status
        <select value={f.status} onChange={up('status')}><option value="">Semua</option>{ST.map(s => <option key={s}>{s}</option>)}</select>
      </label>}
      {extra && <div className="filtersExtra">{extra}</div>}
    </div>
  );
}

function HomePage({ rows, go }) {
  const c = zero();
  rows.forEach(r => { if (r.Status in c) c[r.Status]++; });
  const cards = [['Total Laporan', rows.length, 'semua data', ''], ['Berhasil', c.Berhasil, 'transaksi RTGS sukses', 'ok'], ['Gagal Dibelokkan', c['Gagal Dibelokkan'], 'transaksi dibelokkan', 'bad'], ['Gagal Tidak Punya Rekening', c['Gagal Tidak Punya Rekening'], 'rekening tidak ditemukan', 'warn']];
  return (
    <motion.div {...page}>
      <section className="hero">
        <div>
          <p className="eyebrow">© Operation, Service, and E-Channel (OSE)</p>
          <h1>REPORT<br /><span>RTGS OUT</span></h1>
          <p className="sub">BRI Region 12 Surabaya</p>
          <div className="row">
            <button className="btn primary" onClick={() => go('live')}>Live Response ↗</button>
            <button className="btn" onClick={() => dl({ format: 'xlsx' })}><Download size={15} /> Unduh Data Excel</button>
            <button className="btn" onClick={() => go('mon')}>Buka Monitoring</button>
          </div>
        </div>
        <motion.div className="bigLogo" animate={{ y: [0, -12, 0] }} transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}>
          <Logo size={240} />
        </motion.div>
      </section>
      <p className="eyebrow sm">Ringkasan cepat</p>
      <h2>Status Monitoring Terkini</h2>
      <div className="stats">
        {cards.map(([t, v, s, k], i) => (
          <motion.div key={t} className="card stat" {...stagger(i)} whileHover={{ y: -4 }}>
            <small>{t}</small><b className={k}>{v}</b><span>{s}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function Table({ data, cols = LIVE_COLS }) {
  return (
    <div className="tableWrap">
      <table>
        <thead><tr><th>#</th>{cols.map(c => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {data.map((r, i) => (
            <motion.tr key={r.Timestamp + i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 15) * 0.02 }}>
              <td>{i + 1}</td>
              {cols.map(c => <td key={c}>{c === 'Status' ? <span className={'pill ' + (CLS[r[c]] || '')}>{r[c]}</span> : r[c]}</td>)}
            </motion.tr>
          ))}
          {!data.length && <tr><td colSpan={cols.length + 1} className="empty">Belum ada data pada filter ini</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function LivePage({ rows, units, bos, updated, refresh }) {
  const [f, set] = useState({ from: '', to: '', bo: '', uker: '', status: '' });
  const [q, setQ] = useState('');
  const data = useMemo(() => {
    const k = q.trim().toLowerCase();
    return filterRows(rows, f).filter(r => !k || Object.values(r).join(' ').toLowerCase().includes(k)).reverse();
  }, [rows, f, q]);
  const n = s => data.filter(r => r.Status === s).length;
  const chips = [['Total Response', data.length], ...ST.map(s => [s, n(s)]), ['Total BO', new Set(data.map(r => r[BO])).size], ['Total Uker', new Set(data.map(r => r[UK])).size]];
  const p = { ...f, q };
  return (
    <motion.div {...page}>
      <Filters f={f} set={set} rows={rows} units={units} bos={bos} uker status extra={<>
        <button className="btn" onClick={refresh}><RefreshCw size={14} /> Refresh</button>
        <span className="grow" /><span className="liveTxt">● LIVE • {updated}</span></>} />
      <h2 className="title">Live Response</h2>
      <p className="muted">Data laporan RTGS langsung dari Google Sheets • {rows.length} baris terbaca dari sheet.</p>
      <div className="chips">
        {chips.map(([l, v], i) => <motion.div key={l} className="chip" {...stagger(i)}><small>{l}</small><b>{v}</b></motion.div>)}
      </div>
      <div className="card dlCard">
        <div><h3>Download Data</h3><p className="muted">Unduh {data.length} baris sesuai filter & pencarian saat ini</p></div>
        <span className="grow" />
        <button className="btn primary" onClick={() => dl({ ...p, format: 'xlsx' })}><FileSpreadsheet size={15} /> XLSX</button>
        <button className="btn" onClick={() => dl({ ...p, format: 'pdf' })}><FileText size={15} /> PDF</button>
      </div>
      <input className="search" placeholder="Cari BO, unit kerja, bank..." value={q} onChange={e => setQ(e.target.value)} />
      <div className="card"><Table data={data} /></div>
    </motion.div>
  );
}

function MonitoringPage({ rows, units, bos }) {
  const [f, set] = useState({ from: '', to: '', bo: '', uker: '' });
  const [q, setQ] = useState('');
  const [open, setOpen] = useState({});
  const [modal, setModal] = useState(null);
  const k = q.trim().toLowerCase();
  const tree = useMemo(() => {
    const t = Object.fromEntries(bos.map(b => [b, {}]));
    const add = (b, u) => (t[b] ? (t[b][u] ??= zero()) : null);
    units.filter(u => (!f.bo || u.bo === f.bo) && (!f.uker || u.uker === f.uker)).forEach(u => add(u.bo, u.uker));
    filterRows(rows, f).forEach(r => { const m = add(r[BO], r[UK]); if (m && r.Status in m) m[r.Status]++; });
    return Object.entries(t)
      .filter(([b]) => !f.bo || b === f.bo)
      .map(([b, us]) => [b, Object.entries(us).filter(([u]) => !k || b.toLowerCase().includes(k) || u.toLowerCase().includes(k)).sort(([a], [c]) => a.localeCompare(c))])
      .filter(([, l]) => (!k && !f.uker) || l.length);
  }, [rows, units, bos, f, k]);
  const all = tree.flatMap(([, l]) => l.map(([, v]) => v));
  const cards = [['Branch Office', tree.length, ''], ['Unit Kerja', all.length, ''], ...ST.map(s => [s, all.reduce((x, v) => x + v[s], 0), CLS[s]])];
  const mp = modal && { from: f.from, to: f.to, bo: modal.bo, uker: modal.uker, status: modal.status };
  const mrows = modal ? filterRows(rows, mp).reverse() : [];
  return (
    <motion.div {...page}>
      <h2 className="title">Monitoring Dashboard</h2>
      <p className="muted">Jumlah laporan RTGS per Branch Office dan Unit Kerja. Klik BO untuk melihat unit kerjanya, klik kotak jumlah untuk melihat laporannya.</p>
      <Filters f={f} set={set} rows={rows} units={units} bos={bos} uker extra={<>
        <input className="search inline" placeholder="Cari BO atau unit kerja..." value={q} onChange={e => setQ(e.target.value)} />
        <span className="grow" />
        <span className="muted" style={{ margin: 0 }}>Download semua:</span>
        <button className="btn primary" onClick={() => dl({ ...f, format: 'xlsx', type: 'summary' })}><FileSpreadsheet size={15} /> Excel</button>
        <button className="btn" onClick={() => dl({ ...f, format: 'pdf', type: 'summary' })}><FileText size={15} /> PDF</button>
        <div className="legend" style={{ width: '100%' }}><b>Keterangan</b>
          {ST.map(s => <span className="lg" key={s}><i className={CLS[s]} />{s}</span>)}</div></>} />
      <div className="stats five">
        {cards.map(([t, v, c], i) => <motion.div key={t} className="card stat" {...stagger(i)}><small>{t}</small><b className={c}>{v}</b></motion.div>)}
      </div>
      <div className="card list">
        {tree.map(([bo, list]) => (
          <div key={bo}>
            <div className="boHead">
              <button className="boToggle" onClick={() => setOpen({ ...open, [bo]: !open[bo] })}>
                <motion.span animate={{ rotate: open[bo] ? 180 : 0 }}><ChevronDown size={18} /></motion.span>
                <b>{bo}</b><small>{list.length} unit kerja</small>
                <span className="grow" />
                {ST.map(s => <span key={s} className={'pill ' + CLS[s]} title={s}>{list.reduce((x, [, v]) => x + v[s], 0)}</span>)}
              </button>
              <Dl2 p={{ from: f.from, to: f.to, bo, type: 'summary' }} />
            </div>
            <AnimatePresence initial={false}>
              {open[bo] && (
                <motion.div className="units" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
                  {list.map(([uk, v]) => (
                    <div className="unit" key={uk}>
                      <span>{uk}</span><span className="grow" />
                      {ST.map(s => (
                        <motion.button key={s} whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.96 }} className={'box ' + CLS[s]} onClick={() => setModal({ bo, uker: uk, status: s })}><b>{v[s]}</b>{s}</motion.button>
                      ))}
                      <Dl2 p={{ from: f.from, to: f.to, bo, uker: uk, nocode: 1 }} />
                    </div>
                  ))}
                  {!list.length && <p className="empty">Belum ada unit kerja</p>}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
        {!tree.length && <p className="empty">Belum ada data</p>}
      </div>
      <AnimatePresence>
        {modal && (
          <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModal(null)}>
            <motion.div className="modal card" initial={{ scale: 0.94, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 20 }} onClick={e => e.stopPropagation()}>
              <div className="row">
                <div><h3>{modal.bo} • {modal.uker}</h3><p className="muted"><span className={'pill ' + CLS[modal.status]}>{modal.status}</span> • {mrows.length} laporan</p></div>
                <span className="grow" />
                <button className="btn primary" onClick={() => dl({ ...mp, format: 'xlsx', nocode: 1 })}><FileSpreadsheet size={15} /> Excel</button>
                <button className="btn" onClick={() => dl({ ...mp, format: 'pdf', nocode: 1 })}><FileText size={15} /> PDF</button>
                <button className="btn icon" onClick={() => setModal(null)}><X size={16} /></button>
              </div>
              <Table data={mrows} cols={LIVE_COLS.filter(c => c !== 'Kode Uker')} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Donut({ tot, sel, hov, setHov, setSel }) {
  const sum = ST.reduce((s, k) => s + tot[k], 0), C = 2 * Math.PI * 70, act = hov || sel;
  let acc = 0;
  return (
    <svg viewBox="0 0 200 200" className="donut">
      <g transform="rotate(-90 100 100)">
        <circle cx="100" cy="100" r="70" fill="none" stroke="#e2e8f0" strokeWidth="38" />
        {ST.map(s => {
          const len = sum ? (tot[s] / sum) * C : 0, off = -acc; acc += len;
          return (
            <motion.circle key={s} cx="100" cy="100" r="70" fill="none" stroke={HEX[s]} style={{ cursor: 'pointer' }}
              initial={{ strokeDasharray: `0 ${C}`, strokeDashoffset: off }}
              animate={{ strokeDasharray: `${len} ${C - len}`, strokeDashoffset: off, strokeWidth: act === s ? 46 : 38, opacity: act && act !== s ? 0.35 : 1 }}
              transition={{ duration: 0.7 }}
              onMouseEnter={() => setHov(s)} onMouseLeave={() => setHov(null)} onClick={() => setSel(sel === s ? null : s)} />
          );
        })}
      </g>
      <text x="100" y="100" textAnchor="middle" className="dn">{act ? tot[act] : sum}</text>
      <text x="100" y="118" textAnchor="middle" className="dl">{act ? (sum ? Math.round((tot[act] / sum) * 100) : 0) + '% • ' + act : 'total laporan'}</text>
    </svg>
  );
}

function Bars({ status, per, sel, bo, setBo, total }) {
  const data = Object.entries(per).map(([n, v]) => [n, v[status]]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const max = Math.max(1, ...data.map(d => d[1]));
  return (
    <motion.div className="card chart" animate={{ opacity: sel && sel !== status ? 0.4 : 1 }}>
      <h3><i className={CLS[status]} /> Jumlah {status} per BO</h3>
      {data.map(([n, v], i) => (
        <div key={n} className={'bar-row' + (bo === n ? ' on' : '')} onClick={() => setBo(bo === n ? null : n)}
          title={`${n}: ${v} (${total ? Math.round((v / total) * 100) : 0}% dari total ${status})`}>
          <span className="bl">{n}</span>
          <div className="track"><motion.div className="fill" style={{ background: HEX[status] }} initial={{ width: 0 }} animate={{ width: (v / max) * 100 + '%' }} whileHover={{ opacity: 0.8 }} transition={{ duration: 0.7, delay: i * 0.02 }} /></div>
          <b>{v}</b>
        </div>
      ))}
    </motion.div>
  );
}

function AnalystPage({ rows, units, bos }) {
  const [f, set] = useState({ from: '', to: '' });
  const [sel, setSel] = useState(null), [hov, setHov] = useState(null), [bo, setBo] = useState(null);
  const data = useMemo(() => filterRows(rows, f), [rows, f]);
  const tot = useMemo(() => { const t = zero(); data.forEach(r => { if (r.Status in t) t[r.Status]++; }); return t; }, [data]);
  const per = useMemo(() => {
    const m = Object.fromEntries(bos.map(b => [b, zero()]));
    data.forEach(r => { const x = m[r[BO]]; if (x && r.Status in x) x[r.Status]++; });
    return m;
  }, [data, bos]);
  const uk = useMemo(() => {
    if (!bo) return [];
    const m = {};
    units.filter(u => u.bo === bo).forEach(u => (m[u.uker] ??= zero()));
    data.filter(r => r[BO] === bo).forEach(r => { const x = (m[r[UK]] ??= zero()); if (r.Status in x) x[r.Status]++; });
    return Object.entries(m).sort(([, a], [, b]) => ST.reduce((s, k) => s + b[k], 0) - ST.reduce((s, k) => s + a[k], 0));
  }, [bo, data, units]);
  const sum = ST.reduce((s, k) => s + tot[k], 0);
  const ukMax = Math.max(1, ...uk.map(([, v]) => ST.reduce((s, k) => s + v[k], 0)));
  return (
    <motion.div {...page}>
      <h2 className="title">Data Analyst</h2>
      <p className="muted">Klik status pada diagram untuk menyorot, klik nama BO pada diagram batang untuk melihat unit kerjanya.</p>
      <div className="card filters">
        <label>Tanggal Awal<input type="date" value={f.from} onChange={e => set({ ...f, from: e.target.value })} /></label>
        <label>Tanggal Akhir<input type="date" value={f.to} onChange={e => set({ ...f, to: e.target.value })} /></label>
      </div>
      <div className="card pieCard">
        <Donut tot={tot} sel={sel} hov={hov} setHov={setHov} setSel={setSel} />
        <div>
          <h3>Status Laporan RTGS</h3>
          {ST.map(s => (
            <div key={s} className={'legendItem' + (sel === s ? ' on' : '')} onMouseEnter={() => setHov(s)} onMouseLeave={() => setHov(null)} onClick={() => setSel(sel === s ? null : s)}>
              <i className={CLS[s]} />{s}<b>{tot[s]}</b><small>({sum ? Math.round((tot[s] / sum) * 100) : 0}%)</small>
            </div>
          ))}
        </div>
      </div>
      <AnimatePresence>
        {bo && (
          <motion.div className="card drill" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
            <div className="row"><h3>Unit Kerja di {bo}</h3><span className="grow" /><button className="btn icon" onClick={() => setBo(null)}><X size={16} /></button></div>
            {uk.map(([n, v]) => (
              <div className="ukRow" key={n}>
                <span>{n}</span>
                <div className="stack">{ST.map(s => <motion.div key={s} style={{ background: HEX[s] }} initial={{ width: 0 }} animate={{ width: (v[s] / ukMax) * 100 + '%' }} title={`${s}: ${v[s]}`} />)}</div>
                <div className="nums">{ST.map(s => <span key={s} style={{ color: HEX[s] }}>{v[s]}</span>)}</div>
              </div>
            ))}
            {!uk.length && <p className="empty">Belum ada data unit kerja</p>}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="grid3">
        {ST.map(s => <Bars key={s} status={s} per={per} sel={sel || hov} bo={bo} setBo={setBo} total={tot[s]} />)}
      </div>
    </motion.div>
  );
}

const tabs = [['home', 'Home', Home], ['live', 'Live Response', Radio], ['mon', 'Monitoring Dashboard', LayoutGrid], ['analyst', 'Data Analyst', BarChart3]];

export default function App() {
  const [tab, setTab] = useState('home');
  const [state, setState] = useState({ rows: [], units: [], bos: [], error: '', updated: '--:--:--' });
  const load = useCallback(() => fetch('/api/data').then(r => r.json()).then(d => {
    const t = new Date().toLocaleTimeString('id-ID');
    d.error ? setState(s => ({ ...s, error: d.error })) : setState({ rows: d.rows, units: d.units, bos: d.bos, error: '', updated: t });
  }).catch(e => setState(s => ({ ...s, error: e.message }))), []);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);
  const { rows, units, bos, error, updated } = state;
  return (
    <>
      <header className="nav">
        <div className="navIn">
          <Logo size={38} />
          <div className="brand"><b>BRI Region 12 Surabaya</b><small>OPERATION, SERVICE, AND E-CHANNEL (OSE)</small></div>
          <nav>
            {tabs.map(([k, l, Ic]) => (
              <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
                {tab === k && <motion.span layoutId="pill" className="pillBg" />}
                <span className="lbl"><Ic size={15} />{l}</span>
              </button>
            ))}
          </nav>
          <span className="grow" />
          <span className="live"><Wifi size={13} /> LIVE</span>
          <button className="btn icon" title="Unduh semua data (Excel)" onClick={() => dl({ format: 'xlsx' })}><Download size={16} /></button>
        </div>
      </header>
      <main>
        {error && <div className="err">⚠ {error}</div>}
        <AnimatePresence mode="wait">
          <div key={tab}>
            {tab === 'home' && <HomePage rows={rows} go={setTab} />}
            {tab === 'live' && <LivePage rows={rows} units={units} bos={bos} updated={updated} refresh={load} />}
            {tab === 'mon' && <MonitoringPage rows={rows} units={units} bos={bos} />}
            {tab === 'analyst' && <AnalystPage rows={rows} units={units} bos={bos} />}
          </div>
        </AnimatePresence>
        <footer>© 2026 Amanda Aulia | PT. Bank Rakyat Indonesia (Persero) Tbk</footer>
      </main>
    </>
  );
}
