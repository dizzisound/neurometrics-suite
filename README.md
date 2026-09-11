# NeuroMetrics Suite

Batteria di test cognitivi digitali (Stroop, Go/No-Go, Flanker) con analisi dei tempi di reazione, confronto con una popolazione di controllo e generazione di report clinici in PDF.

> **Nota**: i dati normativi usati per il confronto con la popolazione di controllo sono **valori segnaposto**, non norme cliniche validate (vedi `backend/src/seed.ts`). Questo progetto non è pronto per un uso clinico reale.

## Struttura del progetto

Due progetti Node indipendenti in un'unica repository (non un monorepo con tooling dedicato):

- [`backend/`](backend/) — API Express 5 + TypeScript + MongoDB/Mongoose. Dettagli: [README-backend.md](README-backend.md).
- [`frontend/`](frontend/) — App Angular 22 (zoneless, Signals). Dettagli: [README-frontend.md](README-frontend.md).

Chi lavora sul codice con Claude Code (o vuole capire le convenzioni e le insidie del progetto) dovrebbe leggere [CLAUDE.md](CLAUDE.md).

## Avvio rapido

Richiede una versione recente di Node — Node 20 **non** funziona, né per il backend (vitest 5) né per il frontend (Angular CLI 22 si rifiuta di partire); vedi la sezione CI di [CLAUDE.md](CLAUDE.md) per i vincoli esatti — e un'istanza MongoDB raggiungibile (locale o remota).

```bash
# Backend
cd backend
npm install
cp .env.example .env   # poi compila i valori reali (MongoDB, JWT secret, ...)
npm run seed            # popola il DB con dati e account di prova
npm run dev              # dev server su :3000

# Frontend (in un altro terminale)
cd frontend
npm install
npm start                # dev server su :4200
```

In alternativa, dopo aver installato le dipendenze in entrambe le cartelle, `npm run start-all` dalla radice avvia entrambi i server insieme (usa `concurrently`).

### Account di prova

`npm run seed` (in `backend/`) crea tre account, tutti con password `password123`:

| Username | Ruolo | Accesso |
|---|---|---|
| `dott.rossi` | CLINICIAN | Solo i propri pazienti |
| `dott.bianchi` | RESEARCHER | Sola lettura, tutti i pazienti, dati de-identificati |
| `admin.verdi` | ADMIN | Illimitato |

## Test e qualità

Ogni progetto ha i propri comandi (`npm run build`/`test`/`lint`) — vedi [CLAUDE.md](CLAUDE.md) per l'elenco completo, incluso come lanciare un singolo test. La pipeline CI (`.github/workflows/ci-quality-gate.yml`) esegue i test di entrambi i progetti su ogni push/PR verso `main`/`dev`.

## Licenza

ISC (vedi `package.json`).
