# AppBey — Plataforma Competitiva Oficial Beyblade X (Web & Mobile PWA)

AppBey es la plataforma integral de software de alto rendimiento diseñada para la organización, arbitraje y gestión de torneos competitivos de **Beyblade X**. Desarrollada con un backend ágil en **Node.js / Express / TypeScript**, frontend **PWA offline-first** responsivo, sincronización instantánea vía **WebSockets**, y desplegada 24/7 en la nube en **Render.com**.

- 🌐 **Sitio Web Oficial en Producción:** [https://appbey-v2.onrender.com/](https://appbey-v2.onrender.com/)
- 📦 **Repositorio GitHub:** [https://github.com/AMMB-V/appbey-v2](https://github.com/AMMB-V/appbey-v2)

---

## 🏆 Motor de Torneos y Compatibilidad Challonge

AppBey ofrece una suite completa inspirada en las mejores mecánicas de **Challonge** y las normativas internacionales de la **World Beyblade Organization (WBO)**:

1. **Fase de Grupos + Eliminación Directa (Estilo Challonge)**:
   - Distribución de participantes mediante **Siembra en Serpentina (Serpentine Seeding)**: 1º al Grupo A, 2º al Grupo B, 3º al Grupo B, 4º al Grupo A...
   - Tablas de posiciones en vivo con criterios oficiales de desempate: Puntos (3V-1E) &rarr; Diferencia de Puntos &rarr; Puntos a favor &rarr; Seed inicial.
   - Generación automática de cruces de Playoffs (16vos, 8vos, Cuartos, Semifinales y Gran Final).
2. **Eliminación Directa y Sistema Suizo Oficial**:
   - Árbol de llaves interactivo con avance dinámico de ganadores.
   - Emparejamientos Suizos evitando combates repetidos y cálculo automático de Buchholz.
3. **Gestión de Participantes en Torneo Real**:
   - Inscripción de Bladers registrados y Bladers invitados (Walk-in bladers) en el día del evento.
   - Registro y edición de Deck oficial 3on3 por Blader.
   - Barajado aleatorio de siembras (**Challonge Shuffle Seeds**).
   - Check-in individual o masivo.
   - Retiro/Remoción de participantes antes del inicio.
4. **Mesa de Arbitraje Táctil & Marcador BeyScore**:
   - Panel de 1-toque optimizado para smartphones y tablets:
     - **Spin Finish (+1 pt)**
     - **Over Finish (+2 pts)**
     - **Burst Finish (+2 pts)**
     - **Xtreme Finish (+3 pts)**
     - **Faltas y Penalizaciones (+1 pt al oponente)**
     - **Empate / Draw (0 pts)**
   - Deshacer última jugada (**Undo**), reinicio de marcador y reanudación de combates cerrados por error.
   - Selección de meta de puntos (4 puntos estándar, 5 o 7 en finales).
5. **Pantalla de Estadio / Proyector TV (Stadium Display)**:
   - Pantalla completa en vivo para proyector o pantalla gigante en el recinto.
   - Convocatoria en tiempo real a mesas de combate ("Mesa #1: Yorch vs Woonka — EN COMBATE").
   - Transmisión en tiempo real vía WebSockets sin recargar página.

---

## 📊 Base de Datos Real & Rankings Temporada #1 y #2

AppBey cuenta con la base de datos oficial del Ranking Nacional Individual (Asociación Panameña de Beyblade):
- **Temporada 1 (Histórica y Oficial)**: 96 Bladers registrados con su puntaje acumulado, victorias, derrotas, porcentaje de winrate y podio nacional:
  - 🥇 **#1 Yorch** (Campeón Nacional)
  - 🥈 **#2 Woonka** (2do Lugar)
  - 🥉 **#3 Kanghy** (3er Lugar)
- **Temporada 2 (Nueva Temporada Activa)**: Sistema de ranking por Elo competitivo ($K=32$) con base inicial de 1500 Elo.
- **Salón de la Fama**: Registro histórico de campeones y combos insignia.

---

## 🛡️ Control de Roles y Seguridad (RBAC)

- **Blader**: Rol por defecto al registrarse (los nuevos usuarios solo pueden registrarse como Bladers).
- **Árbitro (Referee)**: Asignación a mesas de combate y control del marcador táctil en vivo.
- **Organizador (Organizer)**: Creación de torneos, inicio de grupos, avance de llaves y gestión de inscripciones.
- **Administrador (Admin)**: Acceso total al panel de administración para nombrar árbitros, organizadores, ascender admins y gestionar el estado de los usuarios.

---

## 🛠️ Estructura del Proyecto

```
appbey_v2/
├── server.ts                      # Servidor backend Express + WebSockets + Motor de Torneos
├── package.json                   # Dependencias Node.js y scripts de compilación
├── tsconfig.json                  # Configuración TypeScript
├── Dockerfile                     # Contenedor de producción para Render.com (Node 20 Alpine)
├── frontend/                      # Frontend PWA SPA (Carga rápida <150ms)
│   ├── index.html                 # Shell principal con tema Cyber Beyblade
│   ├── manifest.json              # Manifiesto PWA para instalación en Android e iOS
│   ├── sw.js                      # Service Worker con soporte offline y caché v2.1
│   ├── assets/
│   │   ├── icons/                 # Favicon e iconos PWA oficiales
│   │   └── images/                # Logo oficial AppBey y recursos gráficos
│   ├── css/
│   │   └── styles.css             # Estilos y efectos Neón Xtreme Stadium
│   └── js/
│       ├── api.js                 # Cliente REST con gestión de JWT
│       ├── ws.js                  # Hub de WebSockets con reconexión activa
│       ├── components.js          # Componentes globales (RenderAvatar, Toasts, Confirm)
│       ├── app.js                 # Enrutador cliente SPA
│       └── views/                 # Vistas modulares:
│           ├── home.js            # Portada y accesos rápidos
│           ├── tournaments.js     # Explorador y creador de torneos
│           ├── tournament_detail.js # Brackets, grupos Challonge y participantes
│           ├── referee_pad.js     # Marcador táctil WBO BeyScore
│           ├── stadium_display.js # Proyector TV para estadios
│           ├── deck_builder.js    # Constructor de Decks 3on3
│           ├── tier_list.js       # Meta Tier List de piezas
│           ├── rankings.js        # Tablas de clasificación T1 y T2
│           ├── hall_of_fame.js    # Salón de la Fama
│           ├── wallet.js          # Billetera virtual AP Coins
│           ├── social.js          # Muro de la comunidad
│           ├── profile.js         # Perfil y combo insignia
│           ├── admin_users.js     # Panel de gestión de usuarios y roles
│           └── auth.js            # Registro e inicio de sesión
└── README.md
```

---

## ⚡ Ejecución Local

### Requisitos
- Node.js 18+ o 20+
- npm o bun

```bash
# 1. Instalar dependencias
npm install

# 2. Ejecutar en modo desarrollo
npm run dev

# 3. Compilar para producción
npm run build

# 4. Iniciar servidor de producción
npm start
```
La plataforma estará disponible en: `http://localhost:3000`

Health checks disponibles:
- `GET /healthz` confirma que el proceso responde.
- `GET /readyz` confirma que el proceso está listo para recibir tráfico (ruta recomendada para Render).
- `GET /api/health` mantiene compatibilidad con clientes existentes.

Configura el Health Check Path de Render como `/readyz`: así el deploy no se
marca listo hasta que PostgreSQL terminó de cargar y aplicar la migración.

---

## 👤 Configuración inicial de producción

La aplicación conserva los usuarios y rankings oficiales precargados. En
producción no crea el torneo de prueba ni sus resultados. Las cuentas
precargadas pueden cambiar su contraseña desde su perfil. Para habilitar el
primer administrador configurable, usa:

- `APPBEY_DEMO_DATA=false`
- `APPBEY_ADMIN_EMAIL=correo-de-la-organizacion`
- `APPBEY_ADMIN_PASSWORD=una-clave-de-12-o-mas-caracteres`
- `APPBEY_ADMIN_COUNTRY=PA`
- `APPBEY_ADMIN_NAME=Nombre visible del administrador`
- `DATABASE_URL=URL privada de PostgreSQL`

Cuando se configuran `APPBEY_ADMIN_EMAIL` y `APPBEY_ADMIN_PASSWORD`, el arranque
crea o eleva esa cuenta a `admin` de forma idempotente. Configúralas como
variables protegidas en Render; nunca las escribas en el repositorio.

`APPBEY_DEMO_DATA=true` solo debe usarse en desarrollo o demostraciones. No se
deben publicar ni reutilizar credenciales de demostración.

Con `DATABASE_URL` configurada, AppBey migra automáticamente el estado anterior
de `appbey_state` a tablas PostgreSQL separadas y luego lee/escribe los cambios
en esas tablas. La migración se registra en `appbey_schema_migrations` y es
idempotente; no vuelve a importar el snapshot anterior después de completarse.
La tabla `appbey_state` se conserva como copia del estado previo a la migración,
pero deja de ser la fuente activa de datos.

Las tablas principales incluyen `appbey_users`, `appbey_tournaments`,
`appbey_tournament_participants`, `appbey_matches` y `appbey_match_games`.
También se migran wallets, transacciones, partes, decks, temporadas, rankings,
Hall of Fame, publicaciones, likes, comentarios y notificaciones. Los torneos
contienen los datos de evento que maneja actualmente la app (fecha, sede,
dirección y país); hoy no existe un modelo independiente de eventos. Las tablas
exponen columnas de búsqueda para sus campos principales y conservan el objeto
completo de cada registro en `payload` para no perder propiedades que el API ya
utiliza.

Al actualizar una fila desde la aplicación, los cambios se escriben de forma
transaccional en PostgreSQL; el proceso vuelve a cargar las filas relacionales
en cada arranque. `/healthz` indica que el proceso está vivo y `/readyz` que la
carga de la base de datos terminó. Si `DATABASE_URL` no está configurada, el
backend usa memoria y los cambios se pierden al reiniciar. La URL debe
mantenerse como secreto de Render y nunca entrar al repositorio.

Para verificar los datos desde Neon SQL Editor:

```sql
SELECT id, username, display_name, role, elo_rating
FROM appbey_users
ORDER BY id;

SELECT id, title, status, start_date, venue_name, country
FROM appbey_tournaments
ORDER BY start_date DESC;

SELECT id, tournament_id, user_id, seed, group_id, checked_in
FROM appbey_tournament_participants
ORDER BY tournament_id, seed;
```

---

## 🚀 Despliegue Continuo en Render.com

El proyecto está configurado con **Continuous Deployment** conectado a la rama `main` del repositorio de GitHub:
- Cada `push` a `main` desencadena la construcción automática del contenedor Docker en Render.
- Las variables de entorno recomendadas en Render son:
  - `PORT=3000`
  - `NODE_ENV=production`
  - `JWT_SECRET=(tu_clave_secreta)`
  - `ALLOWED_ORIGINS=https://appbey-v2.onrender.com`
  - `GOOGLE_CLIENT_ID=(Web client ID de Google; opcional)`
  - `APPBEY_DEMO_DATA=false`
  - `APPBEY_ADMIN_EMAIL=(correo inicial de la organización)`
  - `APPBEY_ADMIN_PASSWORD=(mínimo 12 caracteres)`

`SECRET_KEY` es la variable recomendada para Render. Si no está configurada, el
servidor puede arrancar usando un secreto temporal, pero los JWT se invalidarán
cuando Render reinicie el servicio. Genera una clave con un gestor de secretos
y guárdala como variable protegida en Render.

Cuando `GOOGLE_CLIENT_ID` está configurado, el formulario muestra Google Sign-In. El
servidor valida cada `id_token` con Google antes de crear o vincular la cuenta.

El shell SPA se sirve con `Cache-Control: no-cache`, mientras que los assets estáticos usan caché con ETag y expiración corta. Esto evita que un despliegue deje el HTML apuntando a recursos antiguos.
