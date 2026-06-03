# 4.1 — Product Backlog Completo

**Proyecto:** CamWatch Platform  
**Versión:** 1.0  
**Fecha:** Junio 2026

> **Formato:** Epic → Feature → User Story → Acceptance Criteria → Priority → Estimate

---

## CLASIFICACIÓN

| Tier | Descripción | Sprints |
|------|-------------|---------|
| **MVP** | Funcionalidad mínima viable para uso real | Sprint 1-4 |
| **v1** | Primera versión completa con features adicionales | Sprint 5-8 |
| **v2** | Capacidades avanzadas de grabación y analítica | Sprint 9-12 |
| **Futuro** | Ideas de largo plazo sin fecha definida | TBD |

**Escala de estimación (Story Points):** Fibonacci — 1, 2, 3, 5, 8, 13, 21

---

# ════════════════════════════════════════
# ÉPICA E-01: AUTENTICACIÓN Y SEGURIDAD
# Tier: MVP
# ════════════════════════════════════════

## Feature F-01-01: Login y Gestión de Sesión

---

### US-001: Login con email y contraseña
**Como** usuario del sistema,  
**quiero** ingresar con mi email y contraseña,  
**para** acceder a la plataforma de forma segura.

**Criterios de Aceptación:**
- [ ] El formulario valida el formato del email antes de enviar.
- [ ] Muestra error genérico "Credenciales inválidas" (sin indicar cuál campo es incorrecto).
- [ ] Después de 5 intentos fallidos, bloquea la cuenta por 15 minutos con mensaje claro.
- [ ] Login exitoso redirige al dashboard según el rol del usuario.
- [ ] El access token se almacena en memoria (no localStorage/sessionStorage).
- [ ] El refresh token llega como cookie HttpOnly.

**Priority:** P0 (bloqueante)  
**Estimate:** 5 SP

---

### US-002: Renovación automática de token
**Como** usuario autenticado,  
**quiero** que mi sesión se mantenga activa sin re-autenticarme cada 15 minutos,  
**para** tener una experiencia fluida durante mi turno de trabajo.

**Criterios de Aceptación:**
- [ ] Cuando el access token expira (401), el cliente intenta automáticamente renovarlo con el refresh token.
- [ ] Si el refresh es exitoso, el request original se reintenta de forma transparente al usuario.
- [ ] Si el refresh falla (token revocado/expirado), redirige al login con mensaje "Tu sesión ha expirado".
- [ ] No se muestra ningún error visible al usuario cuando el refresh es automático.

**Priority:** P0  
**Estimate:** 3 SP

---

### US-003: Cerrar sesión
**Como** usuario autenticado,  
**quiero** poder cerrar mi sesión explícitamente,  
**para** proteger mi cuenta cuando termino mi turno o dejo un dispositivo compartido.

**Criterios de Aceptación:**
- [ ] El botón "Cerrar sesión" está accesible desde cualquier página.
- [ ] Al cerrar sesión se revoca el refresh token en el servidor.
- [ ] Se elimina el access token de la memoria del cliente.
- [ ] Redirige a la página de login.
- [ ] Intento de acceder a rutas protegidas después del logout redirige al login.

**Priority:** P0  
**Estimate:** 2 SP

---

### US-004: Protección de rutas por rol
**Como** sistema,  
**quiero** que cada ruta y acción esté protegida según el rol del usuario,  
**para** garantizar que nadie acceda a funciones que no le corresponden.

**Criterios de Aceptación:**
- [ ] Las rutas de administración (/cameras, /users, /locations) solo son accesibles para Admin.
- [ ] Un Viewer que intenta acceder a rutas de Operator/Admin ve "No tienes permiso" o es redirigido.
- [ ] Los endpoints del API devuelven 403 si el rol no es suficiente.
- [ ] Los elementos de navegación no aparecen para roles sin acceso.

**Priority:** P0  
**Estimate:** 3 SP

---

# ════════════════════════════════════════
# ÉPICA E-02: GESTIÓN DE INFRAESTRUCTURA
# Tier: MVP
# ════════════════════════════════════════

## Feature F-02-01: Configuración de Servidores Edge

---

### US-005: Registrar servidor edge (MediaMTX)
**Como** administrador,  
**quiero** registrar el servidor MediaMTX en la plataforma,  
**para** que el sistema pueda comunicarse con él para gestionar streams.

**Criterios de Aceptación:**
- [ ] El Admin puede crear un servidor edge con: nombre, IP Tailscale, puerto API, puerto WebRTC, hostname público.
- [ ] El sistema verifica la conectividad con la API de MediaMTX al crear/actualizar.
- [ ] El estado del servidor (online/offline) se muestra en la interfaz.
- [ ] Si la conectividad falla, muestra el error específico (timeout, auth, etc.).

**Priority:** P0  
**Estimate:** 5 SP

---

## Feature F-02-02: Gestión de Ubicaciones

---

### US-006: Crear y gestionar ubicaciones
**Como** administrador,  
**quiero** crear grupos de ubicaciones para organizar las cámaras,  
**para** que los operadores puedan filtrar y encontrar cámaras fácilmente.

**Criterios de Aceptación:**
- [ ] El Admin puede crear, editar y eliminar ubicaciones.
- [ ] Cada ubicación tiene nombre y descripción opcional.
- [ ] Las ubicaciones están asociadas a un servidor edge.
- [ ] No se puede eliminar una ubicación que tiene cámaras asignadas (muestra error claro).
- [ ] La lista de ubicaciones muestra el número de cámaras por ubicación.

**Priority:** P1  
**Estimate:** 5 SP

---

# ════════════════════════════════════════
# ÉPICA E-03: GESTIÓN DE CÁMARAS
# Tier: MVP
# ════════════════════════════════════════

## Feature F-03-01: CRUD de Cámaras

---

### US-007: Agregar una nueva cámara
**Como** administrador,  
**quiero** agregar una cámara al sistema,  
**para** que los operadores puedan visualizarla en el dashboard.

**Criterios de Aceptación:**
- [ ] El formulario solicita: nombre, slug, URL RTSP, codec (H264/H265), resolución (opcional), ubicación (opcional), servidor edge.
- [ ] El slug solo acepta caracteres `[a-z0-9_-]` y es único.
- [ ] La URL RTSP se valida con regex (comienza con `rtsp://` o `rtsps://`).
- [ ] Las credenciales RTSP se almacenan cifradas en la DB.
- [ ] El backend registra el path en MediaMTX automáticamente.
- [ ] El estado inicial es "unknown"; se actualiza al siguiente health check.
- [ ] Confirmación visual de éxito con el estado detectado.
- [ ] Si MediaMTX no puede conectar, la cámara se crea con estado "error" con mensaje explicativo.

**Priority:** P0  
**Estimate:** 8 SP

---

### US-008: Ver lista de cámaras
**Como** administrador u operador,  
**quiero** ver la lista de cámaras registradas con su estado actual,  
**para** tener visibilidad del sistema y detectar problemas.

**Criterios de Aceptación:**
- [ ] La lista muestra: nombre, estado (con indicador de color), ubicación, codec, última actualización de estado.
- [ ] Se puede filtrar por estado (online/offline/all) y por ubicación.
- [ ] Se puede buscar por nombre.
- [ ] El estado se actualiza al recargar la página o con un botón de "Actualizar".

**Priority:** P0  
**Estimate:** 3 SP

---

### US-009: Editar configuración de una cámara
**Como** administrador,  
**quiero** editar la configuración de una cámara existente,  
**para** corregir la URL RTSP, actualizar credenciales o cambiar su nombre/ubicación.

**Criterios de Aceptación:**
- [ ] El Admin puede editar todos los campos excepto el slug (identificador estable).
- [ ] Si cambia la URL RTSP, el backend actualiza MediaMTX y reinicia el stream.
- [ ] Confirmación antes de guardar si el stream está activo.
- [ ] El slug puede cambiarse solo si no hay sesiones WebRTC activas en ese path.

**Priority:** P1  
**Estimate:** 5 SP

---

### US-010: Eliminar una cámara
**Como** administrador,  
**quiero** eliminar una cámara del sistema,  
**para** limpiar cámaras que ya no están disponibles.

**Criterios de Aceptación:**
- [ ] Confirmación modal antes de eliminar indicando cuántos layouts la usan.
- [ ] El backend elimina el path de MediaMTX.
- [ ] Las celdas de layouts que la referenciaban quedan vacías (no eliminan el layout).
- [ ] La eliminación es soft delete (auditaría preservada).

**Priority:** P1  
**Estimate:** 3 SP

---

# ════════════════════════════════════════
# ÉPICA E-04: VISUALIZACIÓN EN TIEMPO REAL
# Tier: MVP
# ════════════════════════════════════════

## Feature F-04-01: Dashboard de Monitoreo

---

### US-011: Ver streams de cámaras en el dashboard
**Como** operador o viewer,  
**quiero** ver los streams de video de las cámaras en tiempo real en el dashboard,  
**para** monitorear las instalaciones.

**Criterios de Aceptación:**
- [ ] El dashboard carga el layout por defecto del usuario al ingresar.
- [ ] Cada celda del layout muestra el stream de video de la cámara asignada.
- [ ] La latencia del video es menor a 2 segundos desde la fuente.
- [ ] Si la cámara está offline, la celda muestra un indicador "Sin señal" con el nombre de la cámara.
- [ ] Si el stream WebRTC no puede conectarse después de 3 reintentos, muestra un botón "Reintentar".
- [ ] El nombre de la cámara se muestra como overlay en cada celda.

**Priority:** P0  
**Estimate:** 13 SP

---

### US-012: Ver cámara en pantalla completa
**Como** operador,  
**quiero** expandir una cámara a pantalla completa,  
**para** ver con mayor detalle una zona de interés.

**Criterios de Aceptación:**
- [ ] Doble clic o botón de expansión en una celda activa el modo pantalla completa.
- [ ] El modo pantalla completa mantiene el stream activo sin interrupción.
- [ ] Presionar Escape o un botón de cerrar regresa al layout normal.
- [ ] En pantalla completa se muestra el nombre de la cámara y la hora actual.

**Priority:** P1  
**Estimate:** 3 SP

---

### US-013: Reconexión automática de streams
**Como** operador,  
**quiero** que el sistema reconecte automáticamente los streams interrumpidos,  
**para** no tener que recargar la página manualmente.

**Criterios de Aceptación:**
- [ ] Cuando un stream WebRTC se interrumpe, el cliente intenta reconectar automáticamente.
- [ ] Reintentos con backoff: 5s, 10s, 30s, 60s (máximo 5 intentos).
- [ ] Durante el reintento, la celda muestra un spinner con el texto "Reconectando...".
- [ ] Después de 5 intentos fallidos, muestra "Sin señal" con botón manual de "Reintentar".
- [ ] Si la cámara vuelve a estar disponible, reconecta automáticamente (polling cada 30s después del último fallo).

**Priority:** P0  
**Estimate:** 5 SP

---

## Feature F-04-02: Gestión de Layouts

---

### US-014: Crear un layout personalizado
**Como** operador,  
**quiero** crear un layout personalizado con las cámaras que me interesan,  
**para** tener una vista optimizada para mi área de responsabilidad.

**Criterios de Aceptación:**
- [ ] El usuario puede seleccionar el tipo de grilla: 1x1, 2x2, 2x3, 3x3.
- [ ] El usuario puede asignar cámaras a cada celda arrastrando desde un panel lateral.
- [ ] El usuario da nombre al layout.
- [ ] Puede marcar el layout como "por defecto".
- [ ] Puede guardar el layout.
- [ ] El layout está disponible inmediatamente en el selector del dashboard.

**Priority:** P0  
**Estimate:** 8 SP

---

### US-015: Cambiar entre layouts guardados
**Como** operador,  
**quiero** cambiar rápidamente entre layouts guardados,  
**para** adaptar mi vista según la situación (rutina, emergencia, etc.).

**Criterios de Aceptación:**
- [ ] El dashboard muestra un selector de layouts accesible con un clic.
- [ ] Al seleccionar un layout, los streams se reconectan según el nuevo layout.
- [ ] La transición entre layouts es < 3 segundos.
- [ ] Los layouts compartidos del equipo también aparecen en el selector.

**Priority:** P0  
**Estimate:** 3 SP

---

### US-016: Editar y eliminar layouts
**Como** operador,  
**quiero** editar y eliminar mis layouts,  
**para** mantener organizada mi colección de vistas.

**Criterios de Aceptación:**
- [ ] El operador puede editar solo sus propios layouts.
- [ ] El Admin puede editar cualquier layout.
- [ ] Al eliminar el layout por defecto, el sistema selecciona otro layout como por defecto (o ninguno).
- [ ] Confirmación antes de eliminar.

**Priority:** P1  
**Estimate:** 3 SP

---

### US-017: Compartir un layout con el equipo
**Como** administrador u operador,  
**quiero** compartir un layout con todos los usuarios,  
**para** que el equipo use una vista estándar sin tener que crearlo cada uno.

**Criterios de Aceptación:**
- [ ] El propietario puede marcar un layout como "compartido".
- [ ] Los layouts compartidos son visibles para todos los usuarios pero solo el propietario (o Admin) puede editarlos.
- [ ] Un Viewer solo puede ver layouts compartidos, no crear propios.

**Priority:** P1  
**Estimate:** 2 SP

---

# ════════════════════════════════════════
# ÉPICA E-05: GESTIÓN DE USUARIOS
# Tier: MVP
# ════════════════════════════════════════

## Feature F-05-01: CRUD de Usuarios

---

### US-018: Crear usuario
**Como** administrador,  
**quiero** crear cuentas de usuario para los miembros del equipo,  
**para** dar acceso al sistema con el nivel de privilegio adecuado.

**Criterios de Aceptación:**
- [ ] El Admin puede crear usuarios con: nombre, email, contraseña temporal, rol.
- [ ] El email debe ser único en el sistema.
- [ ] La contraseña cumple la política de complejidad (8+ chars, mayúsc, minúsc, número).
- [ ] El usuario creado puede iniciar sesión inmediatamente.
- [ ] El Admin ve la lista actualizada con el nuevo usuario.

**Priority:** P0  
**Estimate:** 5 SP

---

### US-019: Gestionar usuarios existentes
**Como** administrador,  
**quiero** editar, activar/desactivar y eliminar usuarios,  
**para** mantener el control del acceso al sistema.

**Criterios de Aceptación:**
- [ ] El Admin puede cambiar el nombre, rol y estado (activo/inactivo) de cualquier usuario.
- [ ] Al desactivar un usuario, sus sesiones activas se revocan inmediatamente.
- [ ] No se puede eliminar el último Admin del sistema.
- [ ] La eliminación es soft delete con confirmación modal.
- [ ] Al eliminar un usuario, sus layouts privados se eliminan también.

**Priority:** P0  
**Estimate:** 5 SP

---

### US-020: Cambiar contraseña propia
**Como** usuario autenticado,  
**quiero** cambiar mi contraseña desde mi perfil,  
**para** mantener la seguridad de mi cuenta.

**Criterios de Aceptación:**
- [ ] El usuario debe ingresar su contraseña actual para confirmar.
- [ ] La nueva contraseña debe cumplir la política de complejidad.
- [ ] Al cambiar la contraseña, se revocan todos los refresh tokens activos (excepto el actual).
- [ ] Confirmación visual de éxito.

**Priority:** P1  
**Estimate:** 3 SP

---

# ════════════════════════════════════════
# ÉPICA E-06: MONITOREO DEL SISTEMA
# Tier: MVP
# ════════════════════════════════════════

---

### US-021: Ver estado general del sistema
**Como** administrador,  
**quiero** ver el estado del sistema en un panel resumen,  
**para** detectar problemas rápidamente.

**Criterios de Aceptación:**
- [ ] El panel muestra: cámaras online/offline/total, usuarios activos, estado de MediaMTX.
- [ ] Los indicadores de estado tienen colores: verde=ok, amarillo=advertencia, rojo=error.
- [ ] El estado se actualiza automáticamente cada 60 segundos o con botón manual.

**Priority:** P1  
**Estimate:** 3 SP

---

# ════════════════════════════════════════
# ÉPICA E-07: GRABACIÓN DE VIDEO
# Tier: v1
# ════════════════════════════════════════

---

### US-022: Activar grabación continua para una cámara
**Como** administrador,  
**quiero** activar la grabación continua de una cámara,  
**para** tener evidencia de incidentes.

**Criterios de Aceptación:**
- [ ] El Admin puede activar/desactivar la grabación por cámara.
- [ ] La grabación genera segmentos de N minutos (configurable).
- [ ] El estado de grabación es visible en la lista de cámaras.
- [ ] Alerta cuando el espacio de almacenamiento es < 10%.

**Priority:** P0 para v1  
**Estimate:** 21 SP

---

### US-023: Ver grabaciones y reproducirlas
**Como** administrador u operador,  
**quiero** ver y reproducir grabaciones anteriores,  
**para** revisar incidentes pasados.

**Criterios de Aceptación:**
- [ ] Interfaz de calendario para seleccionar fecha.
- [ ] Timeline de grabaciones disponibles para la fecha seleccionada.
- [ ] Reproducción con controles básicos (play/pause, avance/retroceso).
- [ ] Las grabaciones están disponibles durante el período de retención configurado.

**Priority:** P0 para v1  
**Estimate:** 13 SP

---

# ════════════════════════════════════════
# ÉPICA E-08: NOTIFICACIONES Y ALERTAS
# Tier: v1
# ════════════════════════════════════════

---

### US-024: Recibir alerta cuando una cámara se desconecta
**Como** administrador u operador,  
**quiero** recibir una notificación cuando una cámara se desconecta,  
**para** poder investigar rápidamente.

**Criterios de Aceptación:**
- [ ] El Admin puede configurar qué cámaras generan alertas.
- [ ] La alerta se envía por email cuando una cámara está offline > 5 minutos.
- [ ] La notificación incluye: nombre de la cámara, tiempo desde la desconexión, ubicación.
- [ ] Notificación de recuperación cuando la cámara vuelve a estar online.

**Priority:** P0 para v1  
**Estimate:** 8 SP

---

### US-025: Notificaciones en tiempo real en el dashboard
**Como** operador,  
**quiero** ver notificaciones en tiempo real en el dashboard sin recargar la página,  
**para** estar informado de cambios de estado inmediatamente.

**Criterios de Aceptación:**
- [ ] Toast notification cuando una cámara cambia de estado (online/offline).
- [ ] Indicador de estado en la celda se actualiza en tiempo real (WebSocket).
- [ ] Centro de notificaciones con historial de los últimos 50 eventos.

**Priority:** P1 para v1  
**Estimate:** 8 SP

---

# ════════════════════════════════════════
# ÉPICA E-09: ANALÍTICA DE VIDEO
# Tier: v2
# ════════════════════════════════════════

---

### US-026: Detección de movimiento
**Como** operador,  
**quiero** que el sistema detecte movimiento en las cámaras configuradas,  
**para** recibir alertas solo cuando hay actividad.

**Criterios de Aceptación:**
- [ ] El Admin puede habilitar detección de movimiento por cámara.
- [ ] Se puede definir zonas de interés (áreas del frame) para la detección.
- [ ] Genera evento/alerta cuando se detecta movimiento en la zona configurada.
- [ ] Sensibilidad configurable.

**Priority:** P0 para v2  
**Estimate:** 21 SP

---

# ════════════════════════════════════════
# ÉPICA E-10: MEJORAS DE UX Y ACCESO
# Tier: v1/v2
# ════════════════════════════════════════

---

### US-027: Interfaz responsive para móvil
**Como** supervisor,  
**quiero** acceder al sistema desde mi teléfono o tablet,  
**para** revisar el estado de las instalaciones cuando no estoy en la oficina.

**Criterios de Aceptación:**
- [ ] El dashboard es usable en pantallas de 375px a 1920px de ancho.
- [ ] El player WebRTC funciona en Safari iOS y Chrome Android.
- [ ] Los layouts se adaptan automáticamente al tamaño de pantalla.

**Priority:** P1 para v1  
**Estimate:** 8 SP

---

### US-028: Filtrado de cámaras por ubicación en el dashboard
**Como** operador,  
**quiero** filtrar las cámaras disponibles por ubicación al construir o usar layouts,  
**para** encontrar rápidamente las cámaras que necesito.

**Criterios de Aceptación:**
- [ ] Panel lateral de cámaras tiene filtro por ubicación.
- [ ] El filtro persiste durante la sesión.

**Priority:** P1  
**Estimate:** 2 SP

---

## Resumen del Backlog

| Tier | Stories | Story Points |
|------|---------|-------------|
| MVP | US-001 a US-021 | ~102 SP |
| v1 | US-022 a US-025, US-027 | ~58 SP |
| v2 | US-026, US-028+ | ~30+ SP |
| **Total** | **~28 stories** | **~190+ SP** |

| Prioridad | Descripción |
|-----------|-------------|
| P0 | Bloqueante — el MVP no funciona sin esto |
| P1 | Importante — degrada la experiencia pero no bloquea |
| P2 | Deseable — mejora la experiencia |
| P3 | Futuro — no es urgente |
