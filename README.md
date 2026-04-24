# BFHL Tree Engine — SRM Full Stack Challenge

A REST API + frontend that processes hierarchical node relationships.

## Setup

```bash
npm install
npm start
```

Server runs at http://localhost:3000

## API

**POST /bfhl**

```json
{ "data": ["A->B", "A->C", "B->D", "X->Y", "Y->Z", "Z->X", "hello"] }
```

## Deploy

1. Push this repo to GitHub (public)
2. Go to https://render.com → New Web Service → connect your repo
3. Build command: `npm install`
4. Start command: `node index.js`
5. Done — your URL is `https://your-app.onrender.com`
