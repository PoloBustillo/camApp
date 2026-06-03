# 2.9 — Estrategia de Seguridad

**Proyecto:** CamWatch Platform  
**Versión:** 1.0  
**Fecha:** Junio 2026

---

## Modelo de Amenazas (Threat Model)

### Activos a Proteger

| Activo | Nivel de Criticidad |
|--------|---------------------|
| Streams de video en vivo | 🔴 Crítico |
| Credenciales de cámaras (RTSP user/pass) | 🔴 Crítico |
| Datos de usuarios (contraseñas) | 🔴 Crítico |
| Tokens JWT y refresh tokens | 🔴 Crítico |
| Configuración del sistema | 🟡 Alto |
| Metadatos de cámaras (IPs, nombres) | 🟡 Alto |
| Logs y auditoría | 🟢 Medio |

### Amenazas Principales (STRIDE)

| Amenaza | Descripción | Mitigación |
|---------|-------------|-----------|
| **Spoofing** | Suplantación de identidad de usuario | JWT firmado + bcrypt passwords |
| **Tampering** | Modificación de configuración no autorizada | RBAC + validación de entrada |
| **Repudiation** | Negar haber realizado una acción | Audit log con timestamps y userId |
| **Information Disclosure** | Exposición de credenciales de cámara | Cifrado AES-256 en DB, nunca en frontend |
| **Denial of Service** | Saturar el sistema con requests | Rate limiting + Circuit breaker |
| **Elevation of Privilege** | Viewer actuando como Admin | RBAC estricto en cada endpoint |

---

## Controles de Seguridad por Capa

### Capa 1: Red y Perimetro

```
Internet → Nginx (TLS 1.3, HSTS) → App
         → Tailscale (WireGuard) → MediaMTX
         
Cámaras → LAN local → MediaMTX (no expuesto a internet)
```

| Control | Implementación |
|---------|---------------|
| TLS 1.3 obligatorio | Nginx: `ssl_protocols TLSv1.3 TLSv1.2` |
| HSTS | `Strict-Transport-Security: max-age=31536000; includeSubDomains` |
| Redirección HTTP→HTTPS | Nginx: redirect 301 |
| CSP | Content-Security-Policy en respuestas del frontend |
| Tailscale ACLs | Solo el VPS puede acceder a puertos de MediaMTX |
| Firewall UFW | Solo puertos 80, 443, 41641 abiertos en VPS |

### Capa 2: Autenticación y Autorización

| Control | Implementación |
|---------|---------------|
| Contraseñas hasheadas | bcrypt con work factor 12 |
| JWT de corta duración | Access Token: 15 minutos |
| Refresh Tokens revocables | Almacenados en Redis con JTI único |
| HttpOnly Cookies | Refresh token inaccesible desde JS |
| Rate limiting en login | 5 intentos/15 min por IP (Redis) |
| RBAC en todos los endpoints | Middleware verifica rol en cada request |
| Bloqueo de cuenta | Después de 5 intentos fallidos |

### Capa 3: Validación de Entrada

| Control | Implementación |
|---------|---------------|
| Validación de esquema | Zod/Joi en el backend para todo el body/query |
| Sanitización de texto | No HTML crudo en respuestas |
| Límite de tamaño de body | Fastify: `bodyLimit: 1048576` (1MB) |
| Parámetros preparados | Knex/pg con bindings, nunca concatenación de SQL |
| Validación de URLs RTSP | Regex + no redirecciones de protocolo |

### Capa 4: Datos en Reposo

| Control | Implementación |
|---------|---------------|
| Cifrado de contraseñas | bcrypt, hash unidireccional |
| Cifrado de credenciales RTSP | AES-256-GCM con clave en variable de entorno |
| PostgreSQL TLS | Conexión cifrada entre backend y DB |
| Backups cifrados | Backup con gpg antes de transferir |
| Secretos como variables de entorno | Nunca en código ni en imagen Docker |

### Capa 5: Secretos y Configuración

| Secreto | Almacenamiento | Rotación |
|---------|----------------|---------|
| JWT_SECRET | Variable de entorno (VPS) | Trimestral |
| REFRESH_JWT_SECRET | Variable de entorno (VPS) | Trimestral |
| MEDIAMTX_JWT_SECRET | Variable de entorno (VPS + servidor remoto) | Trimestral |
| DB_PASSWORD | Variable de entorno (VPS) | Anual |
| CAMERA_ENCRYPTION_KEY | Variable de entorno (VPS) | Anual |
| Tailscale Auth Key | Tailscale Admin Console | Por dispositivo |

---

## Seguridad del Streaming de Video

### Prevención de Acceso No Autorizado a Streams

```
Flujo seguro:
1. Usuario autenticado → Backend → Stream Token (JWT, 30s, firmado)
2. Stream Token → MediaMTX → Valida firma JWT
3. Si válido → Autoriza conexión WebRTC
4. Token expira → Conexión WebRTC ya establecida continúa
   (el token solo protege el establecimiento, no el stream activo)

Protección adicional:
• MediaMTX no expone lista de paths activos públicamente
• El path name no es predecible (usa UUID corto, no nombre de cámara)
• Un token robado dura máximo 30 segundos
```

### Prevención de Acceso Directo a Cámaras

```
Las cámaras IP solo son accesibles desde la red local (192.168.1.0/24).
No hay acceso directo desde internet a las cámaras.
El único punto de ingreso a la red de cámaras es MediaMTX.
MediaMTX solo es accesible a través de Tailscale para gestión.
```

---

## Headers de Seguridad HTTP

```nginx
# Nginx - Headers de seguridad para el frontend y API
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Content-Security-Policy "
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  connect-src 'self' wss: https://camwatch.ejemplo.com:8889;
  media-src 'self' blob:;
  frame-ancestors 'none'
" always;
```

---

## Plan de Respuesta a Incidentes

| Incidente | Detección | Respuesta Inmediata | Tiempo Objetivo |
|-----------|-----------|---------------------|-----------------|
| Credenciales de usuario comprometidas | Login desde IP inusual / alerta | Revocar todos los refresh tokens del usuario | < 5 min |
| Fuga de credenciales de cámara | Detección de acceso no autorizado a cámara | Cambiar credenciales de cámara + rotar CAMERA_ENCRYPTION_KEY | < 30 min |
| Acceso no autorizado a la API | Logs de 401/403 anómalos | Revisar IP, bloquear si necesario, revocar tokens | < 15 min |
| Servidor comprometido | Detección por IDS / comportamiento anómalo | Aislar VPS, snapshot forense, restaurar desde backup | < 2 horas |

---

## Checklist de Seguridad Pre-Despliegue

- [ ] Todas las variables de entorno con secretos están configuradas (no valores por defecto)
- [ ] TLS configurado y certificado válido
- [ ] HSTS habilitado
- [ ] Firewall configurado (UFW)
- [ ] Tailscale ACLs configuradas
- [ ] Rate limiting activo en endpoints de auth
- [ ] Backups automáticos configurados y probados
- [ ] Credenciales de cámara cifradas en la DB
- [ ] bcrypt work factor ≥ 12
- [ ] Headers de seguridad HTTP activos
- [ ] MediaMTX API no accesible desde internet
- [ ] Logs de auditoría activados
- [ ] Plan de rotación de secretos documentado
