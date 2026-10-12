/**
 * Asistencia Docente por QR
 * ------------------------------------------------------------
 * Servidor único, sin frameworks. Node 22+ (usa node:sqlite integrado).
 *
 *   node server.js
 *
 * Variables de entorno (ver .env.example):
 *   PUERTO           puerto HTTP (default 3000)
 *   CLAVE_DIRECCION  contraseña del panel de dirección
 *   SECRETO          cadena aleatoria para firmar cookies
 *   TZ               zona horaria (America/Matamoros para Reynosa)
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const QRCode = require('qrcode');

const PUERTO = Number(process.env.PUERTO || 3000);
const CLAVE_DIRECCION = process.env.CLAVE_DIRECCION || 'direccion2026';
const SECRETO = process.env.SECRETO || 'cambia-este-secreto-en-produccion';
const DIR_DATOS = process.env.DIR_DATOS || path.join(__dirname, 'datos');

fs.mkdirSync(DIR_DATOS, { recursive: true });

/* ---------------------------------------------------------------
   Base de datos
--------------------------------------------------------------- */
const db = new DatabaseSync(path.join(DIR_DATOS, 'asistencia.db'));
db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS docentes (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre    TEXT NOT NULL,
    materia   TEXT DEFAULT '',
    telefono  TEXT DEFAULT '',
    token     TEXT NOT NULL UNIQUE,
    activo    INTEGER NOT NULL DEFAULT 1,
    creado    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS registros (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    docente_id INTEGER NOT NULL,
    fecha      TEXT NOT NULL,          -- YYYY-MM-DD
    hora       TEXT NOT NULL,          -- HH:MM:SS
    tipo       TEXT NOT NULL,          -- entrada | salida
    estado     TEXT NOT NULL,          -- puntual | retardo | salida
    estacion   TEXT DEFAULT '',
    FOREIGN KEY (docente_id) REFERENCES docentes(id)
  );

  CREATE INDEX IF NOT EXISTS idx_registros_fecha ON registros(fecha);

  CREATE TABLE IF NOT EXISTS config (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
  );

  -- Última vez que cada número de dirección le escribió al bot.
  -- Mientras la ventana de 24 h esté abierta, los avisos van como texto libre y no cuestan.
  CREATE TABLE IF NOT EXISTS wa_ventanas (
    numero TEXT PRIMARY KEY,
    ultimo INTEGER NOT NULL
  );
`);

const CONFIG_INICIAL = {
  escuela: 'Centro Educativo',
  hora_entrada: '07:00',
  tolerancia_min: '10',
  hora_corte: '07:15',        // a esta hora se avisa quién no se ha registrado
  registrar_salida: 'no',     // 'no' = un solo escaneo por día
  punto_token: crypto.randomBytes(6).toString('base64url'), // va dentro del QR de la pared
  url_publica: '',            // https://asistencia.tuescuela.mx (si va detrás de dominio propio)
  escuela_lat: '',            // ubicación de la escuela; se llena con un botón desde el panel
  escuela_lng: '',
  radio_m: '150',             // qué tan lejos se acepta el registro
  exigir_ubicacion: 'si',     // 'no' desactiva la verificación de ubicación
  exigir_pin: 'si',           // el PIN solo se pide al vincular el teléfono la primera vez
  canal: 'telegram',          // telegram | whatsapp | ambos
  telegram_token: '',
  telegram_chat: '',
  wa_token: '',               // token permanente de la app de Meta
  wa_phone_id: '',            // Phone number ID del número emisor
  wa_destinos: '',            // números de dirección, separados por coma: 5218991234567
  wa_idioma: 'es_MX',         // idioma con el que aprobaste las plantillas
  wa_version: 'v23.0',        // versión de la Graph API
  wa_verify: crypto.randomBytes(8).toString('hex'), // token de verificación del webhook
  clave_estacion: crypto.randomBytes(9).toString('base64url'),
};
for (const [k, v] of Object.entries(CONFIG_INICIAL)) {
  db.prepare('INSERT OR IGNORE INTO config (clave, valor) VALUES (?, ?)').run(k, v);
}

/* Migración: agrega el PIN y la vinculación de dispositivo a instalaciones que ya existían */
const columnas = db.prepare('PRAGMA table_info(docentes)').all().map((c) => c.name);
if (!columnas.includes('pin')) db.exec("ALTER TABLE docentes ADD COLUMN pin TEXT NOT NULL DEFAULT '0000'");
if (!columnas.includes('dispositivo_id')) db.exec('ALTER TABLE docentes ADD COLUMN dispositivo_id TEXT');

const leerConfig = () => {
  const filas = db.prepare('SELECT clave, valor FROM config').all();
  return Object.fromEntries(filas.map((f) => [f.clave, f.valor]));
};
const guardarConfig = (obj) => {
  const stmt = db.prepare('INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor');
  for (const [k, v] of Object.entries(obj)) stmt.run(k, String(v));
};

/* ---------------------------------------------------------------
   Utilidades
--------------------------------------------------------------- */
const dosDig = (n) => String(n).padStart(2, '0');
const fechaHoy = (d = new Date()) => `${d.getFullYear()}-${dosDig(d.getMonth() + 1)}-${dosDig(d.getDate())}`;
const horaAhora = (d = new Date()) => `${dosDig(d.getHours())}:${dosDig(d.getMinutes())}:${dosDig(d.getSeconds())}`;
const aMinutos = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const firmar = (texto) => crypto.createHmac('sha256', SECRETO).update(texto).digest('base64url');

function crearSesion(rol) {
  const carga = Buffer.from(JSON.stringify({ rol, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 })).toString('base64url');
  return `${carga}.${firmar(carga)}`;
}
function leerSesion(req) {
  const cookie = (req.headers.cookie || '').split(';').map((c) => c.trim()).find((c) => c.startsWith('sesion='));
  if (!cookie) return null;
  const valor = decodeURIComponent(cookie.slice(7));
  const [carga, firma] = valor.split('.');
  if (!carga || !firma || firmar(carga) !== firma) return null;
  try {
    const datos = JSON.parse(Buffer.from(carga, 'base64url').toString());
    return datos.exp > Date.now() ? datos : null;
  } catch { return null; }
}

/**
 * Identidad del teléfono, NO del maestro.
 * La cookie solo dice "este es el aparato número X"; nunca dice a quién pertenece.
 * A quién pertenece lo decide el servidor, guardándolo en docentes.dispositivo_id
 * la primera vez que ese aparato se usa con éxito. De ahí en adelante es permanente:
 * ni borrar cookies, ni elegir otro nombre en la lista, cambia esa vinculación.
 */
function leerOCrearDispositivo(req, res) {
  const cookie = (req.headers.cookie || '').split(';').map((c) => c.trim()).find((c) => c.startsWith('dev='));
  if (cookie) {
    const [id, firma] = decodeURIComponent(cookie.slice(4)).split('.');
    if (id && firma === firmar('dev' + id)) return id;
  }
  const id = crypto.randomBytes(16).toString('base64url');
  res.setHeader('Set-Cookie', `dev=${id}.${firmar('dev' + id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`);
  return id;
}

/* Evita mandar un aviso por cada intento; uno cada 10 minutos por docente basta para alertar */
const avisosSospechaEnviados = new Map();
function avisarIntentoSospechoso(docente) {
  const ahora = Date.now();
  if (ahora - (avisosSospechaEnviados.get(docente.id) || 0) < 10 * 60 * 1000) return;
  avisosSospechaEnviados.set(docente.id, ahora);
  avisar({
    texto: `🔒 <b>Registro bloqueado</b>\nAlguien intentó registrar a ${docente.nombre} desde un teléfono distinto al suyo.\nSi su teléfono se perdió o lo cambió, autoriza el nuevo desde el panel, pestaña Docentes.`,
    plantilla: 'alerta_seguridad',
    params: [docente.nombre],
  });
}

const json = (res, datos, codigo = 200) => {
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(datos));
};
const cuerpo = (req) => new Promise((resolve) => {
  let bruto = '';
  req.on('data', (c) => { bruto += c; if (bruto.length > 1e6) req.destroy(); });
  req.on('end', () => { try { resolve(JSON.parse(bruto || '{}')); } catch { resolve({}); } });
});

/* ---------------------------------------------------------------
   Avisos a dirección: Telegram y/o WhatsApp Cloud API
--------------------------------------------------------------- */
async function avisarTelegram(texto, cfg) {
  if (!cfg.telegram_token || !cfg.telegram_chat) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${cfg.telegram_token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: cfg.telegram_chat, text: texto, parse_mode: 'HTML' }),
    });
    if (!r.ok) console.error('Telegram respondió', r.status, await r.text());
    return r.ok;
  } catch (e) {
    console.error('Error de Telegram:', e.message);
    return false;
  }
}

/* Meta no acepta saltos de línea, tabuladores ni espacios largos dentro de una variable */
const limpiarVar = (v) => String(v ?? '').replace(/[\n\r\t]+/g, ' · ').replace(/ {4,}/g, ' ').trim().slice(0, 900) || '—';

const ventanaAbierta = (numero) => {
  const f = db.prepare('SELECT ultimo FROM wa_ventanas WHERE numero = ?').get(numero);
  return !!f && Date.now() - f.ultimo < 24 * 60 * 60 * 1000;
};

async function avisarWhatsApp({ texto, plantilla, params }, cfg) {
  if (!cfg.wa_token || !cfg.wa_phone_id || !cfg.wa_destinos) return false;
  const url = `https://graph.facebook.com/${cfg.wa_version || 'v23.0'}/${cfg.wa_phone_id}/messages`;
  const numeros = cfg.wa_destinos.split(',').map((n) => n.replace(/\D/g, '')).filter(Boolean);
  let algunoOk = false;

  for (const numero of numeros) {
    // Dentro de la ventana de 24 h el texto libre no se cobra; fuera de ella hay que usar plantilla.
    const cuerpoMsg = ventanaAbierta(numero) && texto
      ? { messaging_product: 'whatsapp', to: numero, type: 'text', text: { body: texto.replace(/<\/?b>/g, '*') } }
      : {
          messaging_product: 'whatsapp', to: numero, type: 'template',
          template: {
            name: plantilla,
            language: { code: cfg.wa_idioma || 'es_MX' },
            components: [{ type: 'body', parameters: (params || []).map((p) => ({ type: 'text', text: limpiarVar(p) })) }],
          },
        };
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.wa_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpoMsg),
      });
      if (r.ok) algunoOk = true;
      else console.error('WhatsApp respondió', r.status, await r.text());
    } catch (e) {
      console.error('Error de WhatsApp:', e.message);
    }
  }
  return algunoOk;
}

/**
 * avisar({ texto, plantilla, params })
 *   texto     -> lo que ve Telegram (y WhatsApp si la ventana de 24 h está abierta)
 *   plantilla -> nombre de la plantilla aprobada en Meta
 *   params    -> variables {{1}}, {{2}}... de esa plantilla, en orden
 */
async function avisar({ texto, plantilla, params }) {
  const cfg = leerConfig();
  const canal = cfg.canal || 'telegram';
  const tareas = [];
  if (canal === 'telegram' || canal === 'ambos') tareas.push(avisarTelegram(texto, cfg));
  if (canal === 'whatsapp' || canal === 'ambos') tareas.push(avisarWhatsApp({ texto, plantilla, params }, cfg));
  const resultados = await Promise.all(tareas);
  const ok = resultados.some(Boolean);
  if (!ok) console.log('[aviso no enviado, canal sin configurar]', texto.replace(/\n/g, ' | '));
  return ok;
}

/* ---------------------------------------------------------------
   Lógica de asistencia
--------------------------------------------------------------- */
/* Distancia en metros entre dos coordenadas (fórmula del semiverseno) */
function distanciaM(lat1, lon1, lat2, lon2) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function registrarDocente(docente, origen = 'Punto de registro') {
  const cfg = leerConfig();
  const ahora = new Date();
  const fecha = fechaHoy(ahora);
  const hora = horaAhora(ahora);

  const previos = db.prepare('SELECT * FROM registros WHERE docente_id = ? AND fecha = ? ORDER BY hora').all(docente.id, fecha);

  if (previos.length) {
    const ultimo = previos[previos.length - 1];
    const yaCompleto = cfg.registrar_salida !== 'si' || previos.length > 1;
    // Sin registro de salida, el segundo escaneo solo confirma; no duplica ni vuelve a avisar.
    if (yaCompleto || aMinutos(hora.slice(0, 5)) - aMinutos(ultimo.hora.slice(0, 5)) < 2) {
      return { ok: true, repetido: true, docente: docente.nombre, tipo: ultimo.tipo, hora: ultimo.hora.slice(0, 5), estado: ultimo.estado };
    }
  }

  const esEntrada = previos.length === 0;
  let estado = 'salida';
  if (esEntrada) {
    const limite = aMinutos(cfg.hora_entrada) + Number(cfg.tolerancia_min);
    estado = aMinutos(hora.slice(0, 5)) > limite ? 'retardo' : 'puntual';
  }
  const tipo = esEntrada ? 'entrada' : 'salida';

  db.prepare('INSERT INTO registros (docente_id, fecha, hora, tipo, estado, estacion) VALUES (?, ?, ?, ?, ?, ?)')
    .run(docente.id, fecha, hora, tipo, estado, origen);

  const icono = estado === 'retardo' ? '🟠' : estado === 'puntual' ? '🟢' : '🔵';
  const etiqueta = estado === 'retardo' ? 'Retardo' : estado === 'puntual' ? 'Entrada puntual' : 'Salida';
  avisar({
    texto: `${icono} <b>${etiqueta}</b>\n${docente.nombre}${docente.materia ? ' · ' + docente.materia : ''}\n🕐 ${hora.slice(0, 5)} · ${fecha}`,
    plantilla: 'aviso_asistencia',
    params: [cfg.escuela, docente.nombre + (docente.materia ? ' (' + docente.materia + ')' : ''), tipo, hora.slice(0, 5), etiqueta],
  });

  return { ok: true, docente: docente.nombre, materia: docente.materia, tipo, estado, hora: hora.slice(0, 5) };
}

/* Modo gafete (opcional): la escuela escanea el QR del docente */
function registrarEscaneo(token, estacion = '') {
  const docente = db.prepare('SELECT * FROM docentes WHERE token = ? AND activo = 1').get(token);
  if (!docente) return { ok: false, motivo: 'Gafete no reconocido' };
  return registrarDocente(docente, estacion || 'Estación');
}

function hojaDelDia(fecha = fechaHoy()) {
  const docentes = db.prepare('SELECT * FROM docentes WHERE activo = 1 ORDER BY nombre').all();
  const registros = db.prepare('SELECT * FROM registros WHERE fecha = ? ORDER BY hora').all(fecha);
  return docentes.map((d) => {
    const mios = registros.filter((r) => r.docente_id === d.id);
    const entrada = mios.find((r) => r.tipo === 'entrada');
    const salida = [...mios].reverse().find((r) => r.tipo === 'salida');
    return {
      id: d.id,
      nombre: d.nombre,
      materia: d.materia,
      entrada: entrada ? entrada.hora.slice(0, 5) : null,
      salida: salida ? salida.hora.slice(0, 5) : null,
      estado: entrada ? entrada.estado : 'sin registro',
    };
  });
}

/* Aviso automático de quién no se registró, a la hora de corte */
let ultimoCorte = '';

function revisarCorte(forzar = false) {
  const cfg = leerConfig();
  const ahora = new Date();
  const hoy = fechaHoy(ahora);
  if (!forzar) {
    if (ultimoCorte === hoy) return;
    if (horaAhora(ahora).slice(0, 5) < cfg.hora_corte) return;
    if ([0, 6].includes(ahora.getDay())) { ultimoCorte = hoy; return; } // sin clases fin de semana
    ultimoCorte = hoy;
  }

  const hoja = hojaDelDia(hoy);
  const faltan = hoja.filter((f) => !f.entrada);
  const retardos = hoja.filter((f) => f.estado === 'retardo');

  // Un aviso por cada docente que no llegó, para que la dirección actúe de inmediato.
  // Si faltan muchos (puente, junta, suspensión), solo va el resumen.
  if (faltan.length && faltan.length <= 8) {
    for (const f of faltan) {
      avisar({
        texto: `🔴 <b>No se ha registrado</b>\n${f.nombre}${f.materia ? ' · ' + f.materia : ''}\nPasaron las ${cfg.hora_corte} y no hay escaneo.`,
        plantilla: 'falta_asistencia',
        params: [cfg.escuela, f.nombre + (f.materia ? ' (' + f.materia + ')' : ''), cfg.hora_corte, hoy],
      });
    }
  }

  let texto = `📋 <b>Corte de ${cfg.hora_corte} · ${hoy}</b>\nRegistrados: ${hoja.length - faltan.length} de ${hoja.length}`;
  if (retardos.length) texto += `\n\n🟠 Con retardo:\n` + retardos.map((r) => `• ${r.nombre} (${r.entrada})`).join('\n');
  texto += faltan.length ? `\n\n🔴 Sin registrar:\n` + faltan.map((f) => `• ${f.nombre}`).join('\n') : `\n\n✅ Nadie faltó.`;

  avisar({
    texto,
    plantilla: 'resumen_asistencia',
    params: [
      hoy,
      `${hoja.length - faltan.length} de ${hoja.length}`,
      retardos.length ? retardos.map((r) => `${r.nombre} ${r.entrada}`).join(', ') : 'ninguno',
      faltan.length ? faltan.map((f) => f.nombre).join(', ') : 'ninguno',
    ],
  });
}

setInterval(() => revisarCorte(), 60_000);
module.exports = { revisarCorte };

/* ---------------------------------------------------------------
   Archivos estáticos
--------------------------------------------------------------- */
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
function servirArchivo(res, relativo) {
  const archivo = path.join(__dirname, 'publico', relativo);
  if (!archivo.startsWith(path.join(__dirname, 'publico')) || !fs.existsSync(archivo)) {
    res.writeHead(404); return res.end('No encontrado');
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream' });
  fs.createReadStream(archivo).pipe(res);
}

/* ---------------------------------------------------------------
   Servidor
--------------------------------------------------------------- */
const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const ruta = url.pathname;
  const sesion = leerSesion(req);
  const esDireccion = sesion?.rol === 'direccion';
  const esEstacion = sesion?.rol === 'estacion' || esDireccion;

  try {
    /* ---- Sesión ---- */
    if (ruta === '/api/entrar' && req.method === 'POST') {
      const { clave } = await cuerpo(req);
      const cfg = leerConfig();
      let rol = null;
      if (clave === CLAVE_DIRECCION) rol = 'direccion';
      else if (clave === cfg.clave_estacion) rol = 'estacion';
      if (!rol) return json(res, { ok: false, motivo: 'Clave incorrecta' }, 401);
      res.setHeader('Set-Cookie', `sesion=${crearSesion(rol)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
      return json(res, { ok: true, rol });
    }
    if (ruta === '/api/salir') {
      res.setHeader('Set-Cookie', 'sesion=; Path=/; Max-Age=0');
      return json(res, { ok: true });
    }
    if (ruta === '/api/sesion') return json(res, { rol: sesion?.rol || null });

    /* ---- Escaneo (estación o dirección) ---- */
    if (ruta === '/api/escanear' && req.method === 'POST') {
      if (!esEstacion) return json(res, { ok: false, motivo: 'Sesión no válida' }, 401);
      const { token, estacion } = await cuerpo(req);
      return json(res, registrarEscaneo(String(token || '').trim(), estacion || 'Entrada principal'));
    }

    /* ---- Consultas de dirección ---- */
    if (ruta === '/api/hoy') {
      if (!esEstacion) return json(res, { error: 'no autorizado' }, 401);
      const fecha = url.searchParams.get('fecha') || fechaHoy();
      return json(res, { fecha, config: leerConfig(), hoja: hojaDelDia(fecha) });
    }

    if (ruta === '/api/docentes') {
      if (!esDireccion) return json(res, { error: 'no autorizado' }, 401);
      if (req.method === 'GET') return json(res, db.prepare('SELECT id, nombre, materia, telefono, token, pin, activo, (dispositivo_id IS NOT NULL) AS vinculado FROM docentes ORDER BY nombre').all());
      if (req.method === 'POST') {
        const { nombre, materia, telefono } = await cuerpo(req);
        if (!nombre || !nombre.trim()) return json(res, { ok: false, motivo: 'Falta el nombre' }, 400);
        const token = 'AS-' + crypto.randomBytes(12).toString('base64url');
        const pin = String(crypto.randomInt(1000, 10000));
        db.prepare('INSERT INTO docentes (nombre, materia, telefono, token, pin, creado) VALUES (?, ?, ?, ?, ?, ?)')
          .run(nombre.trim(), (materia || '').trim(), (telefono || '').trim(), token, pin, new Date().toISOString());
        return json(res, { ok: true, pin });
      }
      if (req.method === 'DELETE') {
        const id = Number(url.searchParams.get('id'));
        db.prepare('UPDATE docentes SET activo = 0 WHERE id = ?').run(id);
        return json(res, { ok: true });
      }
    }

    if (ruta === '/api/config' && req.method === 'POST') {
      if (!esDireccion) return json(res, { error: 'no autorizado' }, 401);
      const datos = await cuerpo(req);
      const permitidas = ['escuela', 'hora_entrada', 'tolerancia_min', 'hora_corte', 'registrar_salida', 'canal',
        'url_publica', 'escuela_lat', 'escuela_lng', 'radio_m', 'exigir_ubicacion', 'exigir_pin',
        'telegram_token', 'telegram_chat', 'wa_token', 'wa_phone_id', 'wa_destinos', 'wa_idioma', 'wa_version'];
      guardarConfig(Object.fromEntries(Object.entries(datos).filter(([k]) => permitidas.includes(k))));
      return json(res, { ok: true, config: leerConfig() });
    }

    if (ruta === '/api/probar-aviso' && req.method === 'POST') {
      if (!esDireccion) return json(res, { error: 'no autorizado' }, 401);
      const cfg = leerConfig();
      const ok = await avisar({
        texto: '✅ Prueba de conexión. Aquí llegarán los avisos de asistencia.',
        plantilla: 'aviso_asistencia',
        params: [cfg.escuela, 'Prueba del sistema', 'entrada', horaAhora().slice(0, 5), 'Puntual'],
      });
      return json(res, { ok });
    }

    /* ---- Disparar el aviso de faltas sin esperar la hora (útil en la demo) ---- */
    if (ruta === '/api/probar-corte' && req.method === 'POST') {
      if (!esDireccion) return json(res, { error: 'no autorizado' }, 401);
      revisarCorte(true);
      return json(res, { ok: true });
    }

    /* ---- Webhook de WhatsApp: abre la ventana gratuita de 24 h ---- */
    if (ruta === '/webhook/whatsapp') {
      const cfg = leerConfig();
      if (req.method === 'GET') {
        if (url.searchParams.get('hub.verify_token') === cfg.wa_verify) {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          return res.end(url.searchParams.get('hub.challenge') || '');
        }
        res.writeHead(403); return res.end();
      }
      if (req.method === 'POST') {
        const datos = await cuerpo(req);
        for (const entrada of datos.entry || []) {
          for (const cambio of entrada.changes || []) {
            for (const msg of cambio.value?.messages || []) {
              db.prepare('INSERT INTO wa_ventanas (numero, ultimo) VALUES (?, ?) ON CONFLICT(numero) DO UPDATE SET ultimo = excluded.ultimo')
                .run(String(msg.from).replace(/\D/g, ''), Date.now());
            }
          }
        }
        return json(res, { ok: true });
      }
    }

    /* ---- Reporte CSV ---- */
    if (ruta === '/api/reporte.csv') {
      if (!esDireccion) return json(res, { error: 'no autorizado' }, 401);
      const desde = url.searchParams.get('desde') || fechaHoy();
      const hasta = url.searchParams.get('hasta') || fechaHoy();
      const filas = db.prepare(`
        SELECT r.fecha, d.nombre, d.materia, r.tipo, r.hora, r.estado
        FROM registros r JOIN docentes d ON d.id = r.docente_id
        WHERE r.fecha BETWEEN ? AND ? ORDER BY r.fecha, d.nombre, r.hora`).all(desde, hasta);
      const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = '\uFEFF' + ['Fecha,Docente,Materia,Movimiento,Hora,Estado']
        .concat(filas.map((f) => [f.fecha, f.nombre, f.materia, f.tipo, f.hora, f.estado].map(esc).join(',')))
        .join('\n');
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="asistencia_${desde}_${hasta}.csv"` });
      return res.end(csv);
    }

    /* ---- Imagen QR del gafete ---- */
    if (ruta.startsWith('/api/qr/')) {
      if (!esDireccion) return json(res, { error: 'no autorizado' }, 401);
      const id = Number(ruta.split('/').pop().replace('.png', ''));
      const d = db.prepare('SELECT token FROM docentes WHERE id = ?').get(id);
      if (!d) { res.writeHead(404); return res.end(); }
      const png = await QRCode.toBuffer(d.token, { width: 520, margin: 1, errorCorrectionLevel: 'M' });
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
      return res.end(png);
    }

    /* ---- Punto de registro: el QR pegado en la pared ---- */
    if (ruta.startsWith('/r/')) return servirArchivo(res, 'registro.html');

    if (ruta === '/api/punto') {
      const cfg = leerConfig();
      if (url.searchParams.get('c') !== cfg.punto_token) return json(res, { ok: false, motivo: 'Este código ya no es válido' }, 403);
      const deviceId = leerOCrearDispositivo(req, res);
      const yo = db.prepare('SELECT id, nombre FROM docentes WHERE dispositivo_id = ? AND activo = 1').get(deviceId);
      return json(res, {
        ok: true,
        escuela: cfg.escuela,
        exigir_ubicacion: cfg.exigir_ubicacion === 'si' && cfg.escuela_lat !== '',
        exigir_pin: cfg.exigir_pin === 'si',
        yo: yo || null,
        docentes: db.prepare('SELECT id, nombre FROM docentes WHERE activo = 1 ORDER BY nombre').all(),
      });
    }

    if (ruta === '/api/registro' && req.method === 'POST') {
      const cfg = leerConfig();
      const { c, docente_id, pin, lat, lng } = await cuerpo(req);
      if (c !== cfg.punto_token) return json(res, { ok: false, motivo: 'Este código ya no es válido' }, 403);

      const deviceId = leerOCrearDispositivo(req, res);
      const docente = db.prepare('SELECT * FROM docentes WHERE id = ? AND activo = 1').get(Number(docente_id));
      if (!docente) return json(res, { ok: false, motivo: 'Selecciona tu nombre de la lista' }, 400);

      /*
       * EL CANDADO REAL: si ese maestro ya tiene un teléfono vinculado y este no es ese
       * teléfono, se rechaza sin importar el PIN. Esto es lo que impide que un compañero
       * lo registre "por el favor": tendría que traer físicamente el celular del otro.
       * Borrar cookies no ayuda al atacante: la vinculación vive en el servidor, no en el
       * navegador, así que un dispositivo nuevo simplemente no coincide y se rechaza igual.
       */
      if (docente.dispositivo_id && docente.dispositivo_id !== deviceId) {
        avisarIntentoSospechoso(docente);
        return json(res, {
          ok: false,
          motivo: `${docente.nombre} ya está vinculado a otro teléfono. Si es un celular nuevo o se perdió el anterior, dirección debe autorizarlo desde el panel.`,
        }, 403);
      }

      const yaVinculado = docente.dispositivo_id === deviceId;

      // El PIN solo protege el momento de la primera vinculación; después el teléfono ya es la prueba.
      if (cfg.exigir_pin === 'si' && !yaVinculado && String(pin || '') !== String(docente.pin)) {
        return json(res, { ok: false, motivo: 'PIN incorrecto' }, 401);
      }

      // Verificación de ubicación: el registro solo cuenta dentro del radio de la escuela
      if (cfg.exigir_ubicacion === 'si' && cfg.escuela_lat !== '') {
        if (typeof lat !== 'number' || typeof lng !== 'number') {
          return json(res, { ok: false, motivo: 'Activa la ubicación para poder registrarte' }, 400);
        }
        const metros = Math.round(distanciaM(Number(cfg.escuela_lat), Number(cfg.escuela_lng), lat, lng));
        if (metros > Number(cfg.radio_m || 150)) {
          return json(res, { ok: false, motivo: `Estás a ${metros} m de la escuela. El registro solo cuenta desde el plantel.` }, 403);
        }
      }

      if (!yaVinculado) {
        db.prepare('UPDATE docentes SET dispositivo_id = ? WHERE id = ?').run(deviceId, docente.id);
      }
      return json(res, { ...registrarDocente(docente), vinculado: true, primeraVez: !yaVinculado });
    }

    /* ---- Registro a mano desde dirección (para quien no trae celular) ---- */
    if (ruta === '/api/registro-manual' && req.method === 'POST') {
      if (!esDireccion) return json(res, { error: 'no autorizado' }, 401);
      const { id } = await cuerpo(req);
      const docente = db.prepare('SELECT * FROM docentes WHERE id = ? AND activo = 1').get(Number(id));
      if (!docente) return json(res, { ok: false, motivo: 'Docente no encontrado' }, 404);
      return json(res, registrarDocente(docente, 'Registro manual de dirección'));
    }

    /* ---- Autorizar un teléfono nuevo cuando el anterior se perdió o se cambió ---- */
    if (ruta === '/api/docentes/liberar' && req.method === 'POST') {
      if (!esDireccion) return json(res, { error: 'no autorizado' }, 401);
      const { id } = await cuerpo(req);
      db.prepare('UPDATE docentes SET dispositivo_id = NULL WHERE id = ?').run(Number(id));
      return json(res, { ok: true });
    }

    /* ---- QR y cartel del punto de registro ---- */
    if (ruta === '/api/qr-punto.png') {
      if (!esDireccion) return json(res, { error: 'no autorizado' }, 401);
      const cfg = leerConfig();
      const base = cfg.url_publica || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
      const png = await QRCode.toBuffer(`${base.replace(/\/$/, '')}/r/${cfg.punto_token}`, { width: 1000, margin: 1, errorCorrectionLevel: 'Q' });
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
      return res.end(png);
    }

    if (ruta === '/api/liga-punto') {
      if (!esDireccion) return json(res, { error: 'no autorizado' }, 401);
      const cfg = leerConfig();
      const base = cfg.url_publica || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
      return json(res, { liga: `${base.replace(/\/$/, '')}/r/${cfg.punto_token}` });
    }

    if (ruta === '/api/renovar-punto' && req.method === 'POST') {
      if (!esDireccion) return json(res, { error: 'no autorizado' }, 401);
      guardarConfig({ punto_token: crypto.randomBytes(6).toString('base64url') });
      return json(res, { ok: true });
    }

    /* ---- Páginas ---- */
    if (ruta === '/') return servirArchivo(res, esDireccion ? 'panel.html' : esEstacion ? 'escaner.html' : 'entrar.html');
    if (ruta === '/panel' && !esDireccion) return servirArchivo(res, 'entrar.html');
    if (ruta === '/gafetes' && !esDireccion) return servirArchivo(res, 'entrar.html');
    if (ruta === '/escaner' && !esEstacion) return servirArchivo(res, 'entrar.html');
    if (ruta === '/cartel' && !esDireccion) return servirArchivo(res, 'entrar.html');
    const paginas = { '/entrar': 'entrar.html', '/panel': 'panel.html', '/escaner': 'escaner.html', '/gafetes': 'gafetes.html', '/cartel': 'cartel.html' };
    if (paginas[ruta]) return servirArchivo(res, paginas[ruta]);

    return servirArchivo(res, ruta.slice(1));
  } catch (e) {
    console.error(e);
    return json(res, { error: 'Error interno' }, 500);
  }
});

servidor.listen(PUERTO, () => {
  const cfg = leerConfig();
  console.log(`\n  Asistencia docente — http://localhost:${PUERTO}`);
  console.log(`  Clave de dirección: ${CLAVE_DIRECCION}`);
  console.log(`  Clave de estación:  ${cfg.clave_estacion}\n`);
});
