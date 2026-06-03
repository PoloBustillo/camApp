# 1.6 — Supuestos

**Proyecto:** CamWatch Platform  
**Versión:** 1.0  
**Fecha:** Junio 2026

---

> Los supuestos son condiciones que se asumen como verdaderas sin verificación formal. Si un supuesto resulta falso, puede requerir cambios en el diseño, alcance o arquitectura del sistema.

---

## Supuestos de Infraestructura

| ID | Supuesto | Riesgo si es falso |
|----|---------|---------------------|
| SUP-INF-001 | La computadora Ubuntu en la ubicación remota tiene conexión a internet estable con al menos 10 Mbps de subida | El video será de mala calidad o la latencia será inaceptable |
| SUP-INF-002 | El VPS tiene al menos 2 vCPUs y 4 GB de RAM disponibles para el backend y frontend | El sistema será lento bajo carga media |
| SUP-INF-003 | El VPS tiene al menos 20 GB de almacenamiento para la base de datos y logs | El sistema se quedará sin espacio con el tiempo |
| SUP-INF-004 | Tailscale puede instalarse sin restricciones en ambos nodos (Ubuntu remoto y VPS) | La conectividad segura requeriría rediseño con VPN alternativa |
| SUP-INF-005 | La computadora Ubuntu remota tiene recursos suficientes para manejar 10 streams RTSP en passthrough (sin transcodificación) | Se requeriría hardware adicional o reducir el número de cámaras |

---

## Supuestos de Cámaras

| ID | Supuesto | Riesgo si es falso |
|----|---------|---------------------|
| SUP-CAM-001 | Las cámaras IP instaladas son compatibles con RTSP estándar | No se pueden integrar sin protocolo propietario del fabricante |
| SUP-CAM-002 | Las cámaras están en la misma red local que el servidor Ubuntu/MediaMTX | Requeriría enrutamiento de red adicional |
| SUP-CAM-003 | Las cámaras pueden ser configuradas para transmitir en H.264 | MediaMTX necesitaría transcodificar (alto consumo de CPU) |
| SUP-CAM-004 | La URL RTSP de cada cámara es conocida o puede obtenerse del manual/fabricante | Se requeriría descubrimiento manual o herramientas de escaneo de red |
| SUP-CAM-005 | Las cámaras tienen una resolución máxima de 1080p (Full HD) | Streams 4K consumirían excesivo ancho de banda |

---

## Supuestos de Usuarios y Negocio

| ID | Supuesto | Riesgo si es falso |
|----|---------|---------------------|
| SUP-USR-001 | Los usuarios finales usarán navegadores modernos con soporte WebRTC (Chrome, Firefox, Safari, Edge) | Se requeriría un player de video alternativo |
| SUP-USR-002 | El número máximo de usuarios concurrentes en MVP es 5 | El backend requeriría más recursos o arquitectura diferente |
| SUP-USR-003 | No se requiere grabación de video en el MVP | El almacenamiento y la arquitectura son significativamente más simples |
| SUP-USR-004 | No se requieren notificaciones en tiempo real (push/email) en el MVP | No se necesita un sistema de colas o websockets adicionales |
| SUP-USR-005 | Un solo administrador gestiona el sistema (no se requiere multi-tenancy) | Se requeriría isolación de datos entre organizaciones |
| SUP-USR-006 | Los usuarios aceptan iniciar sesión con email y contraseña (no se requiere SSO/SAML/OAuth en MVP) | Se requeriría integración con proveedor de identidad externo |

---

## Supuestos de MediaMTX

| ID | Supuesto | Riesgo si es falso |
|----|---------|---------------------|
| SUP-MTX-001 | MediaMTX puede manejar 10 streams RTSP → WebRTC simultáneos con los recursos disponibles | Se requeriría un servidor más potente o reducir streams |
| SUP-MTX-002 | La API HTTP de MediaMTX es suficiente para gestionar streams programáticamente desde el backend | Se requeriría configuración manual de MediaMTX |
| SUP-MTX-003 | MediaMTX soporta el protocolo WHEP para streaming WebRTC hacia el browser | El mecanismo de señalización WebRTC requeriría implementación personalizada |
| SUP-MTX-004 | MediaMTX puede configurarse para requerir autenticación en sus endpoints de stream | Los streams de video podrían ser accesibles por cualquiera que conozca la URL |
| SUP-MTX-005 | La versión de MediaMTX disponible es estable y tiene soporte activo | Se requeriría evaluar alternativas como Pion, Janus o GStreamer |

---

## Supuestos de Seguridad

| ID | Supuesto | Riesgo si es falso |
|----|---------|---------------------|
| SUP-SEC-001 | El dominio del frontend tiene un certificado TLS válido | WebRTC no funcionará (requiere contexto seguro) |
| SUP-SEC-002 | Los nodos Tailscale están configurados correctamente y en la misma tailnet | No hay conectividad privada entre VPS y servidor remoto |
| SUP-SEC-003 | Las claves de firma JWT y cifrado de credenciales se almacenan como variables de entorno, no en el código | Credenciales comprometidas si se expone el repositorio |

---

## Supuestos de Desarrollo

| ID | Supuesto | Riesgo si es falso |
|----|---------|---------------------|
| SUP-DEV-001 | El equipo tiene experiencia con Node.js/TypeScript y React/Next.js | La curva de aprendizaje extendería el tiempo de desarrollo |
| SUP-DEV-002 | El equipo puede acceder a un entorno de prueba con al menos una cámara real | Las pruebas serían con streams simulados, sin validar el caso real |
| SUP-DEV-003 | Se dispone de un VPS para desarrollo/staging además del de producción | Los deploys de prueba se harán en el mismo ambiente que producción |

---

## Proceso de Validación de Supuestos

Los siguientes supuestos deben validarse **antes de iniciar el Sprint 1**:

| Prioridad | ID | Cómo validar |
|-----------|-----|-------------|
| 🔴 Crítica | SUP-INF-001 | Medir velocidad de upload del servidor remoto con speedtest-cli |
| 🔴 Crítica | SUP-INF-004 | Instalar Tailscale en ambos nodos y verificar ping entre ellos |
| 🔴 Crítica | SUP-CAM-001 | Probar conexión RTSP con VLC desde la misma red |
| 🔴 Crítica | SUP-MTX-001 | Configurar MediaMTX y medir CPU/RAM con streams activos |
| 🔴 Crítica | SUP-MTX-003 | Probar WHEP con MediaMTX y browser en entorno controlado |
| 🟡 Alta | SUP-CAM-003 | Revisar configuración de cada modelo de cámara disponible |
| 🟡 Alta | SUP-INF-002 | Verificar specs del VPS contratado |
| 🟢 Media | SUP-USR-001 | Confirmar browsers que usan los operadores |
