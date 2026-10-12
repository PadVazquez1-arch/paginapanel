/**
 * Servidor del panel.
 *  - Sirve la versión compilada (carpeta dist) para que abras el panel en el navegador.
 *  - Expone /api/notion/pendientes: habla con Notion usando tu token.
 *
 * El token vive aquí, en tu máquina, y nunca llega al navegador.
 */
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));

/* .env casero: sin dependencias extra */
const envPath = path.join(RAIZ, '.env');
if (fs.existsSync(envPath)) {
  for (const linea of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const i = limpia.indexOf('=');
    if (i > 0) process.env[limpia.slice(0, i).trim()] ??= limpia.slice(i + 1).trim();
  }
}

const app = express();
const PUERTO = process.env.PORT || 8787;
const TOKEN = process.env.NOTION_TOKEN;
const BASE = process.env.NOTION_DATABASE_ID;

/* ── Notion: devuelve las tareas que no están terminadas ── */
app.get('/api/notion/pendientes', async (_req, res) => {
  if (!TOKEN || !BASE) {
    return res.status(400).json({ error: 'faltan NOTION_TOKEN o NOTION_DATABASE_ID en el archivo .env' });
  }
  try {
    const r = await fetch(`https://api.notion.com/v1/databases/${BASE}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ page_size: 25 }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.message ?? 'Notion rechazó la consulta' });

    const tareas = (data.results ?? []).map((pagina) => {
      const props = Object.entries(pagina.properties ?? {});
      const buscar = (tipo) => props.find(([, v]) => v.type === tipo)?.[1];

      const titulo = buscar('title')?.title?.map((t) => t.plain_text).join('') || '(sin título)';
      const estado = buscar('status')?.status?.name
        ?? buscar('select')?.select?.name
        ?? (buscar('checkbox')?.checkbox ? 'hecho' : null);
      const fecha = buscar('date')?.date?.start ?? null;

      return { titulo, estado, fecha, url: pagina.url ?? null };
    })
      /* fuera lo que ya está terminado */
      .filter((t) => !/hecho|done|complet|terminad|listo|finaliz/i.test(t.estado ?? ''));

    res.json({ tareas });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── el panel compilado ── */
const dist = path.join(RAIZ, 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  app.get('/', (_req, res) =>
    res.status(404).send('Todavía no compilas el panel. Corre: npm run build'));
}

app.listen(PUERTO, '0.0.0.0', () => {
  console.log(`\n  Bitácora lista en:`);
  console.log(`    esta máquina  →  http://localhost:${PUERTO}`);
  console.log(`    en tu red     →  http://<ip-de-tu-pc>:${PUERTO}`);
  console.log(TOKEN && BASE ? '  Notion conectado.\n' : '  Notion sin configurar (revisa .env).\n');
});
