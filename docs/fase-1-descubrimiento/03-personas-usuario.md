# 1.3 — Personas de Usuario

**Proyecto:** CamWatch Platform  
**Versión:** 1.0  
**Fecha:** Junio 2026

---

## Persona 1: Administrador del Sistema

```
┌─────────────────────────────────────────────────────────┐
│  👤 Carlos Méndez — Administrador de Infraestructura    │
│  Edad: 38 años  |  Experiencia técnica: Alta            │
└─────────────────────────────────────────────────────────┘
```

### Contexto
Carlos es responsable de la infraestructura tecnológica de la empresa. Gestiona servidores, redes y sistemas de seguridad. Tiene experiencia con Linux, redes IP y administración de sistemas. Conoce los conceptos básicos de streaming de video.

### Objetivos
- Configurar y mantener el sistema de videovigilancia sin depender de un proveedor externo.
- Asegurarse de que el sistema sea estable, seguro y fácil de escalar.
- Controlar quién tiene acceso y qué pueden ver o modificar.
- Agregar nuevas cámaras sin necesidad de configuración compleja.
- Recibir alertas si el sistema falla o una cámara se desconecta.

### Necesidades y Expectativas
- Interfaz de administración clara y eficiente.
- Logs y métricas para diagnosticar problemas rápidamente.
- Capacidad de agregar una cámara nueva en menos de 5 minutos.
- Gestión de usuarios con roles bien definidos.
- Documentación clara del sistema.

### Puntos de Dolor
- Soluciones NVR propietarias son costosas y crean dependencia del proveedor.
- La configuración de redes entre ubicaciones remotas es compleja.
- Si el sistema falla a las 2 AM, necesita poder diagnosticarlo remotamente.
- No quiere que los operadores accedan a configuraciones que puedan romper el sistema.

### Comportamiento en el Sistema
- Accede desde su workstation con pantalla amplia.
- Configura cámaras y usuarios ocasionalmente.
- Revisa el estado del sistema regularmente.
- Responde a alertas de sistema.

### Cita Representativa
> "Necesito un sistema que pueda controlar completamente, sin pagar licencias caras y sin que cada cámara nueva requiera llamar al proveedor."

---

## Persona 2: Operador de Seguridad

```
┌─────────────────────────────────────────────────────────┐
│  👤 María González — Operadora de Seguridad             │
│  Edad: 29 años  |  Experiencia técnica: Básica-Media    │
└─────────────────────────────────────────────────────────┘
```

### Contexto
María trabaja en turnos monitoreando la seguridad de la instalación. No tiene formación técnica en IT pero usa computadora diariamente. Su enfoque es detectar incidentes y responder rápidamente. Trabaja en un cuarto de control con múltiples monitores.

### Objetivos
- Ver todas las cámaras relevantes de su zona de responsabilidad en una sola pantalla.
- Cambiar rápidamente entre diferentes vistas cuando detecta actividad.
- Ver en detalle una cámara específica cuando algo llama su atención.
- Tener layouts distintos para diferentes situaciones (día, noche, emergencia).

### Necesidades y Expectativas
- Interfaz simple e intuitiva, sin opciones que no necesita.
- Video fluido y de buena calidad visual.
- Layouts que pueda guardar y cambiar con un clic.
- La cámara no debe quedarse congelada sin aviso.
- Poder acceder desde diferentes computadoras (si tiene que cambiar de puesto).

### Puntos de Dolor
- Los sistemas complejos la distraen de su tarea principal: monitorear.
- Si el video se congela o hay un error, no sabe cómo resolverlo.
- No quiere tener que reiniciar el browser cada vez que algo falla.
- Layoutsmuy rígidos que no se adaptan a sus necesidades.

### Comportamiento en el Sistema
- Usa el sistema 8+ horas continuas por turno.
- Cambia entre layouts varias veces al día.
- Ocasionalmente agrega o reorganiza cámaras en sus layouts.
- Nunca configura cámaras nuevas ni gestiona usuarios.

### Cita Representativa
> "Necesito ver lo que pasa en mis zonas sin perder tiempo. Si la pantalla se congela o tarda, puedo perder un incidente."

---

## Persona 3: Supervisor / Gerente

```
┌─────────────────────────────────────────────────────────┐
│  👤 Roberto Fuentes — Gerente de Operaciones            │
│  Edad: 45 años  |  Experiencia técnica: Baja            │
└─────────────────────────────────────────────────────────┘
```

### Contexto
Roberto supervisa el área de seguridad y operaciones. Accede al sistema esporádicamente para revisar cámaras específicas, principalmente durante incidentes o auditorías. Accede frecuentemente desde su laptop o incluso desde su tablet.

### Objetivos
- Ver el estado de las instalaciones cuando lo necesita.
- Revisar cámaras específicas de forma rápida.
- Confirmar que el sistema de videovigilancia está funcionando.
- No quiere poder modificar nada accidentalmente.

### Necesidades y Expectativas
- Acceso simple: ingresar y ver, sin configuración.
- Poder ver la cámara que necesita rápidamente.
- Interfaz que funcione bien en su laptop sin pantalla grande.
- No necesita crear layouts, solo usar los que existen.

### Puntos de Dolor
- Sistemas complejos con demasiadas opciones que no necesita.
- Tener que recordar contraseñas o procesos de acceso complicados.
- Video de calidad pobre en conexiones de red normales de oficina.
- No puede acceder desde fuera de la oficina.

### Comportamiento en el Sistema
- Accede 2-3 veces por semana, generalmente por menos de 30 minutos.
- Solo visualiza, nunca configura.
- Puede acceder desde múltiples dispositivos.
- Prefiere layouts predefinidos por el Admin.

### Cita Representativa
> "Solo necesito poder ver las cámaras cuando lo necesito, sin que el sistema me pida instalar nada ni hacer configuraciones."

---

## Persona 4: Técnico de Instalación (Usuario Temporal)

```
┌─────────────────────────────────────────────────────────┐
│  👤 Javier Ramírez — Técnico de Instalación             │
│  Edad: 32 años  |  Experiencia técnica: Alta (Hardware) │
└─────────────────────────────────────────────────────────┘
```

### Contexto
Javier instala y da mantenimiento a las cámaras físicamente en la ubicación remota. No siempre está disponible remotamente. Necesita verificar que cada cámara funciona correctamente después de instalarla o repararla.

### Objetivos
- Verificar que una cámara recién instalada está transmitiendo correctamente.
- Confirmar que el stream llega al sistema sin problemas.
- Reportar el estado de cada cámara al administrador.

### Necesidades y Expectativas
- Acceso temporal y limitado para validar cámaras.
- Ver una cámara específica de forma aislada.
- No necesita acceso permanente.

### Nota
Este usuario podría manejarse con una cuenta de Operator temporal, o en futuras versiones, con un modo de diagnóstico dedicado.

---

## Resumen de Necesidades por Persona

| Necesidad | Carlos (Admin) | María (Operator) | Roberto (Viewer) |
|-----------|:--------------:|:----------------:|:----------------:|
| Ver streams en tiempo real | ✅ | ✅ (crítico) | ✅ |
| Layouts personalizados | ✅ | ✅ (crítico) | Solo ver |
| Gestionar cámaras | ✅ (crítico) | ❌ | ❌ |
| Gestionar usuarios | ✅ (crítico) | ❌ | ❌ |
| Logs y diagnóstico | ✅ (crítico) | ❌ | ❌ |
| Acceso móvil | ❌ (baja prioridad) | ❌ | ✅ (deseado) |
| Alertas de sistema | ✅ | ⚠️ (futuro) | ❌ |
| Multi-pantalla | ✅ | ✅ | ❌ |
| Interfaz simple | ⚠️ (funcional) | ✅ (crítico) | ✅ (crítico) |
