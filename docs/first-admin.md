# Primer usuario Admin en Turnia

Para poder iniciar sesión y actuar como **Org Admin** (gestión de organizaciones, equipos y roles) hay que:

1. Crear el usuario en Auth.
2. Crear la primera organización y una membership con rol `org_admin` para ese usuario.

---

## Paso 1: Crear el usuario

### Opción A – Desde la app (recomendado)

1. Ve a **/signup**.
2. Completa nombre, correo y contraseña y crea la cuenta.
3. Si en Supabase está activada la **confirmación de correo**, revisa el email y confirma.
4. Si la confirmación está **desactivada**, puedes pasar directo al paso 2.
5. Anota el **correo** del usuario (lo usarás para localizarlo en el paso 2).

### Opción B – Desde el Dashboard de Supabase

1. [Supabase](https://supabase.com/dashboard) → tu proyecto → **Authentication** → **Users**.
2. **Add user** → **Create new user**.
3. Email y contraseña; opcional: **Auto Confirm User** si no quieres confirmación por correo.
4. Guarda. El trigger `handle_new_user` creará la fila en `profiles`.

---

## Paso 2: Obtener el UUID del usuario

1. **Authentication** → **Users**.
2. Busca el usuario por correo y copia su **UUID** (p. ej. `a1b2c3d4-e5f6-7890-abcd-ef1234567890`).

---

## Paso 3: Crear organización y membership (Org Admin)

En **SQL Editor** de Supabase ejecuta el siguiente SQL, sustituyendo `YOUR_USER_UUID` por el UUID del paso 2:

```sql
-- Crea la primera organización y asigna al usuario como org_admin
WITH new_org AS (
  INSERT INTO public.organizations (name, slug)
  VALUES ('Mi Organización', 'mi-org')
  RETURNING id
)
INSERT INTO public.memberships (org_id, user_id, team_id, role)
SELECT id, 'ee42ac49-a5eb-482e-aeb5-49d765d20e36'::uuid, NULL, 'org_admin'
FROM new_org;
```

Si prefieres hacerlo en dos pasos (y reutilizar el `id` de la organización):

```sql
-- 1) Crear organización
INSERT INTO public.organizations (name, slug)
VALUES ('Mi Organización', 'mi-org')
RETURNING id;
-- Copia el id devuelto.

-- 2) Crear membership (reemplaza YOUR_ORG_ID y YOUR_USER_UUID)
INSERT INTO public.memberships (org_id, user_id, team_id, role)
VALUES ('YOUR_ORG_ID'::uuid, 'YOUR_USER_UUID'::uuid, NULL, 'org_admin');
```

---

## Paso 4: Iniciar sesión

1. Ve a **/login**.
2. Entra con el correo y la contraseña del usuario.
3. Deberías poder acceder a **/dashboard** y, con rol `org_admin`, a **/dashboard/admin**.

---

## Confirmación de correo en Supabase

Si al registrarte no llega el email de confirmación:

1. **Authentication** → **Providers** → **Email**.
2. Revisa si **Confirm email** está activado.
3. Para desarrollo, puedes desactivarlo para que el usuario quede confirmado al registrarse.
4. Revisa también **Authentication** → **Email Templates** y la configuración de envío (SMTP o el de Supabase).

---

## Cómo convertir un usuario en Superadmin

El **superadmin** puede hacer **CRUD completo** en todos los modelos: `organizations`, `teams`, `memberships`, `shifts`, `shift_requests`, `availability_events`, `organization_invitations` y `profiles` (lectura en `audit_log`; no se permite borrar registros de auditoría).

### Requisitos

1. Aplicar la migración `20250125100000_superadmin_full_crud.sql` (amplía RLS y `user_org_ids()` para superadmins).
2. El usuario debe tener **al menos un membership** con `role = 'superadmin'`. Dado que `org_id` es obligatorio en `memberships`, se usa una organización “ancla” (puede ser cualquiera; lo importante es el rol).

### Paso 1: Obtener el UUID del usuario

1. Supabase → **Authentication** → **Users**.
2. Localiza al usuario por correo y copia su **UUID**.

### Paso 2: Asignar el rol superadmin

Elige **una** de las dos opciones.

#### Opción A: Usar una organización existente

Si ya tienes organizaciones, usa el `id` de cualquiera (p. ej. la primera):

```sql
-- Reemplaza YOUR_ORG_ID y YOUR_USER_UUID
INSERT INTO public.memberships (org_id, user_id, team_id, role)
VALUES ('1807e075-7055-4d8c-a097-5ed5d04dc757'::uuid, 'ee42ac49-a5eb-482e-aeb5-49d765d20e36'::uuid, NULL, 'superadmin');
```

#### Opción B: Crear una org “Sistema” para superadmins

Útil si quieres distinguir la org donde “viven” los superadmins:

```sql
WITH sys_org AS (
  INSERT INTO public.organizations (name, slug)
  VALUES ('Sistema', 'sistema')
  ON CONFLICT (slug) DO UPDATE SET name = 'Sistema'  -- por si ya existe
  RETURNING id
)
INSERT INTO public.memberships (org_id, user_id, team_id, role)
SELECT id, 'YOUR_USER_UUID'::uuid, NULL, 'superadmin'
FROM sys_org;
```

### Paso 3: Comprobar

1. Inicia sesión con ese usuario.
2. En **/dashboard/admin** deberías ver la opción de listar **todas** las organizaciones (si `useCurrentOrg` devuelve `isSuperadmin: true`).
3. Desde la app o desde Supabase (con ese usuario vía RLS), podrás crear, editar y eliminar en todas las tablas anteriores según las políticas de la migración `20250125100000_superadmin_full_crud.sql`.

### Notas

- **Un solo membership con `superadmin` basta**: `user_is_superadmin()` comprueba si existe al menos uno. A partir de ahí, `user_org_ids()` devuelve todas las orgs y las políticas permiten el CRUD correspondiente.
- **`audit_log`**: el superadmin solo tiene **SELECT** (el log se considera inmutable; los writes se hacen vía triggers o Edge Functions).
- **`profiles`**: el superadmin tiene INSERT y UPDATE; no se ha definido DELETE por seguridad.
