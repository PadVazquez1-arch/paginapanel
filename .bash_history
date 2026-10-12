sudo service nginx start
sudo service nginx status
ss -tuln
sudo service nginx stop
ls
exit
ls
cd ~
ls
sudo apt update
uname -a
cat /etc/os-release
sudo install -m 0755 -d /etc/apt/keyrings
ls
sudo curl -fsSL https://download.docker.com/linux/debian/gph -o /etc/apt/keyrings/docker.asc
sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
ls -l /etc/apt/keyrings/docker.asc
head -1 /etc/apt/keyrings/docker.asc
status
wsl --list --verbose o wsl -l -v
wsl --status
docker ps
ls
. /etc/os-release && echo "$VERSION_CODENAME"
sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: $(. /etc/os-release && echo "$VERSION_CODENAME")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc


exit
close
cat

la
ls
ls /etc/apt/source.list/d
sudo ls /etc/apt/source.list/d
sudo ls /etc/apt/source.list.d
sudo ls /etc/apt/source.list.d/
sudo ls /etc/apt/sources.list.d/
echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian trixie stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo ls /etc/apt/sources.list.d/
sudo apt update
apt-cache policy docker-ce
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
docker --version
docker ps
sudo docker ps
id
sudo usermod -aG docker $USER
sudo usermod -aG docker $ror
echo sudo usermod -aG docker $USER
groups ror
wsl -shutdown
wsl --shutdown
WSL --shutdown
cd ~
ls
WSL --shutdown
root
whoiam
whiami
whoami
ls
sudo apt update
sudo apt install -y dnsutils traceroute netcat-openbsd tcpdump curl iputils-ping
which ip ss dig traceroute nc tcpdump
ip -c a
ip r
ip -c a show eth0 | grep inet
clear
ip -c a show eth0 | grep inet
ip r | grep default
clear
ip -c a show eth0 | grep inet
ip r | grep default
wxit
exit
iproute
iproute2
whoami
tcpdump
sudo tcdump
pwd
exit
pwd
exit
cd ~
pwd
ls
cd ~
clear
ip -c a show eth0 | grep init
ip r | grep default
ip a
ip -c=never -br a
sudo apt install unzip -y
ls /mnt/c/Users/
clear
cp /mnt/c/Users/usuario/Downloads/asistencia-docente-qr.zip
cp /mnt/c/Users/usuario/Downloads/asistencia-docente-qr.zip ~/
cd ~
unzip asistencia-docente-qr.zip -d asistencia
cd asistencia
npm install
curl -fsSl https://deb.nodesource.com/setup_ | sudo -E bash -
curl -fsSl https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
npm install
node semilla.js
node server.js
cd ~
cd ~/asistencia
node semilla.js
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cf.deb
sudo dpkg -i cf.deb
cloudflared tunnel --url http://localhost:3000
dir
ls
curl -s ifconfig.me; echo
cat /etc/resolv.conf
exit
cd ~
ls
dig google.com
dig @1.1.1.1 google.com
ping -c 3 1.1.1.1
dig +tcp @1.1.1. google.com
dig +tcp @1.1.1.1 google.com
dig @8.8.8.8 google.com
dig @1.0.0.1 google.com
dig +tcp @8.8.8.8 google.com
traceroute -n 1.1.1.1
dig @1.1.1.1 -x 1.1.1.1
dig @1.1.1.1 ch txt id.server
cloudflared tunnel --url http:localhost:3000
cd ~/asistencia 
node server.js
ls
rm asistencia-docente-qr.zip
ls
rm -rf asistencia
ls
cp /mnt/c/Users/usuario/Downloads/asistencia-docente-qr.zip ~/
ls
cp /mnt/c/Users/usuario/Downloads/asistencia-docente-qr.zip ~/
ls
rm asistencia-docente-qr.zip
ls
cp /mnt/c/Users/usuario/Downloads/asistencia-docente-qr_1.zip ~/
ls
cd ~
ls
clean
cl
clear
ls
unzip asistencia-docente-qr_1.zip -d asistencia
ls
cd asistencia
ls
node semilla.js
cd
cd asistencia
ls
sudo node semilla.js
ls
cd
ls
rm -rf asistencia
ls
rm -rf asistencia-docente-qr_1.zip
ls
clear
cp /mnt/c/Users/usuario/Downloads/asistencia-docente-qr_1.zip ~/
ls
unzip asistencia-docente-qr_1.zip -d asistencia
ls
cd asistencia
ls
npm install
ls
node semilla.js
node server.js
npm install -g pm2
sudo npm install -g pm2
pm2 start server.js --name asistencia 
pm2 save
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ror --hp /home/ror
sudo env PATH=/usr/bin:/usr/local/bin:/usr/lib/node_modules/pm2/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ror --hp /home/ror
pm2 save
systemctl is-system-running
pm2 save
pm2 status
cloudflared tunnel --url http://localhost:3000
pm2 status
cloudflared tunnel login
cloudflared tunnel create asistencia
cloudflared tunnel route dns asistencia asistencia.jacquesdelors.online
mkdir -p ~/.cloudflared
ls
nano ~/.cloudflared/config.yml
ls
nano ~/.cloudflared/config.yml
ls
cat ~/.cloudflared/config.yml
cloudflared tunnel run asistencia
sudo cloudflared service install
sudo mkdir -p /etc/cloudflared
sudo cp ~/.cloudflared/config.yml /etc/cloudflared/config.yml
sudo cp ~/.cloudflared/e1a9af32-f8e6-4c29-b15a-b8a0d781e534.json /etc/cloudflared/
sudo sed -i 's|/home/ror/.cloudflared/|/etc/cloudflared/|' /etc/cloudflared/config.yml
cat /etc/cloudflared/config.yml
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
sudo systemctl status cloudflared
ls
pm2 status
ls
cd asistencia
ls
cat semilla.js
ls
pm2 status
cp /mnt/c/Users/usuario/Downloads/registro.html ~/asistencia/publico/registro.html
ls
pm2 restart asistencia
pm2 status
clear
pm2 status
clear
pm2 status
clear
pm2 status
clear
pm2 status
clear
pm2 status
\
ls
ls /mnt/c/Users
cp /mnt/c/Users/usuario/Downloads/panel-estudio-local.zip ~/
ls
unzip panel-estudio-local.zip
ls
cd panel-estudio
ls -la
npm install
npm run inicio
ls
cd
ls
dir asistencia-docente-qr_1.zip
ls
rm -help
rm --help
rm -r asistencia-docente-qr_1.zip
ls
rm -r panel-estudio-local.zip
ls
cp /mnt/c/Users/usuario/Downloads/arreglo-reloj.py  ~/
ls
python version
python -version
ls
cd panel-estudio
ls
python3 arreglo-reloj.py
mv ~/arreglo-reloj.py ~/panel-estudio/
ls
python3 arreglo-reloj.py
npm run inicio
python3 - << 'FIN'
p = 'src/App.jsx'
s = open(p, encoding='utf-8').read()

a = "  }, [modo, datos?.config, corriendo]);"
b = "  }, [modo, datos?.config]);"
assert a in s, 'no encontre el efecto'
s = s.replace(a, b, 1)

a = "    setDatos((d) => ({ ...d, reloj: null }));\n    /* si la sesion"
c = """    const atraso = (Date.now() - r.finAt) / 1000;
    setDatos((d) => ({ ...d, reloj: null }));"""
assert c in s, 'no encontre terminar()'
s = s.replace(c, c + "\n    setRestante(duracion(r.modo));", 1)

open(p, 'w', encoding='utf-8').write(s)
print('arreglado')

ls
sed -i 's/}, \[modo, datos?.config, corriendo\]);/}, [modo, datos?.config]);/' src/App.jsx
sed -i '/const atraso = (Date.now() - r.finAt)/{n;s|$|\n    setRestante(duracion(r.modo));|}' src/App.jsx
grep -n "datos?.config" src/App.jsx
grep -n -A2 "const atraso" src/App.jsx
npm run inicio
cd
ls
cp /mnt/c/Users/TU_USUARIO/Downloads/App.jsx ~/panel-estudio/src/App.jsx
cp /mnt/Users/usuario/Downloads/App.jsx ~/panel-estudio/src/App.jsx
cp /mnt/Users/usuario/Descargas/App.jsx ~/panel-estudio/src/App.jsx
ls /mnt/c/Users
cp /mnt/c/Users/usuario/Downloads/App.jsx ~/panel-estudio/src/App.jsx
ls
cd panel-estudio
ls
grep -c "formatoDur" src/App.jsx
npm run inicio
ls
cd panel-estudio
npm run inicio
cd panel-estudio
npm run inicio
cd panel-estudio
npm run inicio
pm2 status
clear
pm2 status
clear
pm2 status
clear
pm2 status
clear
pm2 status
ls
cd asistencia
ls
cat semilla.js
ls
cd datos
ls
cat cd asistencia.db
cd °
cd ~
ls
clear
ls
pm2 status
clear
pm2 status
ls
pm2 status
