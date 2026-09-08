neurometrics-frontend/
│
├── src/
│   ├── app/
│   │   ├── app.config.ts          # Configurazione globale (Providers, Interceptors, Client HTTP)
│   │   ├── app.routes.ts          # Mappatura delle rotte protette da AuthGuard
│   │   ├── app.component.ts       # Componente radice (Root) dell'applicazione
│   │   │
│   │   ├── core/                  # Servizi globali, Guardie e Intercettori
│   │   │   ├── guards/
│   │   │   │   └── auth.guard.ts  # Blocca l'accesso ai non autenticati
│   │   │   ├── interceptors/
│   │   │   │   ├── auth.interceptor.ts  # Inietta il Bearer Token JWT
│   │   │   │   └── error.interceptor.ts # Gestisce gli errori di rete (401/403 automatic logout)
│   │   │   └── services/
│   │   │       ├── auth.service.ts      # Stato del login gestito con gli Angular Signals
│   │   │       └── neuro-stats.service.ts # Chiamate API (Submit, History, Csv, PDF)
│   │   │
│   │   └── pages/                 # Componenti dell'interfaccia utente (UI)
│   │       ├── login/
│   │       │   └── login.component.ts   # Form di accesso reattivo per i medici
│   │       │
│   │       ├── dashboard/
│   │       │   └── patient-dashboard.component.ts # Dashboard sdoppiata reattiva con Chart.js
│   │       │
│   │       └── experiments/       # La suite dei test clinici a tempo di precisione
│   │           ├── utils/
│   │           │   └── trial-balancer.ts # Shuffle di Fisher-Yates per bilanciare i trial
│   │           ├── stroop/
│   │           │   └── stroop-game.component.ts # Test di Stroop visivo
│   │           ├── gonogo/
│   │           │   └── gonogo-game.component.ts # Test Go/No-Go con timeout attivo
│   │           └── flanker/
│   │               └── flanker-game.component.ts # Test Flanker visuo-spaziale
│   │
│   ├── assets/                    # File statici (immagini, loghi ospedalieri)
│   ├── styles.css                 # Stili globali dell'applicazione
│   └── experiments-luminance.css  # Fogli di stile CSS calibrati per la psicologia visiva
│
├── package.json
└── tsconfig.json