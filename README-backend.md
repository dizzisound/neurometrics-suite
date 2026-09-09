Struttura del progetto `neurometrics-backend`:

```
neurometrics-backend/
│
├── src/
│   ├── config/
│   │   └── env.config.ts              # Validazione Zod e caricamento di .env
│   │
│   ├── database/
│   │   ├── connect.ts                 # Logica di connessione a MongoDB
│   │   └── models/
│   │       ├── user.schema.ts         # Schema Mongoose Utente Clinico
│   │       ├── patient.schema.ts      # Schema Mongoose Paziente
│   │       ├── session.schema.ts      # Schema Mongoose Trial e Sessioni (Stroop, Flanker, Go/No-Go)
│   │       └── normative.schema.ts    # Schema Mongoose dati normativi (popolazione di controllo)
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts         # verifyJwt: verifica e decodifica del Token JWT
│   │   └── validate.middleware.ts     # Intercettore Zod per la validazione dei payload in ingresso
│   │
│   ├── modules/                       # Suddivisione per domini logici (business logic)
│   │   ├── auth/
│   │   │   └── auth.routes.ts         # POST /auth/register, POST /auth/login
│   │   │
│   │   └── sessions/
│   │       ├── sessions.routes.ts     # Pazienti e sessioni: CRUD, storico, CSV, authorizePatientAccess
│   │       ├── session.validator.ts   # Schema Zod (CreateSessionValidationSchema)
│   │       ├── patient.validator.ts   # Schema Zod (CreatePatientValidationSchema)
│   │       ├── data-cleaner.ts        # Pipeline statistica avanzata (filtro MAD)
│   │       └── exgaussian.ts          # Stima dei momenti Ex-Gaussiani (μ, σ, τ), scritta da zero
│   │
│   ├── utils/
│   │   ├── pdf-generator.ts           # Routine PDFKit per il report clinico (incl. confronto Z-Score)
│   │   └── zscore.helper.ts           # computeClinicalZScore: confronto con la popolazione di controllo
│   │
│   ├── app.ts                         # Inizializzazione Express e aggregazione delle rotte
│   └── seed.ts                        # Popola il DB con utente/paziente/sessioni demo e norme placeholder
│
├── .env                                # Variabili d'ambiente reali (escluso da Git)
├── .env.example                        # File di esempio per il team (tracciato su Git)
├── .gitignore                          # Ignora node_modules, .env, dist/ e i PDF generati temporaneamente
├── eslint.config.js                    # Configurazione ESLint (flat config)
├── package.json
└── tsconfig.json                       # Configurazione del compilatore TypeScript
```

Nota: `auth.routes.ts` e `sessions.routes.ts` erano in precedenza `auth.controller.ts`/`sessions.controller.ts` — rinominati perché espongono direttamente un `Router()` con le rotte, non una classe controller. Vedi `CLAUDE.md` per le gotcha operative (comandi, convenzioni Mongoose, dual TS6/TS7).
