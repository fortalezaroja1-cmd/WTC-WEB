# Wired Technology — Tienda de materiales eléctricos

Tienda e-commerce con panel administrativo para distribución de cables Centelsa, iluminación LED y accesorios Mercury.

> GitHub y Vercel sincronizados para despliegues automáticos desde `main`. Root Directory en Vercel: `wired-technology`.

## Stack

- **Framework:** Next.js 15 (App Router)
- **Base de datos:** PostgreSQL (Supabase)
- **ORM:** Prisma
- **Imágenes:** Supabase Storage
- **Estilos:** Tailwind CSS v4
- **Deploy:** Vercel
- **Pagos:** Mercado Pago (Checkout Pro)

---

## SETUP PASO A PASO

### 1. Instalar dependencias

```bash
npm install
```

### 2. Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) → New Project
2. Nombre: `wired-technology`
3. Password: anota la contraseña (la necesitas para DATABASE_URL)
4. Región: South America (São Paulo)
5. Espera que el proyecto se cree

### 3. Configurar variables de entorno

1. Copia `.env.example` a `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. En el panel de Supabase → Settings → Database:
   - Copia la **Connection String (URI)** → pégala como `DATABASE_URL`
   - Reemplaza `[YOUR-PASSWORD]` con tu contraseña
   - Copia lo mismo en `DIRECT_URL`

3. En Supabase → Settings → API:
   - Copia **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - Copia **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. `JWT_SECRET`: genera uno con `openssl rand -base64 32` o pon un string secreto largo

### 4. Crear bucket de imágenes en Supabase

1. En Supabase → Storage → New Bucket
2. Nombre: `products`
3. **Marcar como público** (Public bucket)
4. Crear

### 5. Crear tablas y datos iniciales

```bash
npx prisma generate
npx prisma db push
npm run db:seed
```

### 6. Iniciar en desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

### 7. Acceder al panel admin

- URL: [http://localhost:3000/admin/login](http://localhost:3000/admin/login)
- Email: `admin@wiredtech.co`
- Contraseña: `admin123`

---

## Estructura del proyecto

```
app/
  (store)/            # Tienda pública
    page.tsx          # Homepage con hero + destacados
    productos/        # Catálogo completo
    productos/[slug]/ # Detalle de producto
    categorias/[slug] # Productos por categoría
    checkout/         # Formulario de pedido
    confirmacion/     # Confirmación del pedido
  admin/              # Panel administrativo
    page.tsx          # Dashboard con KPIs
    productos/        # CRUD de productos
    pedidos/          # Gestión de pedidos
    inventario/       # Control de stock
    clientes/         # Base de clientes
    contenido/        # Settings de la tienda
  api/
    orders/           # Crear pedidos (público)
    auth/login/       # Login admin
    upload/           # Subir imágenes a Supabase
    admin/            # APIs protegidas del admin
components/
  store/              # Componentes de la tienda
  admin/              # Componentes del admin
lib/
  db.ts               # Cliente Prisma
  supabase.ts         # Cliente Supabase + upload
  auth.ts             # JWT para admin
  utils.ts            # Helpers y constantes
prisma/
  schema.prisma       # Schema de la base de datos
  seed.ts             # Datos iniciales (catálogo real)
```

## Deploy en Vercel

1. Sube el proyecto a GitHub
2. En [vercel.com](https://vercel.com) → Import Git Repository
3. Agrega las variables de entorno de `.env.local`
4. Deploy

Tu tienda quedará en: `https://wired-technology.vercel.app`

## Mercado Pago

Para activar pagos:
1. Crea cuenta en [mercadopago.com.co](https://www.mercadopago.com.co)
2. Tus credenciales → API → copia Access Token y Public Key
3. Agrégalas a las variables de entorno

---

**Catálogo incluido:** 13 productos reales con variantes (calibres, potencias, amperajes), organizado en 3 categorías y 13 subcategorías.
