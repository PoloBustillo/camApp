# 1.4 — Restricciones Técnicas

**Proyecto:** CamWatch Platform  
**Versión:** 1.0  
**Fecha:** Junio 2026

---

## 1. Restricciones de Infraestructura

### R-INF-001: Recursos Limitados en el Servidor Edge (Ubuntu Remoto)
- **Descripción:** La computadora Ubuntu en la ubicación remota ejecuta únicamente MediaMTX y Tailscale. No puede hospedar servicios adicionales.
- **Impacto:** El backend y frontend deben estar en un VPS separado. Toda la lógica de negocio vive fuera de la red remota.
- **Consecuencia de diseño:** La arquitectura debe ser explícitamente desacoplada. El backend solo interactúa con MediaMTX a través de la API de MediaMTX vía Tailscale.

### R-INF-002: Ancho de Banda en la Ubicación Remota
- **Descripción:** El ancho de banda de la red en la ubicación remota es un recurso escaso y no controlado por el equipo de desarrollo.
- **Impacto:** MediaMTX debe ser el único punto de salida de video. No se pueden tener múltiples consumers del stream RTSP original.
- **Consecuencia de diseño:** MediaMTX actúa como proxy/relay, evitando que cada cliente frontend abra una conexión directa a la cámara. Esto limita el consumo de ancho de banda de salida de la ubicación remota.

### R-INF-003: Máximo 10 Cámaras en MVP
- **Descripción:** El sistema debe diseñarse para soportar hasta 10 cámaras en la fase MVP.
- **Impacto:** Las decisiones de escalabilidad pueden posponerse, pero la arquitectura debe soportar crecimiento sin rediseño.
- **Consecuencia de diseño:** No se requieren mecanismos de clustering en MVP, pero el diseño no debe impedir su adición posterior.

### R-INF-004: VPS Independiente para Backend y Frontend
- **Descripción:** El VPS donde se despliegan backend y frontend es independiente de la red local de las cámaras.
- **Impacto:** El backend no tiene acceso directo a las cámaras IP. Solo puede comunicarse con MediaMTX a través de Tailscale.
- **Consecuencia de diseño:** Todas las operaciones con streams (iniciar, detener, verificar) deben pasar por la API de MediaMTX.

---

## 2. Restricciones de Protocolo y Compatibilidad

### R-PROT-001: RTSP como Protocolo de Cámara
- **Descripción:** Las cámaras deben ser compatibles con RTSP. ONVIF se usará como capa de descubrimiento y configuración adicional.
- **Impacto:** La compatibilidad está limitada a cámaras con soporte RTSP estándar.
- **Consecuencia de diseño:** La URL RTSP es el identificador primario de cada cámara. Se almacenará de forma segura (cifrado en reposo).

### R-PROT-002: WebRTC para Streaming al Browser
- **Descripción:** El protocolo de streaming hacia el browser debe ser WebRTC para lograr latencia < 2 segundos. RTMP y HLS no son aceptables por su latencia > 5 segundos.
- **Impacto:** MediaMTX debe tener soporte WebRTC habilitado y expuesto correctamente.
- **Consecuencia de diseño:** Se requiere una negociación WHEP (WebRTC-HTTP Egress Protocol) o una señalización personalizada compatible con MediaMTX.

### R-PROT-003: Soporte de Navegadores Modernos
- **Descripción:** El frontend debe soportar Chrome 90+, Firefox 88+, Safari 14+, Edge 90+.
- **Impacto:** Se puede usar WebRTC nativo del browser sin polyfills complejos.
- **Consecuencia de diseño:** No se requiere soporte para Internet Explorer ni navegadores legacy.

### R-PROT-004: HTTPS Obligatorio
- **Descripción:** WebRTC requiere un contexto seguro (HTTPS) en el browser. Además, es un requisito de seguridad del sistema.
- **Impacto:** El frontend y backend deben servirse exclusivamente sobre HTTPS/WSS.
- **Consecuencia de diseño:** Se requiere certificado TLS válido. Se usará Let's Encrypt automáticamente.

---

## 3. Restricciones de Seguridad

### R-SEC-001: Acceso a MediaMTX Solo por Red Tailscale
- **Descripción:** MediaMTX no debe tener puertos expuestos al internet público. Solo accesible dentro de la red Tailscale.
- **Impacto:** El backend (en VPS) debe ser un nodo Tailscale para poder comunicarse con MediaMTX.
- **Consecuencia de diseño:** El VPS del backend debe tener Tailscale instalado y configurado como nodo de la misma red privada.

### R-SEC-002: Sin Credenciales de Cámara en el Frontend
- **Descripción:** Las credenciales RTSP de las cámaras (usuario, contraseña) nunca deben llegar al frontend ni al browser del usuario.
- **Impacto:** Toda la lógica de conexión con credenciales vive exclusivamente en el backend.
- **Consecuencia de diseño:** El backend intermediará la obtención de URLs WebRTC seguras sin exponer credenciales originales de la cámara.

### R-SEC-003: RBAC Obligatorio
- **Descripción:** Todo acceso a recursos debe estar protegido por control de acceso basado en roles.
- **Impacto:** No existe un "acceso abierto" ni endpoints no protegidos (excepto login y health check).
- **Consecuencia de diseño:** Todo endpoint de la API requiere autenticación JWT + verificación de rol.

---

## 4. Restricciones de Compatibilidad de Cámaras

### R-CAM-001: Variedad de Fabricantes
- **Descripción:** Las cámaras pueden ser de distintas marcas (Hikvision, Dahua, Axis, Reolink, Amcrest, etc.).
- **Impacto:** No se puede depender de APIs propietarias. Solo se puede usar RTSP y ONVIF estándar.
- **Consecuencia de diseño:** La URL RTSP debe ser configurable manualmente. El descubrimiento ONVIF es opcional y complementario.

### R-CAM-002: Formatos de Video
- **Descripción:** Las cámaras pueden transmitir en H.264 o H.265. MediaMTX debe manejar ambos.
- **Impacto:** El frontend (WebRTC) debe ser capaz de decodificar ambos codecs si el browser los soporta.
- **Consecuencia de diseño:** En browsers que no soporten H.265, MediaMTX podría necesitar transcodificar a H.264 (operación costosa en CPU — a evaluar según recursos del servidor).

---

## 5. Restricciones de Tiempo y Recursos

### R-REC-001: Equipo de Desarrollo Pequeño
- **Descripción:** El equipo de implementación es reducido (1-3 desarrolladores).
- **Impacto:** No se pueden seleccionar tecnologías con curva de aprendizaje muy alta.
- **Consecuencia de diseño:** Se priorizan tecnologías con buena documentación, comunidad activa y que el equipo ya conoce.

### R-REC-002: MVP en Tiempo Reducido
- **Descripción:** El MVP debe ser funcional en 5 sprints de 2 semanas (10 semanas).
- **Impacto:** No se pueden incluir features de alta complejidad en el MVP.
- **Consecuencia de diseño:** Grabación, notificaciones y analítica quedan fuera del MVP.

---

## Resumen de Restricciones

| ID | Tipo | Restricción | Severidad |
|----|------|------------|-----------|
| R-INF-001 | Infraestructura | Solo MediaMTX y Tailscale en servidor remoto | Crítica |
| R-INF-002 | Infraestructura | Ancho de banda limitado en ubicación remota | Alta |
| R-INF-003 | Infraestructura | Máximo 10 cámaras en MVP | Media |
| R-INF-004 | Infraestructura | VPS independiente para backend/frontend | Crítica |
| R-PROT-001 | Protocolo | Cámaras deben ser RTSP compatible | Crítica |
| R-PROT-002 | Protocolo | WebRTC obligatorio para streaming al browser | Crítica |
| R-PROT-003 | Protocolo | Soporte solo en browsers modernos | Media |
| R-PROT-004 | Protocolo | HTTPS obligatorio | Crítica |
| R-SEC-001 | Seguridad | MediaMTX solo por Tailscale | Crítica |
| R-SEC-002 | Seguridad | Sin credenciales de cámara en frontend | Crítica |
| R-SEC-003 | Seguridad | RBAC obligatorio en todos los endpoints | Alta |
| R-CAM-001 | Compatibilidad | Multi-marca vía RTSP/ONVIF estándar | Alta |
| R-CAM-002 | Compatibilidad | Soporte H.264 y H.265 | Media |
| R-REC-001 | Recursos | Equipo de desarrollo pequeño | Media |
| R-REC-002 | Recursos | MVP en 10 semanas | Alta |
