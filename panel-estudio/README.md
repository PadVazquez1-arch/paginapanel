# Mi bitácora — despliegue en tu PC

Panel de listas, hábitos y pomodoro. Corre en tu máquina, guarda todo en tu navegador
y opcionalmente jala pendientes de Notion.

---

## 1. Requisitos

Dentro de WSL, revisa si ya tienes Node:

```bash
node -v
```

Si marca menos de 18 o no existe:

```bash
sudo apt update && sudo apt install -y nodejs npm
```

Si tu distro trae una versión vieja, instala Node 20 desde NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Desglose de `curl -fsSL`:

| bandera | qué hace |
|---|---|
| `-f` | falla en silencio si el servidor responde con error, en vez de bajar una página de error |
| `-s` | modo silencioso, sin barra de progreso |
| `-S` | pero sí muestra el error si algo truena (se usa junto con `-s`) |
| `-L` | sigue redirecciones |

Y en `sudo -E bash -`, la `-E` conserva tus variables de entorno (útil si sales por un proxy)
y el guion final le dice a bash que lea el script desde la entrada estándar.

---

## 2. Instalar el proyecto

```bash
cd ~/panel-estudio
npm install
```

---

## 3. Correrlo

### Para usarlo día a día

```bash
npm run inicio
```

Eso compila el panel y levanta el servidor. Abre **http://localhost:8787**.

### Para modificarlo

```bash
npm run dev
```

Levanta dos procesos: Vite en el 5173 con recarga automática, y el servidor de Notion en el 8787.
Trabaja en **http://localhost:5173**; las peticiones a `/api` se reenvían solas al 8787.

---

## 4. Entrar desde el celular o desde otra compu

El servidor escucha en `0.0.0.0`, o sea en todas las interfaces. Pero WSL2 vive en su propia
red virtual, así que hay que abrirle paso desde Windows.

**a) Averigua la IP de WSL** (dentro de WSL):

```bash
ip -4 addr show eth0 | grep inet
```

**b) Averigua la IP de tu PC en la red de casa** (en PowerShell de Windows):

```powershell
ipconfig
```

Busca la "Dirección IPv4" de tu adaptador Wi-Fi, algo como `192.168.1.40`.

**c) Reenvía el puerto** (PowerShell **como administrador**):

```powershell
netsh interface portproxy add v4tov4 listenport=8787 listenaddress=0.0.0.0 connectport=8787 connectaddress=<IP_DE_WSL>
netsh advfirewall firewall add rule name="Bitacora" dir=in action=allow protocol=TCP localport=8787
```

Qué es cada parte:

| parte | qué significa |
|---|---|
| `v4tov4` | escucha IPv4 y reenvía a IPv4 |
| `listenaddress=0.0.0.0` | acepta conexiones desde cualquier interfaz de Windows |
| `listenport` | el puerto que tocan desde afuera |
| `connectaddress` | a dónde manda el tráfico: la IP de WSL |
| `dir=in` | la regla del firewall aplica al tráfico entrante |

Ya con eso, desde el celular entras a `http://192.168.1.40:8787`.

Para ver qué reenvíos tienes activos: `netsh interface portproxy show all`
Para borrar el que hiciste: `netsh interface portproxy delete v4tov4 listenport=8787 listenaddress=0.0.0.0`

> La IP de WSL cambia cada vez que reinicias. Si te harta rehacer el `portproxy`,
> activa el modo de red espejo: crea `C:\Users\<tu-usuario>\.wslconfig` con
> `[wsl2]` y abajo `networkingMode=mirrored`. Con eso WSL comparte la IP de Windows
> y ya no necesitas reenviar nada.

**En el celular**, abre la página y usa "Agregar a pantalla de inicio". Queda como si fuera una app.

---

## 5. Que arranque solo

Dentro de WSL, con systemd activo (`[boot]` + `systemd=true` en `/etc/wsl.conf`):

```bash
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/bitacora.service << 'EOF'
[Unit]
Description=Panel de bitacora
After=network.target

[Service]
WorkingDirectory=%h/panel-estudio
ExecStart=/usr/bin/node server.mjs
Restart=always

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now bitacora
systemctl --user status bitacora
```

`enable` lo deja registrado para el arranque y `--now` lo prende de una vez.
Para ver qué está imprimiendo: `journalctl --user -u bitacora -f` (la `-f` se queda
siguiendo el registro en vivo, como `tail -f`).

---

## 6. Conectar Notion

1. Entra a https://www.notion.so/my-integrations y crea una integración interna.
2. Copia el secreto (empieza con `ntn_`).
3. Abre tu base de datos de tareas en Notion → menú `...` → **Conexiones** → agrega tu integración.
   Sin este paso la API responde "object not found" aunque el token esté bien.
4. Copia el ID de la base: de la URL `notion.so/tuespacio/`**`28ab1f9f4c5f80b18d3bd10a6b1d2f4e`**`?v=...`
   es el bloque de 32 caracteres antes del `?v=`.
5. En el proyecto:

```bash
cp .env.example .env
nano .env
```

Llena `NOTION_TOKEN` y `NOTION_DATABASE_ID`, guarda y reinicia el servidor.

El panel filtra fuera lo que tenga estado tipo "hecho", "done", "completado" o "terminado".
Si en tu base usas otras palabras, cámbialas en la expresión regular al final de
`app.get('/api/notion/pendientes')` dentro de `server.mjs`.

---

## 7. Si lo quieres accesible fuera de tu casa

Tres caminos, de menos a más trabajo:

- **Túnel Cloudflare**: `cloudflared tunnel --url http://localhost:8787`. Te da una URL pública
  al instante. Ojo: cualquiera con esa liga entra, no tiene contraseña.
- **Tailscale**: instalas el cliente en la PC y en el celular, y entras por la IP privada de la
  red virtual desde donde estés. Es la opción más segura y no expone nada a internet.
- **Hosting estático** (Netlify, Vercel, GitHub Pages): subes solo la carpeta `dist`.
  Funciona todo menos Notion, porque ahí no corre el servidor. Además los datos viven en el
  navegador de cada dispositivo, así que celular y PC llevarían registros separados.

---

## Dónde se guardan tus datos

En el `localStorage` del navegador, bajo la clave `panel-estudio-v1`. No hay base de datos ni nube.
Consecuencias:

- Si borras los datos de navegación, se va tu registro.
- Cada navegador y cada dispositivo tiene su propia copia.

Por eso están los botones **CSV** y **Respaldo** del registro diario: haz respaldo de vez en cuando.
Si más adelante quieres que PC y celular compartan el mismo registro, el siguiente paso es guardar
el JSON en el servidor en lugar del navegador — son unas 20 líneas en `server.mjs`.
