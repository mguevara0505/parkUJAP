# Despliegue — UJAP Parking

Guía para poner el sistema en un servidor y mantenerlo. Todo lo de aquí está
probado contra la pila real: no son pasos de memoria.

---

## Qué se levanta

| Servicio | Qué hace | Puerto |
|----------|----------|--------|
| `caddy` | HTTPS, certificados y reparto de tráfico | 80, 443 |
| `frontend` | Next.js (pantallas) | interno 3000 |
| `api` | NestJS (REST + Swagger) | interno 3001 |
| `postgres` | Base de datos | interno 5432 |

Solo Caddy publica puertos. La base de datos **no es accesible desde fuera**:
se llega a ella únicamente desde la red interna de Docker.

---

## Requisitos

- Un servidor Linux con Docker y el plugin Compose (`docker compose version`)
- Un nombre de dominio apuntando por DNS a ese servidor
- Puertos 80 y 443 abiertos hacia internet

El 80 hace falta aunque todo vaya por HTTPS: es por donde Let's Encrypt
valida el dominio antes de emitir el certificado.

---

## Primera instalación

### 1. Traer el código

```bash
git clone https://github.com/mguevara0505/parkUJAP.git /opt/ujap-parking
cd /opt/ujap-parking
```

### 2. Configurar

```bash
cp .env.prod.example .env
```

Editar `.env` y rellenar. Los secretos se generan, no se inventan:

```bash
openssl rand -base64 48
```

`JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` deben ser **distintos**. Si se
comparten, un access token robado sirve también para renovar y la expiración
corta de 15 minutos deja de proteger nada.

`PUBLIC_API_URL` se incrusta en el JavaScript del navegador **al construir la
imagen**. Si cambia el dominio más adelante, hay que reconstruir el frontend,
no basta con reiniciarlo.

### 3. Levantar

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Las migraciones se aplican solas al arrancar la API, con `prisma migrate
deploy`: ejecuta lo que ya está escrito y nunca propone cambios de esquema.
Eso es lo que impide que toque los índices parciales y la restricción EXCLUDE
que se escribieron a mano y que **son** las reglas de negocio.

### 4. Crear los datos iniciales

La base arranca vacía. El seed crea el administrador, las 10 zonas y los
~1.000 puestos:

```bash
docker compose -f docker-compose.prod.yml exec api node dist/database/seeds/seed.js
```

> Se ejecuta el JavaScript ya compilado, no `npm run seed`: la imagen de
> producción no lleva ts-node.

### 5. Cambiar la contraseña del administrador

El seed deja `admin@ujap.edu.ve` / `Admin1234!`. **Cambiarla antes de dar la
dirección a nadie**, desde la propia aplicación.

### 6. Comprobar

```bash
curl https://SU-DOMINIO/api/v1/health
```

Debe responder `"status":"ok"` y `"database":{"status":"ok"}`.

---

## Operación diaria

```bash
# Estado de los contenedores
docker compose -f docker-compose.prod.yml ps

# Registros de la API en vivo
docker compose -f docker-compose.prod.yml logs -f api

# Reiniciar solo la API
docker compose -f docker-compose.prod.yml restart api
```

### Actualizar a una versión nueva

```bash
cd /opt/ujap-parking
./scripts/backup.sh                                    # primero el respaldo
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Las migraciones nuevas se aplican al arrancar. Si algo sale mal, el respaldo
del primer paso es la vuelta atrás.

---

## Respaldos

```bash
./scripts/backup.sh
```

Deja un `.sql.gz` en `backups/` y borra los de más de 14 días
(`BACKUP_KEEP_DAYS` para cambiarlo).

El script **comprueba que el volcado esté completo** antes de darlo por bueno:
`pg_dump` puede cortarse a mitad y dejar un archivo comprimido válido pero
truncado. Si la comprobación falla, el archivo se guarda como `.roto` y el
script termina con error, en vez de fingir que hay respaldo.

Automatizarlo con cron, todos los días a las 3 de la madrugada:

```bash
crontab -e
```

```
0 3 * * * cd /opt/ujap-parking && ./scripts/backup.sh >> backups/backup.log 2>&1
```

Los respaldos viven en el mismo servidor. **Copiarlos también fuera**: un
disco que muere se lleva la base y sus respaldos a la vez.

### Restaurar

```bash
./scripts/restore.sh backups/ujap-parking-20260817-030000.sql.gz
```

Para la API, restaura y la vuelve a arrancar. Pide escribir `restaurar` para
continuar, porque reemplaza los datos actuales.

Probado: se borraron los 1.000 puestos y la restauración los devolvió, junto
con los dos índices parciales de sesiones activas y la restricción EXCLUDE de
reservas. Las reglas de negocio viajan dentro del volcado.

> Un respaldo que nadie ha restaurado nunca no es un respaldo. Conviene
> probar la restauración en un servidor de prueba al menos una vez.

---

## Seguridad

Lo que ya viene resuelto:

- **HTTPS obligatorio.** Caddy pide y renueva los certificados solo, y
  redirige el 80 al 443.
- **La base de datos no publica puertos.** Solo se llega desde dentro.
- **Los contenedores no corren como root**, sino como el usuario `node`.
- **Sin pgAdmin.** Está solo en el compose de desarrollo: una consola de base
  de datos abierta a internet no se pone.
- **Límite de login: 10 intentos cada 5 minutos por correo.** Se cuenta por
  correo y no por IP a propósito: la fuerza bruta prueba muchas contraseñas
  contra una misma cuenta, y contar por IP castigaría a toda la universidad,
  que sale por un único NAT.
- **Auditoría de toda escritura**, con contraseñas y tokens guardados como
  `[oculto]`.

Lo que hay que hacer a mano:

- Cambiar la contraseña del administrador del seed.
- Generar secretos JWT propios y distintos entre sí.
- Restringir `CORS_ORIGIN` al dominio real. Nunca `*`: las peticiones van con
  credenciales.
- Mantener `.env` fuera de git (ya está en `.gitignore`) y con permisos
  cerrados: `chmod 600 .env`.

---

## Rendimiento

Objetivos de la sección 46, medidos con 100 usuarios simultáneos
(`npm run test:load`, ver README):

| Medida | Objetivo | Medido (p95) |
|--------|----------|--------------|
| Mapa de ~1.000 puestos | < 500 ms | 411 ms |
| Dashboard | < 1 s | 61 ms |
| Check-in | < 500 ms | 483 ms |

`DATABASE_POOL_SIZE` es la palanca principal si la API se queda corta. Debe
cumplirse:

```
instancias de la API × DATABASE_POOL_SIZE  <  max_connections de PostgreSQL
```

`max_connections` son 100 por defecto. Con el valor de 25 que trae la
plantilla caben tres instancias con margen.

---

## Cuando algo falla

**La API reinicia en bucle.**
`docker compose -f docker-compose.prod.yml logs api`. Lo más común es que
`DATABASE_URL` esté mal o que PostgreSQL todavía no acepte conexiones; la API
espera a que el healthcheck de la base pase, pero un `.env` incompleto no lo
arregla la espera.

**«Credenciales no válidas» de forma intermitente.**
Casi seguro hay dos pilas levantadas en la misma máquina. Los compose de
desarrollo y de producción usan redes y volúmenes con nombres distintos justo
para evitarlo; si se han tocado esos nombres y coinciden, el host `postgres`
resuelve a veces a una base y a veces a la otra. Comprobar con:

```bash
docker network inspect ujap_parking_prod_network --format '{{range .Containers}}{{.Name}} {{end}}'
```

Solo deben aparecer los contenedores de la pila de producción.

**El certificado no se emite.**
El dominio de `DOMAIN` tiene que resolver de verdad a este servidor y el
puerto 80 estar abierto. Para probar sin dominio, `DOMAIN=localhost` hace que
Caddy emita un certificado local.

**Cambié la URL de la API y el frontend sigue llamando a la anterior.**
`PUBLIC_API_URL` se incrusta al construir. Hay que reconstruir:

```bash
docker compose -f docker-compose.prod.yml up -d --build frontend
```
