# Todo App

A simple todo application with a React frontend and Express backend.

## Prerequisites

- Node.js >= 18
- npm

## Install

```bash
# Install all dependencies (root + client)
npm run install:all
```

## Run

```bash
# Start both server and client
npm run dev
```

Or run them separately:

```bash
# Terminal 1 — API server on :3001
npm run server

# Terminal 2 — Vite dev server on :5173
npm run client
```

## Stack

- **Backend**: Express (Node.js) on port 3001 — in-memory todo store
- **Frontend**: React + Vite on port 5173 — proxies `/todos` to the backend
