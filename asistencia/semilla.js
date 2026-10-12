/**
 * Datos de ejemplo para una demostración.
 *
 *   node semilla.js
 *
 * Da de alta seis docentes y deja a dos ya registrados: uno puntual y uno con retardo,
 * para que el panel se vea con vida desde el primer momento.
 * Borra la carpeta `datos/` para volver a empezar de cero.
 */

const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const DIR_DATOS = process.env.DIR_DATOS || path.join(__dirname, 'datos');
const db = new DatabaseSync(path.join(DIR_DATOS, 'asistencia.db'));

const DOCENTES = [
  ['Ana Sofía García Cantú', 'Matemáticas'],
  ['Luis Alberto Ramírez', 'Historia'],
  ['Marta Elena Cantú', 'Español'],
  ['Jorge Iván Treviño', 'Educación Física'],
  ['Rosa María Elizondo', 'Inglés'],
  ['Héctor Manuel Salinas', 'Ciencias'],
];

const p = (n) => String(n).padStart(2, '0');
const hoyD = new Date();
const hoy = `${hoyD.getFullYear()}-${p(hoyD.getMonth() + 1)}-${p(hoyD.getDate())}`;

const alta = db.prepare('INSERT INTO docentes (nombre, materia, telefono, token, creado) VALUES (?, ?, ?, ?, ?)');
const marcar = db.prepare('INSERT INTO registros (docente_id, fecha, hora, tipo, estado, estacion) VALUES (?, ?, ?, ?, ?, ?)');

let creados = 0;
for (const [nombre, materia] of DOCENTES) {
  const existe = db.prepare('SELECT id FROM docentes WHERE nombre = ?').get(nombre);
  if (existe) continue;
  alta.run(nombre, materia, '', 'AS-' + crypto.randomBytes(12).toString('base64url'), new Date().toISOString());
  creados++;
}

const lista = db.prepare('SELECT id, nombre FROM docentes ORDER BY id').all();
const yaHay = db.prepare('SELECT COUNT(*) AS n FROM registros WHERE fecha = ?').get(hoy).n;
if (!yaHay && lista.length >= 2) {
  marcar.run(lista[0].id, hoy, '06:52:14', 'entrada', 'puntual', 'Acceso principal');
  marcar.run(lista[1].id, hoy, '07:23:41', 'entrada', 'retardo', 'Acceso principal');
}

console.log(`\n  Docentes nuevos: ${creados}`);
console.log(`  Plantilla total: ${lista.length}`);
console.log(`  Registros de hoy: ${db.prepare('SELECT COUNT(*) AS n FROM registros WHERE fecha = ?').get(hoy).n}`);
console.log('\n  Códigos para probar sin cámara (pégalos en el campo de la estación):\n');
for (const d of db.prepare('SELECT nombre, token FROM docentes WHERE activo = 1').all()) {
  console.log(`  ${d.token}   ${d.nombre}`);
}
console.log('');
