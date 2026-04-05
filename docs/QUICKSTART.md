# Quickstart

Get from zero to your first MPP32 oracle query in under five minutes.

---

## Prerequisites

- [Bun](https://bun.sh) v1.0 or later
- Git

---

## 1. Clone the repo

```bash
git clone https://github.com/MPP32/MPP32.git
cd MPP32
```

---

## 2. Set up the backend

```bash
cd backend
bun install
cp .env.example .env
```

Open `.env` and fill in any values you want to customize. For local development the defaults work without modification — the demo endpoint requires no payment configuration.

Start the server:

```bash
bun run dev
```

You should see:

```
✅ Environment variables validated successfully
Started development server: http://localhost:3000
```

---

## 3. Set up the frontend

Open a new terminal:

```bash
cd webapp
bun install
bun run dev
```

The frontend starts on **http://localhost:8000**.

---

## 4. Run your first query

**Via the Playground**

Open [http://localhost:8000/playground](http://localhost:8000/playground), type a ticker or paste a Solana contract address, and click **Run Query**.

**Via cURL**

```bash
curl -X POST http://localhost:3000/api/intelligence/demo \
  -H "Content-Type: application/json" \
  -d '{ "token": "BONK" }'
```

You will get back an 8-dimensional intelligence response in under two seconds.

---

## 5. Key files to explore

| File | Purpose |
|------|---------|
| `backend/src/types.ts` | All Zod schemas — start here to understand data shapes |
| `backend/src/index.ts` | Route registration and middleware setup |
| `webapp/src/App.tsx` | Frontend routing |
| `webapp/src/pages/Playground.tsx` | Live query terminal |
| `webapp/src/pages/Dashboard.tsx` | Query history and stats |

---

## Next steps

- [API Reference](API.md) — Full endpoint and response documentation
- [Architecture](ARCHITECTURE.md) — How the oracle pipeline works end to end
- [mpp32.org/build](https://mpp32.org/build) — List your own MPP service in the ecosystem