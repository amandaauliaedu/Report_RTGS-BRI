import { sendExport } from './_lib/core.js';

export default async function handler(req, res) {
  try {
    await sendExport(req.query, res);
  } catch (e) {
    if (!res.headersSent) res.status(502).json({ error: e.message });
  }
}
