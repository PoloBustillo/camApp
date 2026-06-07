# CamWatch — Configuración del Grabador Local (PC)

> **Objetivo:** Una PC en tu LAN graba 24/7 el video de las cámaras con FFmpeg,
> los sirve via HTTP (Tailscale) para que la app en el VPS los muestre.

---

## Requisitos

- PC con **Ubuntu 24.04**
- **Docker** y **Docker Compose** instalados
- **Tailscale** instalado y conectado a tu red (la PC debe alcanzar al VPS por IP Tailscale)
- Disco con al menos **512 GB** libres en `/mnt/recordings`

---

## Instalación

### 1. Preparar disco

```bash
# Crear directorio de grabaciones
sudo mkdir -p /mnt/recordings

# (Opcional) Montar disco adicional si existe
# sudo mount /dev/sdb1 /mnt/recordings
# echo "/dev/sdb1 /mnt/recordings ext4 defaults 0 2" | sudo tee -a /etc/fstab
```

### 2. Clonar el proyecto (o copiar la carpeta `recorder/`)

```bash
cd /opt
git clone <url-del-repo> camwatch
cd camwatch/recorder
```

O si prefieres independiente:

```bash
mkdir -p /opt/camwatch-recorder
# Copia todo el contenido de recorder/ a ese directorio
```

### 3. Configurar las cámaras

Copia el archivo de ejemplo:

```bash
cp config.env.example config.env
nano config.env
```

Edita `CAMERAS` con las rutas RTSP de tus cámaras.

**Formato:**

```json
# Si grabas directo de las cámaras en LAN (recomendado):
CAMERAS='[
  {"name":"entrada","url":"rtsp://192.168.1.101:554/stream1"},
  {"name":"cochera","url":"rtsp://192.168.1.102:554/h264"},
  {"name":"jardin","url":"rtsp://192.168.1.103:554/stream1"},
  {"name":"patio","url":"rtsp://192.168.1.104:554/main"},
  {"name":"sala","url":"rtsp://192.168.1.105:554/stream1"},
  {"name":"puerta","url":"rtsp://192.168.1.106:554/h264"}
]'
```

```json
# Si grabas desde MediaMTX en el VPS (via Tailscale):
CAMERAS='[
  {"name":"entrada","url":"rtsp://100.x.x.x:8554/cam-1"},
  {"name":"cochera","url":"rtsp://100.x.x.x:8554/cam-2"},
  {"name":"jardin","url":"rtsp://100.x.x.x:8554/cam-3"},
  {"name":"patio","url":"rtsp://100.x.x.x:8554/cam-4"},
  {"name":"sala","url":"rtsp://100.x.x.x:8554/cam-5"},
  {"name":"puerta","url":"rtsp://100.x.x.x:8554/cam-6"}
]'
```

> Cambia `100.x.x.x` por la IP Tailscale de tu VPS y los paths por los que
> tengas configurados en MediaMTX.

### 4. Configurar el servicio Nginx

El archivo `nginx.conf` ya está listo. Solo verifica que el puerto `8080` no esté ocupado:

```bash
sudo ss -tlnp | grep 8080
```

Si lo está, edita `docker-compose.recorder.yml` y cambia `8080:80` por otro puerto.

### 5. Iniciar

```bash
# Construir la imagen del recorder
docker compose -f docker-compose.recorder.yml build

# Iniciar servicios
docker compose -f docker-compose.recorder.yml up -d

# Ver logs
docker compose -f docker-compose.recorder.yml logs -f
```

### 6. Verificar

```bash
# ¿Están corriendo los servicios?
docker compose -f docker-compose.recorder.yml ps

# ¿Hay archivos grabándose?
ls -la /mnt/recordings/

# ¿El HTTP server responde?
curl http://localhost:8080/recordings/

# Desde el VPS (via Tailscale):
# curl http://<ip-tailscale-pc>:8080/recordings/
```

---

## Operación diaria

### Ver estado

```bash
# Resumen rápido
docker compose -f docker-compose.recorder.yml ps
du -sh /mnt/recordings/*/
```

### Limpieza automática

Crea un cron para mantener el disco limpio:

```bash
sudo crontab -e
# Agrega la siguiente línea (corre diario a las 3am):
0 3 * * * /opt/camwatch/recorder/cleanup.sh >> /var/log/camwatch-cleanup.log 2>&1
```

La política por defecto:
- Elimina grabaciones de más de **7 días** si el disco supera **80%** de uso
- Ajustable con flags: `--keep-days 14 --max-usage 90`

### Detener / Reiniciar

```bash
# Detener todo
docker compose -f docker-compose.recorder.yml down

# Reiniciar
docker compose -f docker-compose.recorder.yml restart

# Actualizar (tras cambios en entrypoint.sh)
docker compose -f docker-compose.recorder.yml build
docker compose -f docker-compose.recorder.yml up -d
```

### Agregar/quitar cámara

1. Edita `config.env` y modifica `CAMERAS`
2. Reinicia el servicio:
   ```bash
   docker compose -f docker-compose.recorder.yml restart recorder
   ```

---

## Arquitectura de directorios

```
/mnt/recordings/
├── entrada/
│   ├── 2026-06-06/
│   │   ├── 08-00-00.mp4   ← 10 min cada uno (~22 MB a 3 Mbps)
│   │   ├── 08-10-00.mp4
│   │   └── ...
│   └── 2026-06-07/
├── cochera/
└── ...
```

---

## Estimación de disco

| Cámaras | Resolución | Bitrate | /día | /mes |
|---------|-----------|---------|------|------|
| 6 | 1080p H.264 | ~3 Mbps | ~19 GB | ~570 GB |
| 6 | 1080p H.264 | ~2 Mbps | ~13 GB | ~390 GB |

Con 512 GB: **~27 días de grabación** a 3 Mbps.

> Para aumentar retención: el job nocturno puede re-encodificar segmentos
> antiguos a H.265 (CRF 23) reduciendo tamaño ~40-50%, duplicando la retención.

---

## Integración con la App Web (VPS)

Después de que la PC esté grabando, hay que conectar la app en el VPS para que pueda listar, buscar y reproducir las grabaciones.

### 7. Configurar `RECORDER_PC_URL` en el VPS

Agrega esta variable al `.env` del VPS:

```bash
# URL HTTP del Nginx de la PC grabadora via Tailscale
# Formato: http://<ip-tailscale-pc>:8080
RECORDER_PC_URL="http://100.x.x.x:8080"
```

> Cambia `100.x.x.x` por la IP Tailscale de la PC. Verifica desde el VPS:
> ```bash
> curl http://100.x.x.x:8080/recordings/   # debe responder con HTML
> ```

### 8. Migrar la base de datos

La app usa una tabla `recordings` en PostgreSQL. En el VPS:

```bash
cd /var/www/camwatch
DATABASE_URL="postgresql://camwatch:pass@localhost:5432/camwatch" \
  npx prisma migrate deploy
```

Esto crea la tabla y el enum `recording_deleted` en `AuditAction`.

### 9. Sincronizar grabaciones por primera vez

Una vez que la PC ya tenga archivos grabados:

1. Inicia sesión como **Admin** en la app
2. Ve a **Grabaciones** (sidebar)
3. Haz clic en **Sincronizar**
4. La app escanea la PC vía Tailscale, crea registros en la BD por cada archivo MP4 encontrado

O via API directamente:

```bash
curl -X POST https://tu-dominio.com/api/recordings \
  -H "Cookie: <session-cookie>"
```

### 10. Verificar reproducción

1. Ve a **Grabaciones** en la app
2. Selecciona una cámara y fecha
3. Aparecerá la lista de segmentos MP4
4. Haz clic en uno para reproducirlo
5. El video se sirve proxy desde la PC (byte-range requests, soporta seeking)

---

## Flujo de reproducir grabación

```
Browser → Next.js API Route (/api/recordings/:id)
         → consulta BD (metadatos)
         → fetch a PC via Tailscale (http://100.x.x.x:8080/recordings/...)
         → stream proxy con soporte byte-range
         → video en el browser
```

---

## Troubleshooting

| Problema | Causa | Solución |
|----------|-------|----------|
| No se crean archivos | URL RTSP incorrecta | Verifica con `ffplay rtsp://...` |
| FFmpeg se reinicia en bucle | Cámara no responde | Revisa que la cámara esté online |
| `curl localhost:8080` no responde | Nginx no arrancó | `docker compose logs nginx` |
| Poco espacio en disco | Retención muy larga | Ajusta `cleanup.sh --keep-days` |
| No se ve desde el VPS | Tailscale no conecta | `ping <ip-pc>` desde el VPS |
| `POST /api/recordings` falla | `RECORDER_PC_URL` no configurada | Verifica que exista en `.env` del VPS |
| Sincronización encuentra 0 archivos | Formato de directorios no coincide | Revisa que los archivos sigan la estructura `/recordings/<camera>/YYYY-MM-DD/HH-MM-SS.mp4` |
| Video no se reproduce | PC no alcanzable desde el VPS | `curl <RECORDER_PC_URL>/recordings/...` desde el VPS |
| Error 500 al sincronizar | Timeout de conexión | Aumenta el timeout en `src/app/api/recordings/route.ts` o verifica latencia Tailscale |
| "No hay grabaciones" en la UI | BD vacía | Ejecuta sincronización manual desde el botón en la UI o vía API |

### Probar una cámara manualmente

```bash
docker run --rm jrottenberg/ffmpeg:latest \
  -rtsp_transport tcp \
  -i rtsp://192.168.1.101:554/stream1 \
  -c copy -t 30 \
  test.mp4
```

Si genera `test.mp4` sin errores, el FFmpeg funciona y la cámara responde.
