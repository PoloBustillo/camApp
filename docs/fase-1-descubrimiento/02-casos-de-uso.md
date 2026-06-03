# 1.2 — Casos de Uso

**Proyecto:** CamWatch Platform  
**Versión:** 1.0  
**Fecha:** Junio 2026

---

## Diagrama de Actores

```
┌─────────────────────────────────────────────────────────┐
│                   CamWatch Platform                      │
│                                                          │
│  ┌──────────────────┐  ┌─────────────────────────────┐  │
│  │   Admin          │  │   Casos de Uso del Sistema   │  │
│  │  (hereda todo)   │  │                              │  │
│  └──────────────────┘  │  • Ver streams               │  │
│                         │  • Gestionar cámaras         │  │
│  ┌──────────────────┐  │  • Gestionar layouts         │  │
│  │   Operator       │  │  • Gestionar ubicaciones     │  │
│  │  (hereda Viewer) │  │  • Gestionar usuarios        │  │
│  └──────────────────┘  │  • Autenticarse              │  │
│                         │  • Ver cámara completa       │  │
│  ┌──────────────────┐  │  • Reconexión automática     │  │
│  │   Viewer         │  └─────────────────────────────┘  │
│  │  (solo lectura)  │                                    │
│  └──────────────────┘                                    │
└─────────────────────────────────────────────────────────┘

Actores externos:
  MediaMTX Server  →  provee streams de video
  Tailscale VPN    →  provee conectividad segura
  Cámaras IP       →  fuente de video
```

---

## CU-001: Autenticarse en el Sistema

**Actor:** Cualquier usuario  
**Prioridad:** Crítica  
**Precondición:** El usuario tiene credenciales válidas en el sistema  

### Flujo Principal
1. El usuario navega a la URL de la plataforma.
2. El sistema muestra el formulario de inicio de sesión.
3. El usuario ingresa email y contraseña.
4. El sistema valida las credenciales contra la base de datos.
5. El sistema genera un JWT de acceso (15 min) y un refresh token (7 días).
6. El sistema redirige al usuario al dashboard principal según su rol.

### Flujos Alternativos
- **FA-001a** (Credenciales inválidas): El sistema muestra un mensaje de error genérico. Permite máximo 5 intentos fallidos antes de bloquear por 15 minutos.
- **FA-001b** (Token expirado): El cliente usa el refresh token para obtener un nuevo JWT sin re-autenticar.
- **FA-001c** (Refresh token expirado): El sistema redirige al login.

### Postcondición
El usuario está autenticado y ve el dashboard correspondiente a su rol.

---

## CU-002: Ver Streams de Cámaras en Tiempo Real

**Actor:** Admin, Operator, Viewer  
**Prioridad:** Crítica  
**Precondición:** El usuario está autenticado. Existen cámaras configuradas y activas.

### Flujo Principal
1. El usuario accede al dashboard de monitoreo.
2. El sistema carga el layout activo del usuario (o el layout por defecto).
3. Para cada cámara en el layout, el sistema solicita al backend la URL del stream WebRTC.
4. El backend consulta la API de MediaMTX para verificar que el stream está activo.
5. El backend devuelve los parámetros SDP/ICE para la negociación WebRTC.
6. El frontend establece la conexión WebRTC directamente con MediaMTX.
7. El stream de video se reproduce en cada celda del layout.

### Flujos Alternativos
- **FA-002a** (Cámara desconectada): La celda muestra un indicador de "Sin señal" con el nombre de la cámara. El sistema reintenta la conexión cada 30 segundos.
- **FA-002b** (MediaMTX no responde): El sistema muestra un error de servicio no disponible y notifica al Admin.
- **FA-002c** (Ancho de banda insuficiente): El cliente solicita un stream de menor calidad si está disponible.

### Postcondición
El usuario visualiza los streams activos en tiempo real con latencia < 2 segundos.

---

## CU-003: Cambiar Layout de Visualización

**Actor:** Admin, Operator  
**Prioridad:** Alta  
**Precondición:** El usuario está autenticado. Existen layouts guardados.

### Flujo Principal
1. El usuario accede al selector de layouts en el dashboard.
2. El sistema muestra los layouts disponibles (propios y compartidos).
3. El usuario selecciona un layout.
4. El sistema carga las cámaras asignadas a ese layout.
5. Los streams se reconectan según el nuevo layout.

### Flujos Alternativos
- **FA-003a** (Layout vacío): El sistema muestra el layout vacío indicando que no hay cámaras asignadas.

---

## CU-004: Crear Layout Personalizado

**Actor:** Admin, Operator  
**Prioridad:** Alta  
**Precondición:** El usuario está autenticado. Existen cámaras configuradas.

### Flujo Principal
1. El usuario accede a "Gestión de Layouts" → "Nuevo Layout".
2. El sistema muestra las opciones de grilla (1x1, 2x2, 2x3, 3x3).
3. El usuario selecciona una configuración de grilla.
4. El sistema muestra la grilla con celdas vacías.
5. El usuario arrastra cámaras del panel lateral a las celdas.
6. El usuario asigna un nombre al layout.
7. El usuario guarda el layout.
8. El sistema persiste el layout y lo asocia al usuario.

### Flujos Alternativos
- **FA-004a** (Nombre duplicado): El sistema advierte y permite cambiar el nombre.
- **FA-004b** (Cámara ya asignada en otra celda): El sistema permite duplicados o advierte según configuración.

---

## CU-005: Agregar Cámara al Sistema

**Actor:** Admin  
**Prioridad:** Crítica  
**Precondición:** El usuario es Administrador. La cámara está físicamente instalada y accesible en la red interna de la ubicación remota.

### Flujo Principal
1. El Admin accede a "Gestión de Cámaras" → "Agregar Cámara".
2. El sistema muestra el formulario de nueva cámara.
3. El Admin ingresa: nombre, URL RTSP o datos ONVIF (IP, puerto, usuario, contraseña), ubicación y descripción.
4. El sistema valida el formato de la URL/datos.
5. El sistema envía al backend la solicitud de agregar la cámara.
6. El backend registra la cámara en MediaMTX a través de su API.
7. El backend verifica que MediaMTX puede conectarse al stream RTSP.
8. El sistema guarda la cámara en la base de datos con estado "activa".
9. El sistema confirma la adición exitosa al Admin.

### Flujos Alternativos
- **FA-005a** (URL RTSP inaccesible): El sistema informa que no puede conectar al stream y guarda la cámara con estado "inactiva".
- **FA-005b** (Credenciales incorrectas de cámara): El backend retorna error de autenticación con la cámara.
- **FA-005c** (Cámara ya existe): El sistema detecta duplicado por URL y advierte.

---

## CU-006: Eliminar Cámara del Sistema

**Actor:** Admin  
**Prioridad:** Alta  
**Precondición:** El usuario es Administrador. La cámara existe en el sistema.

### Flujo Principal
1. El Admin accede a "Gestión de Cámaras".
2. El Admin selecciona una cámara y elige "Eliminar".
3. El sistema muestra confirmación indicando en cuántos layouts aparece la cámara.
4. El Admin confirma la eliminación.
5. El backend elimina la cámara de MediaMTX.
6. El backend elimina la cámara de todos los layouts donde aparece.
7. El sistema guarda la eliminación (soft delete con auditoría).

### Flujos Alternativos
- **FA-006a** (Error en MediaMTX): La cámara se marca como eliminada en la DB pero el sistema alerta sobre el error en MediaMTX para limpieza manual.

---

## CU-007: Editar Cámara

**Actor:** Admin  
**Prioridad:** Media  
**Precondición:** El usuario es Administrador. La cámara existe en el sistema.

### Flujo Principal
1. El Admin accede a la cámara y selecciona "Editar".
2. El sistema muestra el formulario prellenado.
3. El Admin modifica los campos requeridos.
4. El sistema valida y actualiza en MediaMTX y en la base de datos.
5. Si cambia la URL RTSP, el sistema reinicia el stream en MediaMTX.

---

## CU-008: Gestionar Grupos/Ubicaciones

**Actor:** Admin  
**Prioridad:** Alta  
**Precondición:** El usuario es Administrador.

### Flujo Principal
1. El Admin accede a "Ubicaciones".
2. El Admin puede crear, editar o eliminar grupos de cámaras.
3. Al crear una ubicación, define: nombre, descripción, identificador.
4. El Admin asigna cámaras existentes a la ubicación.
5. Los operadores pueden filtrar el dashboard por ubicación.

---

## CU-009: Gestionar Usuarios

**Actor:** Admin  
**Prioridad:** Alta  
**Precondición:** El usuario es Administrador.

### Flujo Principal
1. El Admin accede a "Gestión de Usuarios".
2. Para crear usuario: nombre, email, contraseña temporal, rol (Admin/Operator/Viewer).
3. El sistema envía credenciales por email (o muestra en pantalla en MVP).
4. Para editar: cambiar rol, nombre, estado (activo/inactivo).
5. Para eliminar: soft delete con revocación de tokens activos.

### Flujos Alternativos
- **FA-009a** (Email duplicado): El sistema rechaza la creación con mensaje de error.
- **FA-009b** (Eliminación del último Admin): El sistema bloquea la operación.

---

## CU-010: Ver Cámara en Pantalla Completa

**Actor:** Admin, Operator, Viewer  
**Prioridad:** Media  
**Precondición:** El usuario está viendo el dashboard con al menos una cámara activa.

### Flujo Principal
1. El usuario hace doble clic o clic en el ícono de expansión de una celda.
2. El sistema expande el stream al modo pantalla completa.
3. El usuario puede volver al layout normal presionando Escape o el botón de cerrar.

---

## CU-011: Cerrar Sesión

**Actor:** Cualquier usuario autenticado  
**Prioridad:** Alta  

### Flujo Principal
1. El usuario selecciona "Cerrar Sesión".
2. El sistema invalida el refresh token en la base de datos (blacklist).
3. El sistema elimina los tokens del almacenamiento local del cliente.
4. El sistema redirige al login.

---

## Matriz de Casos de Uso por Rol

| Caso de Uso | Admin | Operator | Viewer |
|-------------|-------|----------|--------|
| CU-001 Autenticarse | ✅ | ✅ | ✅ |
| CU-002 Ver streams | ✅ | ✅ | ✅ |
| CU-003 Cambiar layout | ✅ | ✅ | ❌ |
| CU-004 Crear layout | ✅ | ✅ | ❌ |
| CU-005 Agregar cámara | ✅ | ❌ | ❌ |
| CU-006 Eliminar cámara | ✅ | ❌ | ❌ |
| CU-007 Editar cámara | ✅ | ❌ | ❌ |
| CU-008 Gestionar ubicaciones | ✅ | ❌ | ❌ |
| CU-009 Gestionar usuarios | ✅ | ❌ | ❌ |
| CU-010 Pantalla completa | ✅ | ✅ | ✅ |
| CU-011 Cerrar sesión | ✅ | ✅ | ✅ |
