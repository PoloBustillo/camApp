# 1.7 — Preguntas Abiertas

**Proyecto:** CamWatch Platform  
**Versión:** 1.0  
**Fecha:** Junio 2026

---

> Las respuestas a estas preguntas tienen impacto directo en el diseño de la arquitectura o en las prioridades del backlog. Deben resolverse antes o durante el Sprint 0.

---

## Preguntas de Infraestructura y Red

### PA-001: ¿Cuál es el ancho de banda disponible en la ubicación remota?
- **Impacto:** Define cuántos streams simultáneos se pueden transmitir y a qué calidad/resolución.
- **Respuesta necesaria antes de:** Sprint 1
- **Decisión dependiente:** Configuración de bitrate máximo en MediaMTX, resolución máxima de streams.

### PA-002: ¿El servidor Ubuntu en la ubicación remota tiene IP estática o dinámica?
- **Impacto:** Si la IP es dinámica, Tailscale la maneja correctamente, pero hay implicaciones si el hostname de Tailscale cambia.
- **Respuesta necesaria antes de:** Sprint 0
- **Decisión dependiente:** Configuración del hostname de MediaMTX en el backend.

### PA-003: ¿Hay UPS (sistema de alimentación ininterrumpida) en el servidor remoto y las cámaras?
- **Impacto:** Define la frecuencia esperada de desconexiones por cortes de energía y la estrategia de reconexión automática.
- **Respuesta necesaria antes de:** Sprint 1

### PA-004: ¿El VPS del backend ya está contratado? ¿Con qué proveedor y qué especificaciones tiene?
- **Impacto:** Define si hay restricciones de instalación de software (Tailscale, Docker, etc.) y los límites de recursos.
- **Respuesta necesaria antes de:** Sprint 0

---

## Preguntas de Cámaras

### PA-005: ¿Cuántas cámaras ya están instaladas y de qué marca/modelo son?
- **Impacto:** Permite verificar compatibilidad RTSP real y planear pruebas de integración.
- **Respuesta necesaria antes de:** Sprint 0

### PA-006: ¿Las cámaras ya tienen asignadas URLs RTSP y credenciales de acceso?
- **Impacto:** Si no, el Sprint 0 debe incluir la configuración de las cámaras en la red.
- **Respuesta necesaria antes de:** Sprint 0

### PA-007: ¿Las cámaras están configuradas en H.264 o H.265?
- **Impacto:** H.265 puede requerir transcodificación en MediaMTX, con alto costo de CPU.
- **Respuesta necesaria antes de:** Sprint 1

### PA-008: ¿Qué resolución y framerate tienen las cámaras?
- **Impacto:** Define el consumo de CPU de MediaMTX y el ancho de banda necesario.
- **Respuesta necesaria antes de:** Sprint 1

---

## Preguntas de Usuarios y Acceso

### PA-009: ¿Cuántos usuarios operadores usarán el sistema simultáneamente en producción?
- **Impacto:** Define los requerimientos de concurrencia del backend y los recursos del VPS.
- **Respuesta necesaria antes de:** Sprint 2

### PA-010: ¿Los usuarios accederán solo desde la red corporativa o también desde Internet?
- **Impacto:** Si es solo red corporativa, los requerimientos de seguridad pueden simplificarse. Si es desde Internet, HTTPS y autenticación fuerte son obligatorios.
- **Respuesta necesaria antes de:** Sprint 1

### PA-011: ¿Se requiere autenticación multifactor (MFA) para acceder al sistema?
- **Impacto:** Requiere integración con TOTP (Google Authenticator) o similar.
- **Respuesta necesaria antes de:** Sprint 2 (si aplica)

### PA-012: ¿Se requiere un directorio de usuarios externo (Active Directory, LDAP, Google Workspace)?
- **Impacto:** Requiere implementar OAuth2/SAML en lugar de gestión de usuarios propia.
- **Respuesta necesaria antes de:** Sprint 0

### PA-013: ¿Los supervisores necesitan acceso desde dispositivos móviles (smartphone/tablet)?
- **Impacto:** El frontend debe ser completamente responsive y el WebRTC debe funcionar en Safari iOS.
- **Respuesta necesaria antes de:** Sprint 1

---

## Preguntas de Funcionalidad Futura

### PA-014: ¿Cuándo se planea agregar grabación de video? ¿Es un requisito para v1?
- **Impacto:** La grabación requiere almacenamiento significativo (100+ GB por cámara por día a 1080p) y decisiones de arquitectura ahora evitan rediseños posteriores.
- **Respuesta necesaria antes de:** Sprint 0 (para planear la arquitectura de almacenamiento)

### PA-015: ¿Se requiere retención de grabaciones? ¿Por cuántos días?
- **Impacto:** Define el costo de almacenamiento y la estrategia de rotación de video.
- **Respuesta necesaria antes de:** Sprint 0 (si grabación es v1)

### PA-016: ¿Se requieren alertas o notificaciones automáticas? ¿Por qué canal (email, SMS, push)?
- **Impacto:** Requiere integración con servicios externos (SendGrid, Twilio, etc.) y un sistema de eventos asíncronos.
- **Respuesta necesaria antes de:** Sprint 3 (si es v1)

### PA-017: ¿Se planea integrar cámaras PTZ (con control de movimiento Pan-Tilt-Zoom)?
- **Impacto:** Requiere protocolo adicional (ONVIF PTZ commands) y controles de UI.
- **Respuesta necesaria antes de:** Sprint 3 (si es v1)

### PA-018: ¿Habrá múltiples ubicaciones remotas (diferentes sitios con cámaras)?
- **Impacto:** Requiere arquitectura multi-instancia de MediaMTX y gestión de ubicaciones más sofisticada.
- **Respuesta necesaria antes de:** Sprint 0

---

## Preguntas de Seguridad y Compliance

### PA-019: ¿Existe algún requerimiento de compliance o normativa que el sistema deba cumplir? (GDPR, ISO 27001, etc.)
- **Impacto:** Puede requerir auditoría, cifrado adicional, políticas de retención de datos y acuerdos contractuales.
- **Respuesta necesaria antes de:** Sprint 0

### PA-020: ¿Se requiere un log de auditoría de quién accedió a qué cámara y cuándo?
- **Impacto:** Requiere un módulo de auditoría con almacenamiento de logs persistente.
- **Respuesta necesaria antes de:** Sprint 2

---

## Estado de Preguntas

| ID | Pregunta | Prioridad | Estado | Respuesta |
|----|----------|-----------|--------|-----------|
| PA-001 | Ancho de banda remoto | 🔴 Crítica | ❓ Pendiente | — |
| PA-002 | IP estática/dinámica servidor | 🔴 Crítica | ❓ Pendiente | — |
| PA-003 | UPS disponible | 🟡 Alta | ❓ Pendiente | — |
| PA-004 | Specs VPS backend | 🔴 Crítica | ❓ Pendiente | — |
| PA-005 | Marcas y modelos de cámaras | 🔴 Crítica | ❓ Pendiente | — |
| PA-006 | URLs RTSP y credenciales disponibles | 🔴 Crítica | ❓ Pendiente | — |
| PA-007 | Codec H.264 vs H.265 | 🔴 Crítica | ❓ Pendiente | — |
| PA-008 | Resolución y framerate | 🟡 Alta | ❓ Pendiente | — |
| PA-009 | Usuarios concurrentes | 🟡 Alta | ❓ Pendiente | — |
| PA-010 | Acceso desde Internet o solo LAN | 🔴 Crítica | ❓ Pendiente | — |
| PA-011 | Requerimiento de MFA | 🟡 Alta | ❓ Pendiente | — |
| PA-012 | Directorio de usuarios externo | 🔴 Crítica | ❓ Pendiente | — |
| PA-013 | Acceso desde móviles | 🟡 Alta | ❓ Pendiente | — |
| PA-014 | Grabación en v1 | 🔴 Crítica | ❓ Pendiente | — |
| PA-015 | Retención de grabaciones | 🟡 Alta | ❓ Pendiente | — |
| PA-016 | Alertas y notificaciones | 🟡 Alta | ❓ Pendiente | — |
| PA-017 | Cámaras PTZ | 🟢 Media | ❓ Pendiente | — |
| PA-018 | Múltiples ubicaciones remotas | 🔴 Crítica | ❓ Pendiente | — |
| PA-019 | Compliance/normativas | 🔴 Crítica | ❓ Pendiente | — |
| PA-020 | Log de auditoría | 🟡 Alta | ❓ Pendiente | — |
