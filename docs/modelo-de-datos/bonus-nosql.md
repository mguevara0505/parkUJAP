# Bonus: la bitácora de auditoría como documento de MongoDB

## Qué parte elegimos y por qué

Elegimos **`audit_logs`**, la bitácora que registra cada escritura del sistema
(RN-011). Es la tabla que peor encaja en el modelo relacional:

| Síntoma en PostgreSQL | Qué significa |
|---|---|
| `oldValue` y `newValue` ya son `JSONB` | El contenido cambia según lo que se modificó: una reserva, un puesto, un usuario. No hay columnas fijas posibles. |
| `entityId` no tiene FOREIGN KEY | Apunta a una fila de *cualquier* tabla, según `entityType`. Una FK solo puede apuntar a una tabla. |
| Solo se inserta, nunca se actualiza ni se borra | No hay joins ni transacciones con otras tablas que proteger. |
| Es la tabla que más crece | Cada check-in, reserva o cambio de un admin añade una fila. Es la candidata natural a escalar aparte. |
| Para leerla hay que hacer JOIN con `users` | Y si el usuario cambia de nombre, el historial muestra el nombre nuevo, no el que tenía cuando actuó. |

En un documento, cada evento guarda **su propia forma** y una **copia del
actor tal como era en ese momento**, sin joins.

## Colección `audit_logs`

### Ejemplo 1: un administrador cancela una reserva

```json
{
  "_id": { "$oid": "6702a1f4c3e9b2a1d4f0a001" },
  "action": "RESERVATION_CANCEL",
  "entity": {
    "type": "reservations",
    "id": "9b1c7e52-3f4a-4c8e-9d21-7a5e0f3b6c11",
    "label": "Visita proveedor de cafetería — I-004"
  },
  "actor": {
    "userId": "1f0e9d8c-7b6a-4c5d-8e3f-2a1b0c9d8e7f",
    "name": "Ana Pérez",
    "email": "ana.perez@ujap.edu.ve",
    "role": "ADMIN",
    "category": "STAFF"
  },
  "changes": {
    "status": { "from": "CONFIRMED", "to": "CANCELLED" },
    "notes":  { "from": null, "to": "El proveedor reprogramó para el viernes" }
  },
  "request": {
    "method": "POST",
    "path": "/api/v1/reservations/9b1c7e52-3f4a-4c8e-9d21-7a5e0f3b6c11/cancel",
    "ip": "10.20.4.17",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0"
  },
  "createdAt": { "$date": "2026-10-07T14:32:10.512Z" }
}
```

### Ejemplo 2: un estudiante registra dónde dejó el carro

El mismo tipo de documento, con **otra forma**: aquí no hay "antes", y los
datos útiles son el puesto y la zona.

```json
{
  "_id": { "$oid": "6702a2b1c3e9b2a1d4f0a002" },
  "action": "SESSION_CHECK_IN",
  "entity": {
    "type": "parking-sessions",
    "id": "4d2e8a90-6b1c-4f3e-a7d5-0c9b8e7f6a54"
  },
  "actor": {
    "userId": "8a7b6c5d-4e3f-4a1b-9c0d-1e2f3a4b5c6d",
    "name": "Luis Gómez",
    "email": "luis.gomez@ujap.edu.ve",
    "role": "USER",
    "category": "STUDENT"
  },
  "data": {
    "parkingSpace": { "code": "B-117", "zone": "B", "parkingLot": "Principal" },
    "slot": 1,
    "source": "MOBILE",
    "notes": "Cerca de la entrada norte"
  },
  "request": {
    "method": "POST",
    "path": "/api/v1/parking-sessions/check-in",
    "ip": "190.202.31.8",
    "userAgent": "UJAPParking/1.0 (Android 14)"
  },
  "createdAt": { "$date": "2026-10-07T07:05:44.019Z" }
}
```

## Decisiones del modelo

- **`actor` embebido, no referenciado.** Es una foto del usuario en el momento
  de la acción. Si Ana cambia de correo mañana, la bitácora sigue diciendo
  quién actuó *entonces*. Se guarda también `userId` para poder buscar todas
  las acciones de una persona.
- **`changes` solo con lo que cambió** (`from` / `to`) en lugar de dos copias
  completas del registro. Ocupa menos y se lee directo.
- **`entity.type` + `entity.id`** reemplazan la FK imposible: la referencia es
  lógica, como en `audit_logs.entityId` hoy.
- **Las contraseñas nunca entran.** Igual que `AuditService.sanitize()` hoy,
  los campos `password`, `passwordHash`, etc. se ocultan antes de guardar.

## Índices que tendría la colección

```js
db.audit_logs.createIndex({ createdAt: -1 })                    // dashboard: "lo último que pasó"
db.audit_logs.createIndex({ "actor.userId": 1, createdAt: -1 }) // historial de un usuario
db.audit_logs.createIndex({ "entity.type": 1, "entity.id": 1 }) // historial de una reserva o un puesto
db.audit_logs.createIndex(                                      // opcional: borrar a los 2 años
  { createdAt: 1 }, { expireAfterSeconds: 63072000 }
)
```

## Consultas de ejemplo

```js
// Todo lo que le pasó a una reserva, en orden
db.audit_logs.find({ "entity.type": "reservations", "entity.id": "9b1c7e52-..." })
             .sort({ createdAt: 1 })

// Cancelaciones hechas por administradores esta semana
db.audit_logs.find({
  action: "RESERVATION_CANCEL",
  "actor.role": "ADMIN",
  createdAt: { $gte: ISODate("2026-10-05") }
})

// Check-ins por zona (para el dashboard de ocupación)
db.audit_logs.aggregate([
  { $match: { action: "SESSION_CHECK_IN" } },
  { $group: { _id: "$data.parkingSpace.zone", total: { $sum: 1 } } },
  { $sort: { total: -1 } }
])
```

## ¿Y el resto del sistema?

Se queda en PostgreSQL. Sesiones, reservas y puestos **necesitan** lo que da
el modelo relacional: FOREIGN KEY, el índice único parcial que impide dos
carros en el mismo puesto (RN-001) y la restricción `EXCLUDE` que impide
reservas solapadas (RN-006). MongoDB no tiene un equivalente directo de esa
restricción `EXCLUDE`.
