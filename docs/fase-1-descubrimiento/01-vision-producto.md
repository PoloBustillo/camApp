# 1.1 — Visión del Producto

**Proyecto:** CamWatch Platform  
**Versión del documento:** 1.0  
**Fecha:** Junio 2026  
**Autor:** Arquitecto de Software Senior / Product Owner

---

## 1. Declaración de Visión

> **Para** equipos de seguridad y administración de instalaciones **que necesitan** monitorear cámaras IP en tiempo real desde cualquier ubicación, **CamWatch Platform** es una plataforma web de monitoreo de videovigilancia **que** proporciona visualización en tiempo real con baja latencia, gestión centralizada y acceso remoto seguro. **A diferencia de** soluciones NVR propietarias y costosas, **nuestro producto** es una plataforma abierta, extensible y desplegable en infraestructura propia.

---

## 2. Contexto del Negocio

| Elemento | Descripción |
|----------|-------------|
| **Problema** | Monitorear cámaras IP en una ubicación remota sin acceso físico permanente, sin una solución de videovigilancia centralizada existente |
| **Solución propuesta** | Plataforma web accesible desde cualquier navegador, con streaming de video en tiempo real a través de WebRTC |
| **Usuarios objetivo** | Administradores de instalaciones, operadores de seguridad y supervisores |
| **Canal** | Aplicación web (browser-first, responsive) |
| **Modelo** | Autoalojado (self-hosted) en VPS propio |

---

## 3. Objetivos del Producto

### 3.1 Objetivos Primarios (MVP)
1. **Visualización en tiempo real** — Ver streams de cámaras IP con latencia < 2 segundos.
2. **Gestión de cámaras** — Agregar, editar y eliminar cámaras del sistema.
3. **Layouts personalizados** — Crear y cambiar entre disposiciones de cámara personalizadas (1, 4, 6, 9 cámaras).
4. **Agrupación por ubicación** — Organizar cámaras por zonas o grupos lógicos.
5. **Administración de usuarios** — Gestionar acceso con roles diferenciados.
6. **Acceso remoto seguro** — Acceder al sistema desde cualquier lugar con autenticación segura.

### 3.2 Objetivos Secundarios (Post-MVP)
7. **Grabación de video** — Registrar y reproducir grabaciones de cámaras.
8. **Notificaciones y alertas** — Detectar eventos y notificar a operadores.
9. **Analítica de video** — Integrar capacidades de análisis (detección de movimiento, etc.).
10. **Aplicación móvil** — Acceso desde dispositivos iOS/Android.

---

## 4. Propuesta de Valor

| Para quién | Propuesta |
|------------|-----------|
| **Administrador** | Control total del sistema: cámaras, usuarios y configuración desde una interfaz unificada |
| **Operador** | Panel de monitoreo claro y rápido con layouts configurables sin necesidad de conocimientos técnicos |
| **Supervisor** | Acceso de solo lectura a cámaras relevantes sin riesgo de modificar configuraciones |
| **Organización** | Solución self-hosted que mantiene el control de los datos y reduce dependencia de proveedores |

---

## 5. Criterios de Éxito del Producto

| Métrica | Objetivo MVP | Objetivo v1 |
|---------|-------------|-------------|
| Latencia de video (end-to-end) | < 2 segundos | < 1 segundo |
| Uptime del sistema | > 99% | > 99.5% |
| Cámaras soportadas simultáneamente | 10 | 25 |
| Tiempo de incorporación de nueva cámara | < 5 minutos | < 2 minutos |
| Tiempo de carga del dashboard | < 3 segundos | < 1.5 segundos |
| Usuarios concurrentes | 5 | 20 |

---

## 6. Alcance del MVP

### Incluido en MVP
- Streaming en tiempo real (WebRTC) de hasta 10 cámaras RTSP/ONVIF
- Dashboard con layouts configurables (1x1, 2x2, 3x3)
- Gestión de cámaras (CRUD)
- Agrupación de cámaras por ubicación
- Autenticación con JWT y roles (Admin, Operator, Viewer)
- Gestión de usuarios (CRUD por Admin)
- Integración con MediaMTX como servidor de medios
- Conectividad segura a través de Tailscale
- Reconexión automática a streams

### Excluido del MVP
- Grabación y reproducción de video
- Notificaciones y alertas automáticas
- Detección de movimiento / analítica
- Aplicación móvil nativa
- Exportación de video
- Acceso PTZ (Pan-Tilt-Zoom)
- Múltiples ubicaciones remotas
- Integración con sistemas de alarma externos

---

## 7. Restricciones de Alto Nivel

| Tipo | Restricción |
|------|-------------|
| **Técnica** | La computadora remota (Ubuntu) solo puede ejecutar MediaMTX y Tailscale; recursos de CPU/RAM limitados |
| **Técnica** | El ancho de banda en la ubicación remota es un recurso escaso y crítico |
| **Técnica** | Máximo 10 cámaras en el MVP |
| **Arquitectónica** | Frontend y backend deben estar separados del servidor de medios |
| **Seguridad** | Acceso al servidor MediaMTX solo a través de la red Tailscale |
| **Compatibilidad** | Las cámaras deben ser compatibles con RTSP y/o ONVIF |

---

## 8. Suposiciones del Negocio

- La organización ya tiene cámaras IP instaladas con conectividad de red en la ubicación remota.
- Se dispone de un VPS con recursos suficientes para hospedar el backend y frontend.
- La conectividad a Internet en la ubicación remota es suficiente para transmitir video comprimido (H.264/H.265).
- Los usuarios finales utilizan navegadores modernos con soporte WebRTC.
- Tailscale está o será configurado correctamente entre los nodos del sistema.

---

## 9. Alineación Estratégica

```
Ahora (MVP)          │ Después (v1-v2)        │ Futuro
─────────────────────┼───────────────────────┼─────────────────────
Monitoreo en tiempo  │ Grabación + revisión  │ IA/Analítica de video
real                 │ de video              │
                     │                       │
Gestión básica de    │ Notificaciones y      │ Multi-tenant
usuarios y cámaras   │ alertas automáticas   │
                     │                       │
Acceso seguro        │ Más protocolos de     │ Integración con
remoto               │ cámara                │ sistemas externos
```

---

## 10. Stakeholders

| Rol | Responsabilidad en el proyecto |
|-----|-------------------------------|
| Product Owner | Define prioridades del backlog, acepta entregables |
| Tech Lead | Toma decisiones arquitectónicas, revisa implementación |
| Equipo de Desarrollo | Implementa funcionalidades por sprint |
| Administrador de Sistemas | Configura y mantiene la infraestructura |
| Usuario Final (Operador) | Valida la usabilidad del dashboard de monitoreo |
