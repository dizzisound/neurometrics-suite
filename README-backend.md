neurometrics-backend/
│
├── src/
│   ├── config/
│   │   └── env.config.ts          # Validazione Zod e caricamento di .env
│   │
│   ├── database/
│   │   ├── connect.ts             # Logica di connessione a MongoDB
│   │   └── models/
│   │       ├── user.schema.ts     # Schema Mongoose Utente Clinico
│   │       └── session.schema.ts  # Schema Mongoose Sessioni (Stroop, Flanker, GoNoGo)
│   │
│   ├── middlewares/
│   │   ├── auth.middleware.ts     # Verifica e decodifica del Token JWT
│   │   └── validate.middleware.ts # Intercettore Zod per validazione payload in ingresso
│   │
│   ├── modules/                   # Suddivisione per Domini Logici (Business Logic)
│   │   ├── auth/
│   │   │   └── auth.controller.ts # Login e Registrazione clinici
│   │   │
│   │   └── sessions/
│   │       ├── sessions.controller.ts # Endpoint POST, GET storiche e download
│   │       ├── session.validator.ts   # Schemi Zod (CreateSessionValidationSchema)
│   │       ├── data-cleaner.ts        # Pipeline statistica avanzata (Filtro MAD)
│   │       └── exgaussian.ts          # Algoritmo calcolo dei momenti (μ, σ, τ) scritto da zero
│   │
│   ├── utils/
│   │   └── pdf-generator.ts       # Routine PDFKit per l'esportazione del report clinico
│   │
│   ├── app.ts                     # Inizializzazione Express e aggregazione rotte
│   └── seed.ts                    # Script per popolare il DB con dati longitudinali finti
│
├── .env                           # Variabili d'ambiente reali (escluso da Git)
├── .env.example                   # File di esempio per il team (tracciato su Git)
├── .gitignore                     # Ignora node_modules, .env e i PDF generati temporaneamente
├── package.json
└── tsconfig.json                  # Configurazione del compilatore TypeScript


