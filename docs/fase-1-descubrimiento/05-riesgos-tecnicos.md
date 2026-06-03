# 1.5 — Riesgos Técnicos

**Proyecto:** CamWatch Platform  
**Versión:** 1.0  
**Fecha:** Junio 2026

---

## Escala de Evaluación

| Probabilidad | Descripción |
|-------------|-------------|
| Alta (3) | Ocurrirá o ha ocurrido en proyectos similares |
| Media (2) | Podría ocurrir bajo ciertas condiciones |
| Baja (1) | Poco probable pero posible |

| Impacto | Descripción |
|---------|-------------|
| Alto (3) | Bloquea el proyecto o funcionalidad crítica |
| Medio (2) | Degrada la experiencia o requiere rediseño parcial |
| Bajo (1) | Molestia menor o workaround disponible |

**Nivel de Riesgo = Probabilidad × Impacto** (1-9)

---

## RIESGO-001: Latencia Elevada en el Stream de Video

| Campo | Detalle |
|-------|---------|
| **Descripción** | La latencia end-to-end (cámara → MediaMTX → WebRTC → browser) podría superar los 2 segundos objetivo |
| **Causa raíz** | Ancho de banda limitado en la ubicación remota, congestión de red, latencia de Tailscale, retraso de MediaMTX |
| **Probabilidad** | Media (2) |
| **Impacto** | Alto (3) — el requisito principal del sistema es monitoreo en tiempo real |
| **Nivel** | 🔴 6 |
| **Mitigación** | Medir latencia en entorno real antes de decidir configuraciones. Usar perfil de bajo delay en MediaMTX (tune=zerolatency). Priorizar H.264 sobre H.265. Configurar buffer mínimo en WebRTC. |
| **Plan de contingencia** | Si no se logra < 2s, revisar si < 3s es aceptable para el usuario o implementar HLS como fallback con indicador visual de latencia. |
| **Responsable** | Tech Lead |

---

## RIESGO-002: Desconexión Intermitente de Cámaras

| Campo | Detalle |
|-------|---------|
| **Descripción** | Las cámaras IP pueden desconectarse de la red por cortes de energía, problemas de red o fallas de hardware |
| **Causa raíz** | Infraestructura de red en la ubicación remota fuera del control del equipo |
| **Probabilidad** | Alta (3) |
| **Impacto** | Medio (2) — degradación de la experiencia pero no bloqueo total |
| **Nivel** | 🟡 6 |
| **Mitigación** | MediaMTX reintenta reconexión automáticamente. El frontend detecta streams inactivos vía heartbeat. El sistema muestra indicador "Sin señal" en lugar de error. |
| **Plan de contingencia** | Implementar reconexión automática con backoff exponencial. Alertas al admin para desconexiones prolongadas (> 5 min). |
| **Responsable** | Backend Developer |

---

## RIESGO-003: Sobrecarga de CPU en Servidor MediaMTX

| Campo | Detalle |
|-------|---------|
| **Descripción** | El servidor Ubuntu con recursos limitados puede saturarse si MediaMTX necesita transcodificar video |
| **Causa raíz** | Cámaras con H.265 en browsers que no lo soportan obligan a transcodificación H.265 → H.264, que es costosa en CPU |
| **Probabilidad** | Media (2) |
| **Impacto** | Alto (3) — puede degradar todos los streams simultáneamente |
| **Nivel** | 🔴 6 |
| **Mitigación** | Configurar MediaMTX en modo passthrough (sin transcodificación). Documentar que las cámaras deben estar configuradas en H.264. Verificar compatibilidad H.265 en browsers objetivo antes de decidir. |
| **Plan de contingencia** | Si la transcodificación es necesaria, evaluar moverla al VPS del backend con un proceso ffmpeg separado, o reducir el número de streams simultáneos. |
| **Responsable** | DevOps / Administrador de Sistemas |

---

## RIESGO-004: Incompatibilidad entre Fabricantes de Cámaras y ONVIF

| Campo | Detalle |
|-------|---------|
| **Descripción** | El descubrimiento y configuración vía ONVIF puede fallar en algunas marcas/modelos a pesar de ser "compatible con ONVIF" |
| **Causa raíz** | El estándar ONVIF tiene múltiples perfiles y los fabricantes no implementan el estándar de forma uniforme |
| **Probabilidad** | Alta (3) |
| **Impacto** | Bajo (1) — ONVIF es complementario; la URL RTSP manual siempre funciona |
| **Nivel** | 🟢 3 |
| **Mitigación** | Hacer de ONVIF un feature opcional/secundario. Siempre permitir la entrada manual de URL RTSP como método principal. |
| **Plan de contingencia** | Documentar las cámaras compatibles probadas. Proveer una guía de configuración manual de URLs RTSP por marca. |
| **Responsable** | Backend Developer |

---

## RIESGO-005: Interrupción de la Red Tailscale

| Campo | Detalle |
|-------|---------|
| **Descripción** | Si la conectividad Tailscale falla, el backend pierde acceso a MediaMTX y todos los streams se interrumpen |
| **Causa raíz** | Dependencia en un servicio de tercero (Tailscale control plane) para mantener la VPN |
| **Probabilidad** | Baja (1) |
| **Impacto** | Alto (3) — pérdida total del servicio de streaming |
| **Nivel** | 🟡 3 |
| **Mitigación** | Tailscale tiene un modo "direct connections" que no depende del relay server. Los nodos que ya se conocen pueden mantener conexión P2P incluso si el control plane de Tailscale está caído. |
| **Plan de contingencia** | Monitorear la conectividad entre VPS y servidor remoto. Considerar WireGuard directo como backup (más complejo de configurar). |
| **Responsable** | DevOps |

---

## RIESGO-006: Credenciales de Cámara Expuestas

| Campo | Detalle |
|-------|---------|
| **Descripción** | Las URLs RTSP contienen usuario y contraseña de la cámara. Si la base de datos es comprometida, se exponen las credenciales |
| **Causa raíz** | Las URLs RTSP tienen formato `rtsp://user:password@ip/stream` |
| **Probabilidad** | Baja (1) |
| **Impacto** | Alto (3) — acceso no autorizado a cámaras físicas |
| **Nivel** | 🟡 3 |
| **Mitigación** | Cifrar las credenciales de cámara en reposo usando AES-256-GCM con clave derivada de una variable de entorno. Nunca devolver credenciales completas en respuestas API. |
| **Plan de contingencia** | Rotación de credenciales de cámara, auditoría de acceso a la base de datos. |
| **Responsable** | Backend Developer / Security |

---

## RIESGO-007: Escalabilidad Insuficiente del Backend

| Campo | Detalle |
|-------|---------|
| **Descripción** | Si el número de cámaras o usuarios crece más rápido de lo previsto, el backend puede volverse un cuello de botella |
| **Causa raíz** | Diseño para 10 cámaras y 5 usuarios concurrentes en MVP |
| **Probabilidad** | Baja (1) |
| **Impacto** | Medio (2) |
| **Nivel** | 🟢 2 |
| **Mitigación** | Diseñar el backend sin estado (stateless) desde el inicio. Usar JWT para evitar sesiones en servidor. Hacer la configuración de conexión a DB como pool configurable. |
| **Plan de contingencia** | Escalado vertical del VPS es la primera respuesta. Luego implementar Redis para caché y balanceo de carga. |
| **Responsable** | Arquitecto |

---

## RIESGO-008: Pérdida de Datos por Falla del VPS

| Campo | Detalle |
|-------|---------|
| **Descripción** | Si el VPS falla sin respaldo, se pierden configuraciones de cámaras, usuarios y layouts |
| **Causa raíz** | Un solo punto de falla sin estrategia de backup |
| **Probabilidad** | Baja (1) |
| **Impacto** | Alto (3) |
| **Nivel** | 🟡 3 |
| **Mitigación** | Configurar backups automáticos diarios de la base de datos PostgreSQL. Usar Docker Compose con volúmenes nombrados para persistencia. Documentar el proceso de restauración. |
| **Plan de contingencia** | Restauración desde backup. RTO objetivo: < 4 horas. RPO objetivo: < 24 horas. |
| **Responsable** | DevOps |

---

## Registro Consolidado de Riesgos

| ID | Descripción | Prob | Impacto | Nivel | Estado |
|----|-------------|------|---------|-------|--------|
| RIESGO-001 | Latencia elevada en stream | 2 | 3 | 🔴 6 | Activo |
| RIESGO-002 | Desconexión de cámaras | 3 | 2 | 🟡 6 | Activo |
| RIESGO-003 | Sobrecarga CPU en MediaMTX | 2 | 3 | 🔴 6 | Activo |
| RIESGO-004 | Incompatibilidad ONVIF | 3 | 1 | 🟢 3 | Aceptado |
| RIESGO-005 | Interrupción Tailscale | 1 | 3 | 🟡 3 | Monitoreado |
| RIESGO-006 | Credenciales de cámara expuestas | 1 | 3 | 🟡 3 | Mitigado (cifrado) |
| RIESGO-007 | Escalabilidad insuficiente | 1 | 2 | 🟢 2 | Diseño preventivo |
| RIESGO-008 | Pérdida de datos en VPS | 1 | 3 | 🟡 3 | Mitigado (backups) |

---

## Acciones Prioritarias Antes de Iniciar Desarrollo

1. **Validar la latencia real** — Configurar un MediaMTX de prueba en el servidor Ubuntu y medir la latencia WebRTC desde el VPS y desde internet.
2. **Verificar recursos de CPU** — Medir el consumo de CPU/RAM del servidor Ubuntu con 10 streams activos simultáneos en modo passthrough.
3. **Probar conectividad Tailscale** — Validar que el VPS puede conectarse a la API de MediaMTX vía Tailscale de forma estable.
4. **Verificar codecs de cámaras** — Confirmar que las cámaras instaladas pueden configurarse en H.264 para evitar transcodificación.
