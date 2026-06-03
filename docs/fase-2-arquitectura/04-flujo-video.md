# 2.4 — Flujo de Video

**Proyecto:** CamWatch Platform  
**Versión:** 1.0  
**Fecha:** Junio 2026

---

## Pipeline Completo de Video

```
FUENTE                 INGESTIÓN              RETRANSMISIÓN         REPRODUCCIÓN
──────                 ─────────              ─────────────         ────────────

┌──────────┐  RTSP     ┌──────────────────┐   WebRTC/WHEP  ┌──────────────────┐
│ Cámara   ├──────────►│                  ├──────────────►│                  │
│  IP      │  H.264    │   MediaMTX       │   H.264/VP8   │  Browser         │
│ (físico) │  RTSP     │   Server         │   over DTLS   │  WebRTC Player   │
└──────────┘           │                  │               │  (RTCPeerConn.)  │
                        │ • Ingesta RTSP   │               └──────────────────┘
                        │ • Convierte a    │
                        │   WebRTC/WHEP    │
                        │ • No transcodifi-│
                        │   ca (passthru)  │
                        └──────────────────┘

Protocolo:  RTSP/TCP          RTSP→WebRTC (WHEP)         WebRTC (DTLS/SRTP)
Codec:      H.264             H.264 (passthrough)         H.264
Latencia:   ~0ms              ~100-300ms (buffer)          ~300-800ms total
Cifrado:    Solo si RTSPS     No (red privada Tailscale)   DTLS + SRTP (obligatorio)
```

---

## Flujo de Señalización WebRTC (WHEP)

```
Browser                    Backend API              MediaMTX
──────────                 ───────────              ─────────

1. Usuario abre Dashboard
   │
   ▼
2. Solicita token de stream
   POST /api/cameras/:id/stream-token
   ──────────────────────────────────►
                              │
                    3. Verifica que el stream
                       está activo en MediaMTX
                       GET http://100.x.x.x:9997/v3/paths/camera1
                       ───────────────────────────────────────────►
                                                          │
                                                 4. Devuelve estado del path
                                                 ◄───────────────────────────
                              │
                    5. Genera token JWT temporal
                       (exp: 30 segundos, sub: cameraId)
                       Firma con MEDIAMTX_JWT_SECRET
                              │
   6. Recibe token temporal
   ◄──────────────────────────
   │
   ▼
7. Inicia negociación WHEP directa con MediaMTX
   POST https://camwatch.ejemplo.com:8889/camera1/whep
   Headers: Authorization: Bearer <token_temporal>
   Body: SDP Offer (RTCPeerConnection.createOffer())
   ──────────────────────────────────────────────────────────────►
                                                          │
                                                 8. Valida token JWT
                                                    Genera SDP Answer
                                                    │
   9. Recibe SDP Answer
   ◄──────────────────────────────────────────────────────────────
   │
   ▼
10. RTCPeerConnection.setRemoteDescription(answer)
    Intercambio de ICE candidates
    ──────────────────────────────────────────────────────────────►
                                                          │
                                                 11. ICE Handshake
                                                 ◄───────────────►
    │
    ▼
12. Conexión establecida — video fluye directamente
    Browser ◄══════════ WebRTC (DTLS+SRTP) ══════════ MediaMTX
    (H.264, < 1s latencia)
```

---

## Flujo de Reconexión Automática

```
Estado: Conectado
│
├─ [Stream se interrumpe] → ontrack lost / connection failed
│
▼
Estado: Reconnecting (Intento 1)
│  Espera: 5 segundos
│
├─ [Éxito] → Estado: Conectado
├─ [Fallo] → Intento 2
│             Espera: 10 segundos
│
├─ [Éxito] → Estado: Conectado
├─ [Fallo] → Intento 3
│             Espera: 30 segundos
│
├─ [Éxito] → Estado: Conectado
├─ [Fallo] → Intento 4
│             Espera: 60 segundos
│
├─ [Éxito] → Estado: Conectado
├─ [Fallo] → Estado: Sin Señal
│             Muestra: icono de cámara desconectada
│             Botón: "Intentar reconectar" (manual)
│
└─ [Usuario hace clic en reconectar] → Reinicia el ciclo
```

---

## Configuración de MediaMTX para Cada Stream

```yaml
# mediamtx.yml — configuración por path de cámara

paths:
  camera1:
    source: rtsp://admin:password@192.168.1.101:554/stream1
    sourceOnDemand: no           # Siempre conectado, no bajo demanda
    rtspRangeType: clock
    record: no                   # Sin grabación en MVP

    # Opciones de seguridad WebRTC
    publishUser: ""
    publishPass: ""
    readUser: ""                 # Autenticación manejada por JWT externo
    readPass: ""

    # Buffer para sincronización
    rpiCameraBitrate: 5000000

  camera2:
    source: rtsp://admin:password@192.168.1.102:554/stream1
    sourceOnDemand: no
    record: no

# Configuración global WebRTC
webrtc:
  address: :8889
  iceServers:
    - urls: ["stun:stun.l.google.com:19302"]  # STUN público
  # En producción: agregar TURN server si hay NAT estricto
```

---

## Consideraciones de Ancho de Banda

### Estimación por Stream

| Resolución | Codec | FPS | Bitrate Estimado |
|-----------|-------|-----|-----------------|
| 1080p | H.264 | 25 | ~2-4 Mbps |
| 720p | H.264 | 25 | ~1-2 Mbps |
| 1080p | H.265 | 25 | ~1-2 Mbps |
| 480p | H.264 | 15 | ~0.5-1 Mbps |

### Impacto en Ancho de Banda de Subida (Ubicación Remota)

| # Cámaras | Resolución | Consumo Total de Subida |
|----------|-----------|------------------------|
| 5 | 1080p H.264 | ~10-20 Mbps |
| 10 | 1080p H.264 | ~20-40 Mbps |
| 10 | 720p H.264 | ~10-20 Mbps |
| 10 | 1080p H.265 | ~10-20 Mbps |

> **Nota crítica:** MediaMTX con múltiples viewers del mismo stream NO multiplica el ancho de banda de la cámara. Relee el stream RTSP una sola vez y lo distribuye a N viewers WebRTC. Esto es una ventaja clave en entornos con ancho de banda limitado.

### Estrategia de Múltiples Viewers del Mismo Stream

```
Cámara → [RTSP] → MediaMTX → [WebRTC] → Viewer 1 (Operador)
                           → [WebRTC] → Viewer 2 (Supervisor)
                           → [WebRTC] → Viewer 3 (Admin)

Ancho de banda cámara → MediaMTX: 1 × bitrate de la cámara
Ancho de banda MediaMTX → Internet: N × bitrate (uno por viewer)
```

**Implicación:** Si hay 3 usuarios viendo la misma cámara de 2 Mbps, MediaMTX necesita 6 Mbps de subida para esa cámara.

---

## ICE / STUN / TURN para Conectividad WebRTC

### Escenario de Conectividad

El browser del usuario puede estar detrás de NAT (en una red doméstica o corporativa). MediaMTX también puede estar detrás de NAT.

| Situación | Solución |
|-----------|---------|
| NAT simple (doméstico) | STUN es suficiente |
| NAT simétrico corporativo estricto | TURN server necesario |
| Ambos en internet público | Conexión directa |

### Configuración Recomendada

```
Para MVP: usar STUN público (Google STUN) + documentar que si hay
  problemas de conectividad se necesita un TURN server.
Para v1: configurar un servidor TURN propio (coturn) en el VPS
  o usar un servicio TURN (Twilio, Metered.ca).
```
