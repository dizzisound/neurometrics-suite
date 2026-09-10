Struttura del progetto `neurometrics-frontend`:

```
neurometrics-frontend/
│
├── src/
│   ├── main.ts                     # Bootstrap dell'applicazione (bootstrapApplication)
│   ├── index.html                  # Pagina host, favicon, tag <app-root>
│   ├── styles.scss                 # Stili globali dell'applicazione
│   ├── proxy.conf.json             # Proxy dev-server: /api -> localhost:3000 (usato solo da DataService)
│   │
│   └── app/
│       ├── app.config.ts           # Configurazione globale (Providers, Interceptors, Client HTTP)
│       ├── app.routes.ts           # Mappatura delle rotte, protette da authGuard
│       ├── app.component.ts        # Componente radice (Root) dell'applicazione
│       │
│       ├── components/             # Componenti UI riutilizzabili, condivisi tra le pagine
│       │   ├── navbar.component.ts       # Barra di navigazione; mostra utente e ruolo autenticato
│       │   └── trend-chart/
│       │       └── trend-chart.component.ts # Grafico SVG di andamento longitudinale (linea + area)
│       │
│       ├── core/                   # Servizi globali, guardie e intercettori
│       │   ├── guards/
│       │   │   └── auth.guard.ts              # Blocca l'accesso ai non autenticati
│       │   ├── interceptors/
│       │   │   ├── auth.interceptor.ts        # Inietta il Bearer Token JWT
│       │   │   ├── error.interceptor.ts       # Gestisce gli errori di rete (401/403 -> logout automatico)
│       │   │   └── global-error-handler.ts    # ErrorHandler globale per eccezioni non gestite
│       │   └── services/
│       │       ├── auth.service.ts             # Stato del login gestito con gli Angular Signals
│       │       ├── patient-context.service.ts  # Paziente selezionato e paradigma attivo, condivisi tra dashboard e test
│       │       ├── neuro-stats.service.ts       # Chiamate API (Submit, History, Csv, PDF)
│       │       └── data.service.ts              # Verifica di connessione al backend (endpoint demo /api/test)
│       │
│       └── pages/                  # Componenti dell'interfaccia utente (UI)
│           ├── login/
│           │   └── login.component.ts          # Form di accesso reattivo per i medici
│           ├── register/
│           │   └── register.component.ts       # Form di registrazione nuovo account clinico
│           │
│           ├── dashboard/
│           │   └── patient-dashboard.component.ts # Pannello longitudinale: grafici, badge Z-Score, esportazioni
│           │
│           └── experiments/        # La suite dei test clinici a tempo di precisione
│               ├── utils/
│               │   └── trial-balancer.ts          # Shuffle di Fisher-Yates per bilanciare i trial
│               ├── stroop/
│               │   └── stroop-game.component.ts   # Test di Stroop visivo
│               ├── gonogo/
│               │   └── gonogo-game.component.ts   # Test Go/No-Go con timeout attivo
│               └── flanker/
│                   └── flanker-game.component.ts  # Test Flanker visuo-spaziale
│
├── public/
│   └── favicon.ico
├── package.json
└── tsconfig.json
```

Note:
- Ogni componente elencato ha in realtà un `.html` affiancato (`templateUrl`) — qui è indicato solo il `.ts` per brevità. `app.component`, `navbar.component`, `trend-chart.component`, `patient-dashboard.component` e `stroop-game.component` hanno anche un `.scss` dedicato (`styleUrl`); gli altri (login, register, gonogo, flanker) non ne hanno uno proprio e usano solo stili inline nel template.
- `trial-balancer.ts` e `stroop-game.component.ts` hanno anche i rispettivi `.spec.ts`.
- Vedi `CLAUDE.md` per le gotcha operative (comandi, zoneless/Signals, contesto paziente condiviso).
