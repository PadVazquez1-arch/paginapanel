#!/usr/bin/env python3
"""Arregla el temporizador para que no se congele en pestañas de fondo."""
import shutil, sys, os

RUTA = 'src/App.jsx'
if not os.path.exists(RUTA):
    sys.exit('No encuentro src/App.jsx. Corre esto dentro de la carpeta panel-estudio.')

s = open(RUTA, encoding='utf-8').read()
if 'finAt' in s:
    sys.exit('Este archivo ya tiene el arreglo aplicado. No hago nada.')

shutil.copy(RUTA, RUTA + '.bak')

BLOQUE = """  /* ── temporizador ──
     Cuenta contra una marca de tiempo real (finAt), no sumando tics: los navegadores
     estrangulan setInterval en pestañas de fondo, así que un contador por tics se atrasa
     o se congela. Al volver a la pestaña se recalcula contra el reloj del sistema. */
  const [visibles, setVisibles] = useState(14);
  const [filtro, setFiltro] = useState('todas');
  const [modo, setModo] = useState('foco');
  const [restante, setRestante] = useState(25 * 60);
  const yaSono = useRef(false);

  const cfg = datos?.config ?? INICIAL.config;
  const duracion = (m) => (m === 'foco' ? cfg.foco : m === 'corto' ? cfg.corto : cfg.largo) * 60;
  const reloj = datos?.reloj ?? null;
  const corriendo = !!reloj;

  useEffect(() => {
    if (corriendo) return;
    setRestante(duracion(modo));
    // eslint-disable-next-line
  }, [modo, datos?.config, corriendo]);

  /* al abrir la app, retoma el modo que quedó corriendo */
  useEffect(() => {
    if (reloj && reloj.modo !== modo) setModo(reloj.modo);
    // eslint-disable-next-line
  }, [reloj?.modo]);

  useEffect(() => {
    if (!reloj) return;
    yaSono.current = false;

    const tic = () => {
      const seg = Math.max(0, Math.round((reloj.finAt - Date.now()) / 1000));
      setRestante(seg);
      if (seg === 0 && !yaSono.current) {
        yaSono.current = true;
        terminar(reloj);
      }
    };

    tic();
    const id = setInterval(tic, 500);
    /* al volver a la pestaña o a la ventana, recalcula de inmediato */
    const alVolver = () => { if (!document.hidden) tic(); };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', alVolver);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', alVolver);
    };
    // eslint-disable-next-line
  }, [reloj?.finAt, reloj?.modo]);

  /* el tiempo restante también en el título de la pestaña */
  useEffect(() => {
    const base = 'Mi bitácora';
    document.title = corriendo
      ? `${String(Math.floor(restante / 60)).padStart(2, '0')}:${String(restante % 60).padStart(2, '0')} · ${
          modo === 'foco' ? 'enfoque' : 'pausa'}`
      : base;
    return () => { document.title = base; };
  }, [restante, corriendo, modo]);

  const terminar = (r) => {
    const atraso = (Date.now() - r.finAt) / 1000;
    setDatos((d) => ({ ...d, reloj: null }));
    /* si la sesión terminó hace más de 6 horas (la compu estuvo suspendida,
       el navegador cerrado), no se acredita: sería inventar tiempo de estudio */
    if (atraso > 6 * 3600) return;
    pitido();
    avisar(r.modo);
    if (r.modo === 'foco') acreditarEnfoque();
  };

  const arrancar = () => {
    if (corriendo) {
      /* pausar: congela lo que falta */
      setRestante(Math.max(0, Math.round((reloj.finAt - Date.now()) / 1000)));
      setDatos((d) => ({ ...d, reloj: null }));
      return;
    }
    const seg = restante > 0 ? restante : duracion(modo);
    pedirPermiso();
    setDatos((d) => ({ ...d, reloj: { modo, finAt: Date.now() + seg * 1000 } }));
  };

  const reiniciarReloj = () => {
    setDatos((d) => ({ ...d, reloj: null }));
    setRestante(duracion(modo));
  };

  const pedirPermiso = () => {
    try {
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    } catch { /* sin permisos */ }
  };

  const avisar = (m) => {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(m === 'foco' ? 'Pomodoro terminado' : 'Se acabó la pausa', {
          body: m === 'foco' ? 'Levántate tantito y estira.' : 'De vuelta al enfoque.',
          tag: 'bitacora-pomodoro',
        });
      }
    } catch { /* sin notificaciones */ }
  };

"""

ini = s.index('  /* \u2500\u2500 temporizador')
fin = s.index('  const acreditarEnfoque = () =>')
s = s[:ini] + BLOQUE + s[fin:]

cambios = [
("""  const enfocar = (catId, temaId) => {
    setDatos((d) => ({ ...d, enfoque: { catId, temaId } }));
    setModo('foco');
    setRestante(duracion('foco'));
    setCorriendo(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const soltarEnfoque = () => { setCorriendo(false); setDatos((d) => ({ ...d, enfoque: null })); };""",
"""  const enfocar = (catId, temaId) => {
    setModo('foco');
    setRestante(duracion('foco'));
    pedirPermiso();
    setDatos((d) => ({
      ...d,
      enfoque: { catId, temaId },
      reloj: { modo: 'foco', finAt: Date.now() + duracion('foco') * 1000 },
    }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const soltarEnfoque = () => setDatos((d) => ({ ...d, enfoque: null, reloj: null }));"""),

("""onClick={() => setCorriendo((c) => !c)}>""", """onClick={arrancar}>"""),

("""              <button className="pe-btn" title="Volver a empezar"
                onClick={() => { setCorriendo(false); setRestante(duracion(modo)); }}>""",
"""              <button className="pe-btn" title="Volver a empezar" onClick={reiniciarReloj}>"""),

("""onClick={() => { setCorriendo(false); setModo(m); }}>{etiq}</button>""",
"""onClick={() => { setDatos((d) => ({ ...d, reloj: null })); setModo(m); }}>{etiq}</button>"""),

("""  enfoque: null,
  categorias: [""", """  enfoque: null,
  reloj: null,
  categorias: ["""),
]

for viejo, nuevo in cambios:
    if viejo not in s:
        sys.exit('No encontre este fragmento, el archivo no es el esperado:\n' + viejo[:80])
    s = s.replace(viejo, nuevo, 1)

if 'setCorriendo' in s:
    sys.exit('Quedaron referencias a setCorriendo. Revisa a mano.')

open(RUTA, 'w', encoding='utf-8').write(s)
print('Listo. Copia de seguridad en src/App.jsx.bak')
