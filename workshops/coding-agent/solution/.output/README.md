# Todo App

A full-stack Todo application with a React frontend and Express backend.

## Prerequisites

- Node.js (v16 or higher)
- npm

## Installation

```bash
npm run install-all
```

This installs dependencies for both the root project (backend) and the client (frontend).

## Running the App

```bash
npm run dev
```

This starts both the backend and frontend concurrently:

- **Backend (API):** http://localhost:3001
- **Frontend (React):** http://localhost:3000

The React dev server proxies API requests to the backend on port 3001.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start both backend and frontend |
| `npm run server` | Start only the backend |
| `npm run client` | Start only the frontend |
| `npm run install-all` | Install all dependencies |
