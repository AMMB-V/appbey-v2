# AppBey — Plataforma Competitiva de Torneos Beyblade X (Web & Mobile PWA)

AppBey es la nueva generación de software diseñada para la comunidad competitiva de **Beyblade X** (y formatos compatibles). Reemplaza arquitecturas pesadas con un backend ultrarrápido en **FastAPI (Python)**, persistencia relacional con **SQLite WAL / PostgreSQL Ready**, sincronización en tiempo real vía **WebSockets**, y una aplicación frontend **PWA offline-first** descargable en dispositivos móviles (iOS y Android).

---

## 🚀 Características Principales

1. **Frontend PWA Ultraligero & Móvil**:
   - Carga inicial en `<200ms` (pesando menos de 180KB en comparación con los 25MB de Flutter Web).
   - Compatible e instalable como aplicación nativa en iOS (Safari "Añadir a pantalla de inicio") y Android (WebAPK).
   - Soporte **Offline-First** con Service Worker para operar mesas de arbitraje sin interrupciones si falla el Wi-Fi del recinto.

2. **Motor Oficial de Torneos Beyblade X**:
   - **Sistema Suizo WBO**: Emparejamientos automáticos evitando repeticiones, gestión de Byes y desempates con Buchholz y Sonneborn-Berger.
   - **Eliminación Directa (Single Elimination)**: Generación dinámica de brackets y progresión automática.
   - **Formato Oficial 3on3 Deck (4 Puntos)** y **1on1 Tradicional (3 Puntos)**.

3. **Mesa de Arbitraje Táctil (Referee Scorekeeper)**:
   - Panel de 1-toque optimizado para celulares:
     - **Spin Finish (+1 pt)**
     - **Over Finish (+2 pts)**
     - **Burst Finish (+2 pts)**
     - **Xtreme Finish (+3 pts)**
     - **Penalizaciones y Faltas**
   - Transmisión instantánea del marcador por WebSocket a espectadores y pantalla gigante.

4. **Modo Proyector TV / Pantalla de Estadio (Stadium Display)**:
   - Vista a pantalla completa para televisores y proyectores en el torneo.
   - Llamados en tiempo real a mesas: *"MESA 1: Jan Kraft vs Ryu Kusanagi — EN COMBATE"*.
   - Marcador en vivo y resultados recientes sin necesidad de recargar la página.

5. **Beyblade X Deck Builder 3-on-3**:
   - Catálogo oficial Takara Tomy de piezas (Blades: Phoenix Wing, Wizard Rod, Dran Buster; Ratchets: 9-60, 5-60, 5-70; Bits: Gear Flat, Disc Ball, Ball, Point, Hexa).
   - Cálculo dinámico de peso combinado (gramos) y balance de estadísticas (Ataque, Defensa, Resistencia, Xtreme Dash).
   - Validador estricto de la regla de no duplicación de piezas de la WBO.

6. **Economía de AP Coins & Billetera Virtual**:
   - Bono de registro (+250 AP) y recompensas diarias de entrenamiento (+50 AP).
   - Pago de inscripciones a torneos y distribución automática del pozo de premios (60% al 1er lugar, 25% al 2do, 15% al 3ro).
   - Transferencias entre Bladers con historial de transacciones auditable.

7. **Meta Tier List & Rankings Elo**:
   - Clasificación por Tiers (S, A, B, C) de piezas competitivas.
   - Tabla global de Bladers con cálculo dinámico de Elo ($K=32$) tras cada partida oficial.
   - Salón de la Fama histórico con combos ganadores de torneos pasados.

---

## 🛠️ Estructura del Proyecto

```
appbey_v2/
├── backend/
│   ├── app/
│   │   ├── config.py              # Configuraciones, paths y claves JWT
│   │   ├── database.py            # Motor SQLAlchemy con PRAGMA WAL
│   │   ├── main.py                # Entrada FastAPI, CORS, WebSockets y estáticos
│   │   ├── models/                # Modelos ORM (User, Tournament, Match, Part, Deck, Wallet, etc.)
│   │   ├── schemas/               # Validadores Pydantic v2
│   │   ├── services/              # Lógica de negocio (Torneos, Elo, Arbitraje, AP Coins, Seed)
│   │   └── routers/               # Endpoints REST (/api/v1/...) y WebSockets
├── frontend/
│   ├── index.html                 # Shell SPA con tema Cyber Beyblade
│   ├── manifest.json              # Manifiesto PWA para instalación móvil
│   ├── sw.js                      # Service Worker para caché y modo offline
│   ├── css/styles.css             # Estilos y efectos Neón Xtreme Dash
│   └── js/
│       ├── api.js                 # Cliente REST con inyección de JWT
│       ├── ws.js                  # Hub de WebSockets con reconexión automática
│       ├── app.js                 # Enrutador cliente SPA
│       └── views/                 # Vistas (Home, Torneos, Árbitro, TV, Decks, TierList, Rankings, Wallet, etc.)
├── tests/
│   ├── test_tournament_engine.py  # Tests unitarios de emparejamientos y puntuación
│   └── test_api.py                # Tests de integración de endpoints REST
└── README.md
```

---

## ⚡ Cómo Ejecutar la Plataforma

### 1. Iniciar el Servidor Backend & Servir la App
Desde la carpeta raíz del proyecto (`appbey_v2`):
```bash
python backend/app/main.py
```
O usando Uvicorn:
```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

La aplicación web estará disponible en: **`http://localhost:8000`**  
La documentación interactiva de la API estará en: **`http://localhost:8000/docs`**

---

## 👤 Cuentas de Acceso para Pruebas

| Rol | Usuario / Email | Contraseña | Propósito |
|---|---|---|---|
| **Admin Principal** | `byjankraftyt@gmail.com` | `123456` | Administrador general de AppBey y creador de torneos |
| **Organizador** | `organizer@appbey.app` | `123456` | Creación de torneos, inicio de rondas y gestión |
| **Árbitro Oficial** | `referee@appbey.app` | `123456` | Marcador táctil de mesa en vivo |
| **Blader Pro** | `ryu@appbey.app` | `123456` | Jugador competitivo (Shark Edge 3-60 LF) |

---

## 🧪 Ejecutar Tests Automatizados

```bash
# Test del motor de torneos y reglas Beyblade X
python tests/test_tournament_engine.py

# Test de endpoints de autenticación, torneos, billetera y rankings
python tests/test_api.py
```
