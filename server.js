// Server lokal (npm start / npm run dev). Di Vercel yang dipakai adalah folder /api.
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dataPayload, sendExport } from './api/_lib/core.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const wrap = fn => (req, res) => fn(req, res).catch(e => !res.headersSent && res.status(502).json({ error: e.message }));

app.get('/api/data', wrap(async (req, res) => res.json(await dataPayload())));
app.get('/api/export', wrap((req, res) => sendExport(req.query, res)));

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
app.listen(process.env.PORT || 3000, () => console.log('Dashboard RTGS jalan di http://localhost:' + (process.env.PORT || 3000)));
