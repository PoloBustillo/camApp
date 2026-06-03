# Autenticación — Auth.js v5

## Stack

- **Auth.js v5** (next-auth@beta) con proveedor Credentials
- **Next.js 15** App Router — Server Actions para login
- **Prisma ORM** — consulta a base de datos PostgreSQL
- **bcryptjs** — hash de contraseñas
- **JWT** — sesiones stateless en cookies HttpOnly

## Decisiones de Arquitectura

### ¿Por qué Auth.js v5?
- Integración nativa con Next.js 15 App Router y Server Components
- Manejo automático de sesiones con cookies HttpOnly seguras
- Elimina la necesidad de gestionar tokens JWT manualmente
- Soporte para Server Actions

### Flujo de Sesión

```
Usuario → LoginForm (Client) → loginAction (Server Action)
  → signIn("credentials") → authorizeCredentials()
    → prisma.user.findUnique() → bcrypt.compare()
    → JWT firmado con AUTH_SECRET → Cookie HttpOnly
```

### Protección de Rutas

**Middleware** (`src/middleware.ts`): Protege todas las rutas excepto `/api/auth/*`, `_next/static`, `_next/image`, `favicon.ico`.

- Rutas de API sin sesión → 401 JSON
- Página de login con sesión activa → redirect `/dashboard`
- Rutas protegidas sin sesión → redirect `/login`

**requireSession()** (`src/lib/session.ts`): Para Server Components que requieren sesión. Hace redirect automático a `/login`.

**requireAuth()** (`src/lib/middleware.ts`): Para API Routes que requieren sesión. Retorna `SessionUser` o `NextResponse 401`.

## Seguridad

### Bloqueo de Cuentas
- **5 intentos fallidos** → cuenta bloqueada por 15 minutos
- Campo `failedAttempts` y `lockedUntil` en modelo `User`
- Al expirar el bloqueo, se resetea automáticamente en el siguiente intento

### Registro de Auditoría
- Cada intento fallido → `auditLog` con `action: "auth_failure"`
- Login exitoso → `auditLog` con `action: "user_login"`
- Los logs de auditoría usan fire-and-forget (`.catch(() => {})`) para no bloquear el flujo

### Password Hashing
- bcrypt con salt rounds 12 (configurado en el seed)
- Las contraseñas nunca se almacenan en texto plano

## RBAC (Control de Acceso Basado en Roles)

| Rol | Dashboard | Cámaras | Layouts | Usuarios | Edge Servers |
|-----|-----------|---------|---------|----------|--------------|
| admin | ✅ | CRUD | CRUD | CRUD | CRUD |
| operator | ✅ | CRU | CRUD | R | R |
| viewer | ✅ | R | R | — | — |

Los helpers `isAdmin()`, `isOperator()`, `isViewer()` están en `src/lib/session.ts`.

## Variables de Entorno

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `AUTH_SECRET` | Secret para firmar JWT de sesión. Genera con `openssl rand -base64 32` | ✅ Producción |
| `AUTH_URL` | URL completa de la app (ej: `https://camwatch.example.com`) | ✅ Producción |
| `DATABASE_URL` | PostgreSQL connection string | ✅ |

## Endpoints Auth.js

Auth.js v5 expone automáticamente:
- `GET/POST /api/auth/[...nextauth]` — manejadores internos
- `/api/auth/session` — sesión actual
- `/api/auth/signout` — logout

## Estructura de Archivos

```
auth.ts                          # Configuración principal NextAuth
src/
  lib/
    authorize.ts                 # Lógica de autorización (testeable)
    session.ts                   # Helpers para Server Components
    middleware.ts                # requireAuth() para API Routes
    stream.ts                    # signStreamToken() para MediaMTX
  types/
    next-auth.d.ts               # Extensión de tipos de Auth.js
  middleware.ts                  # Middleware de Next.js
  app/
    api/auth/[...nextauth]/
      route.ts                   # Handler de Auth.js
    (auth)/login/
      page.tsx                   # Página de login
      actions.ts                 # Server Action para login
  components/auth/
    login-form.tsx               # Formulario de login (Client Component)
    logout-button.tsx            # Botón de logout (Client Component)
```
