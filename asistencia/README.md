# Asistencia docente por QR

Control de entrada y salida del personal docente. Cada maestro trae un gafete con código QR,
lo acerca a una tablet o celular en recepción y la dirección recibe el aviso en Telegram al instante.

- **Un QR pegado en la entrada**: el maestro lo escanea con su propio celular, elige su nombre y
  pone su PIN. La primera vez nada más; después el teléfono ya lo reconoce y es un solo toque.
- **Verificación de ubicación**: el registro solo cuenta si el celular está dentro del radio de la
  escuela. Sin eso, un QR pegado en la pared se puede fotografiar y checar desde la cama.
- **Aviso de faltas**: a la hora que definas (por ejemplo 7:15) llega un mensaje por cada docente
  que no se escaneó, más el resumen del día.
- **Panel de dirección**: hoja del día, retardos, faltas, reporte en Excel.
- **Cartel imprimible**: el QR grande con las instrucciones, listo para pegar en la entrada.
- **Registro manual**: para el maestro que llegó sin celular o sin pila, la dirección lo marca
  con un botón desde la hoja del día.

## Demostración en 5 minutos

```bash
npm install
node semilla.js     # seis docentes de ejemplo, dos ya registrados
node server.js
```

Abre `http://localhost:3000` y entra con la clave de dirección (`direccion2026` si no la cambiaste).

- El panel ya se ve con vida: uno puntual, uno con retardo, cuatro sin registrar.
- En **Ajustes → Simular el aviso de faltas** se dispara el aviso al momento, sin esperar a las 7:15.
  Es lo que hay que enseñar en la junta.
- La pestaña **Punto QR → Ver e imprimir el cartel** abre el cartel con el código grande.
- En **Docentes** aparece el PIN de cada quien, que es lo que la dirección les reparte.
- Para probar el registro desde tu computadora, abre la liga del cartel en otra ventana.
  Ojo: con la verificación de ubicación encendida hace falta HTTPS, así que para la prueba local
  déjala en *No, desde cualquier lugar*.

## Requisitos

- Node.js 22.5 o superior (usa el SQLite integrado, no requiere instalar base de datos).
- La estación de escaneo necesita **HTTPS** o `localhost`: los navegadores no dan acceso a la cámara
  en `http://` de red. Con un dominio + Caddy o Nginx se resuelve en minutos.

## Arrancar en tu computadora

```bash
npm install
cp .env.example .env      # cambia CLAVE_DIRECCION y SECRETO
node server.js
```

Abre `http://localhost:3000`, entra con la clave de dirección y da de alta a los docentes.
La clave de la estación se imprime en la consola al arrancar y también aparece en Ajustes.

## Arrancar con Docker

```bash
docker build -t asistencia .
docker run -d --name asistencia -p 3000:3000 \
  -e CLAVE_DIRECCION="clave-de-la-escuela" \
  -e SECRETO="cadena-larga-aleatoria" \
  -v asistencia_datos:/app/datos \
  --restart unless-stopped asistencia
```

Los datos viven en el volumen `/app/datos`. Respaldarlos es copiar un solo archivo:
`datos/asistencia.db`.

## Conectar los avisos de Telegram

1. En Telegram, busca **@BotFather** y manda `/newbot`. Te devuelve un **token**.
2. La directora abre una conversación con el bot y le escribe cualquier cosa
   (o lo agrega a un grupo de dirección).
3. Abre `https://api.telegram.org/bot<TOKEN>/getUpdates` en el navegador y copia el `chat.id`.
4. Pega token y chat ID en **Ajustes → Avisos a dirección** y usa *Enviar aviso de prueba*.

Si se agrega el bot a un grupo, todo el equipo directivo recibe los avisos sin costo extra.

## Conectar los avisos por WhatsApp

En **Ajustes → Avisos a dirección** cambia el canal a WhatsApp. Se necesita la Cloud API oficial
de Meta; el WhatsApp normal del celular no sirve para esto.

1. Crea una cuenta de Meta Business y una app de tipo *Business* en developers.facebook.com.
2. Agrega el producto **WhatsApp** y da de alta un número que **no** esté usándose en la app
   normal de WhatsApp. Meta regala un número de pruebas para las primeras demos.
3. Copia el **Phone number ID** y genera un **token permanente** desde un usuario del sistema
   (el token de prueba de 24 horas solo sirve para probar).
4. Pega token, Phone number ID e idioma en Ajustes, y escribe los números que reciben el aviso
   con lada de país: `5218991234567`.
5. Da de alta las dos plantillas de abajo y espera la aprobación (suele tardar minutos).

### Plantillas que hay que registrar en Meta

Categoría **Utilidad** en las tres, idioma **es_MX**. Los nombres deben quedar idénticos.

**`aviso_asistencia`**

```
Aviso de asistencia · {{1}}
Docente: {{2}}
Movimiento: {{3}}
Hora: {{4}}
Estado: {{5}}
Enviado automáticamente por el sistema de registro.
```

**`falta_asistencia`**

```
Alerta de asistencia · {{1}}
Docente: {{2}}
No registró su entrada antes de las {{3}}.
Fecha: {{4}}
Revisa el detalle en el panel de dirección.
```

**`resumen_asistencia`**

```
Corte de asistencia del día {{1}}
Presentes: {{2}}
Retardos: {{3}}
Sin registrar entrada: {{4}}
Revisa el detalle en el panel de dirección.
```

Meta rechaza plantillas que empiezan o terminan con variable, así que no les quites la primera
ni la última línea. Las variables no pueden llevar saltos de línea: el servidor ya las limpia.

### Webhook (opcional pero conviene)

Si publicas la app con HTTPS, registra en Meta el webhook `https://tu-dominio/webhook/whatsapp`
con el token de verificación que aparece en la base de datos (`config.wa_verify`) y suscríbete al
campo `messages`. Sirve para algo concreto: cuando la directora le escribe cualquier cosa al bot
se abre una ventana de 24 horas en la que los avisos viajan como texto libre y **no se cobran**.
Sin webhook todo sale por plantilla y todo se cobra.

### Cuánto cuesta

Meta cobra por mensaje entregado desde julio de 2025 y actualiza tarifas cada trimestre.
En México la plantilla de utilidad ronda **USD $0.008 por mensaje** (unos 15 centavos de peso),
y las plantillas de utilidad enviadas dentro de la ventana de 24 horas no se cobran.

Cuenta rápida para una escuela de 30 docentes con un solo escaneo diario: 30 avisos de entrada
+ 2 o 3 de falta + 1 resumen ≈ 34 mensajes al día × 20 días ≈ 680 mensajes ≈ **USD $5.50 al mes**
(~100 pesos). Con la ventana de 24 horas abierta baja casi a cero.
Súmalo a la mensualidad antes de cotizar, y revisa la tarifa vigente en la documentación de Meta
antes de cerrar el precio.

### Grupos

Meta abrió la Groups API a cuentas con Official Business Account: hasta 8 participantes por grupo,
por invitación y con precio por mensaje. Para un equipo directivo alcanza, pero pide verificación
de la empresa. Mientras tanto es más simple mandar el aviso a dos o tres números por separado,
que es como está configurado.

## Puesta en marcha en la escuela

1. Ajustes: nombre de la escuela, hora de entrada, tolerancia y hora del aviso de faltas.
2. Docentes: alta de toda la plantilla.
3. Punto QR: parado en la escuela, *Usar mi ubicación actual* y guardar.
4. Cartel: imprimir, plastificar y pegarlo en la entrada, a la altura de la vista.
5. Repartir los PINs. Salen en la pestaña Docentes.

## El punto de registro

El QR de la pared **no identifica a nadie**: solo dice de qué escuela es. Quien identifica al
docente es la combinación de tres cosas:

1. **Su nombre**, que elige de la lista, solo la primera vez.
2. **Su PIN de 4 dígitos**, que se genera solo al darlo de alta y aparece en la pestaña Docentes.
   Solo se pide esa primera vez.
3. **La ubicación de su teléfono**, que tiene que estar dentro del radio configurado.
4. **La vinculación del teléfono**, que es el candado que de verdad importa.

### El candado contra los maestros que se cubren entre sí

Esto es distinto a los otros tres y conviene entenderlo bien, porque es la pregunta que más va
a hacer una directora: *"¿y si dos maestros se cubren, uno checa por el otro?"*

El PIN y la ubicación no resuelven eso: si Luis quiere encubrir a Piedad, Luis **está** en la
escuela, así que la ubicación lo aprueba, y ella le pasó su PIN por WhatsApp en tres segundos.

Lo que sí lo resuelve es que **cada maestro queda vinculado a un solo teléfono, para siempre**.
La primera vez que Piedad se registra con su nombre y su PIN, el servidor guarda en su base de
datos que ese teléfono —y solo ese— es el de Piedad. De ahí en adelante, si alguien intenta
registrar a "Piedad" desde un teléfono distinto, se rechaza **aunque el PIN sea correcto**, y a
dirección le llega un aviso de que alguien lo intentó.

Verificado en pruebas: Luis, desde su propio celular, con el PIN correcto de Piedad, recibe:
*"Piedad ya está vinculado a otro teléfono. Si es un celular nuevo o se perdió el anterior,
dirección debe autorizarlo desde el panel."* Y a dirección le llega: *"🔒 Registro bloqueado.
Alguien intentó registrar a Piedad desde un teléfono distinto al suyo."*

**Borrar cookies no ayuda al que hace trampa.** La vinculación vive en el servidor, no en el
navegador del teléfono. Un dispositivo nuevo simplemente no coincide con el guardado, sin
importar cuántas veces se borre el historial.

**Cuándo sí hay que desvincular, y cómo:** un maestro pierde su celular o lo cambia. Dirección
va a **Docentes**, busca su nombre — dice "Teléfono vinculado" — y toca **Autorizar teléfono
nuevo**. A partir de ahí, el siguiente que se registre con su nombre y su PIN queda vinculado
como el nuevo teléfono. Por eso el PIN importa: sin él, cualquiera podría reclamar ser "el
teléfono nuevo de Piedad" el día que dirección libera la vinculación.

**Lo que esto no resuelve:** si un maestro nunca ha usado el sistema, cualquiera puede registrar
el primer teléfono a su nombre, con o sin PIN correcto según cómo lo tengas configurado. Por eso
conviene que todos los maestros se registren el primer día, con el PIN activado: en cuanto cada
quien vincula su propio teléfono, el hueco se cierra solo.

Para configurarlo, abre el panel **estando en la escuela** y usa *Punto QR → Usar mi ubicación
actual*. El radio de 150 m por defecto funciona bien: cubre el plantel completo y absorbe el error
del GPS, que en celular anda entre 10 y 40 m. Si la escuela es chica y quieres apretar, no bajes
de 80 m o vas a tener falsos rechazos en días nublados.

Si alguna vez se filtra el código, *Generar un código nuevo* invalida el cartel viejo al instante.
Nada más hay que imprimir el nuevo.

### Lo que este diseño no resuelve

Un maestro puede llegar al estacionamiento, checar desde el coche y volverse a ir. La ubicación
prueba presencia, no permanencia. Si la escuela necesita esa garantía, la respuesta es un segundo
registro de salida (se enciende en Ajustes) o una pantalla con QR rotativo, que ya es otra versión.

Tampoco evita que alguien le preste su propio teléfono ya vinculado a un compañero por un día.
Eso ya no es "hazme el paro" desde el celular de uno mismo: es prestarle el teléfono completo,
con todo lo que eso implica. La fricción social sube mucho, pero técnicamente sigue siendo
posible. Dilo tú antes de que lo descubran ellos: vende mejor.

## Modo gafete (opcional)

El sistema también acepta el modelo contrario: gafete con QR para cada docente y una tablet en
recepción que los escanea, en `/escaner` y `/gafetes`. Sirve para escuelas donde los maestros no
traen smartphone. Los dos modos conviven; los registros caen en la misma hoja.

## Cómo funciona el registro

- Un escaneo por docente por día. El segundo escaneo solo confirma en pantalla que ya está
  registrado; no duplica nada ni vuelve a avisar a dirección.
- Si el escaneo pasa de `hora de entrada + tolerancia`, se marca **retardo** y el aviso lo dice.
- A la hora de aviso de faltas (por defecto 07:15, de lunes a viernes) la dirección recibe un
  mensaje por cada docente sin registro, y al final el resumen del día.
- Si faltan más de 8 docentes el mismo día —puente, junta, suspensión— solo se manda el resumen,
  para no inundar el teléfono de la directora.
- Si un docente llega después del aviso, su escaneo genera su propia notificación de retardo,
  así que la dirección ve la corrección sin tener que preguntar.
- El registro de salida viene apagado. Se enciende en Ajustes si algún día lo piden.
- El código del gafete no dice nada por sí solo: es un identificador aleatorio que solo
  el servidor sabe a quién pertenece. Sirve únicamente contra la cámara de la estación.

## Estructura

```
server.js              API, base de datos, tokens y avisos
publico/entrar.html    acceso a dirección
publico/registro.html  lo que ve el maestro al escanear el QR de la pared
publico/cartel.html    cartel imprimible con el QR
publico/panel.html     panel de dirección
publico/escaner.html   modo gafete: estación con cámara
publico/gafetes.html   modo gafete: credenciales para imprimir
datos/asistencia.db    base de datos (se crea sola)
```

## Ideas para la siguiente versión

- Pantalla con QR rotativo cada 30 segundos, para escuelas que quieran cerrar el hueco de la foto.
- Justificantes y permisos cargados por la dirección.
- Reporte mensual en PDF con firma de la directora.
- Alta de alumnos con aviso a padres (es el mismo motor, otro cliente).
