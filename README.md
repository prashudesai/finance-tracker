# Finance Tracker

Family income, expenses, loans, investments and retirement accounts in an offline-capable web app, with owner, editor and viewer roles.

The app is being rewritten in React, TypeScript and Firebase. New work is in [app/](app/). The older app in this repository stays as a reference until the rewrite reaches parity.

## Try it

Node 22 or later is required.

```bash
cd app
```

```bash
npm install --ignore-scripts
```

```bash
npm run dev:preview
```

Open http://localhost:5173. This uses sample data held in memory, so you don't need Firebase or a sign-in.

## Documentation

- [CLAUDE.md](CLAUDE.md): working rules and commands
- [docs/architecture.md](docs/architecture.md): how the app is built and why
- [docs/data-model.md](docs/data-model.md): what is stored in Firestore
- [docs/rewrite-status.md](docs/rewrite-status.md): what is done and what remains
- [docs/legacy/](docs/legacy/README.md): behaviour specs and notes from the older app
