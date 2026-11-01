# Personal Finance Tracker

Family income, expenses, loans, investments and retirement accounts in an installable, offline-capable web app, with owner, editor and viewer roles.

Live at https://finance-trackerp.web.app. Built with React, TypeScript, Vite and Firebase.

## Run it

Node 22 or later is required.

```bash
npm install --ignore-scripts
```

```bash
npm run dev:preview
```

Open http://localhost:5173. This uses sample data held in memory, so you don't need Firebase or a sign-in.

## Check it

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm test
```

```bash
npm run test:rules
```

`test:rules` runs on the Firestore emulator and needs Java 17 or later.

## Deploy it

Nothing deploys automatically. This builds and deploys the app and its security rules:

```bash
npm run build && npx firebase deploy --only firestore:rules,hosting --project finance-trackerp
```

## Documentation

- [CLAUDE.md](CLAUDE.md): working rules
- [docs/architecture.md](docs/architecture.md): how the app is built and why
- [docs/data-model.md](docs/data-model.md): what is stored in Firestore
- [docs/encryption.md](docs/encryption.md): how records are encrypted
- [docs/rewrite-status.md](docs/rewrite-status.md): what changed from the older app, and what's left
