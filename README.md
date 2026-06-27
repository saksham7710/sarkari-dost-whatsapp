# 🚀 Sarkari Dost - WhatsApp Bot (Deploy Now)

**Deploy in 10 minutes. No code changes needed.**

This is a **standalone server** that runs your Sarkari Dost WhatsApp bot. It does NOT depend on your existing React/Vite frontend or tRPC backend. You can deploy this independently and connect it later.

---

## 📦 What's Included

| File | Purpose |
|------|---------|
| `src/server.js` | **Complete bot server** — 25 schemes, eligibility engine, session management, Meta + Twilio support |
| `package.json` | Dependencies (just Hono + Node server) |
| `.env` | Environment variables template |
| `Dockerfile` | Containerize for any platform |
| `railway-deploy.sh` | One-click deploy to Railway |
| `fly-deploy.sh` | One-click deploy to Fly.io |
| `render-deploy.md` | Step-by-step deploy to Render (free tier) |
| `META_SETUP.md` | Meta WhatsApp Cloud API setup guide |
| `TWILIO_SETUP.md` | Twilio quick setup guide (5 min) |

---

## ⚡ Fastest Deploy: Twilio (5 minutes)

If you want to test **right now** without Meta business verification:

```bash
# 1. Clone/download this folder
cd sarkari-dost-whatsapp-deploy

# 2. Install dependencies
npm install

# 3. Edit .env with Twilio credentials (see TWILIO_SETUP.md)
nano .env

# 4. Start server
npm start

# 5. In another terminal, expose to internet
npx ngrok http 3000

# 6. Copy the ngrok HTTPS URL
# 7. Set Twilio webhook to: YOUR_NGROK_URL/api/whatsapp/twilio-webhook
# 8. Text "HI" to the Twilio sandbox number!
```

---

## 🏭 Production Deploy: Meta Cloud API (15 minutes)

For a real WhatsApp number that anyone can message:

### Step 1: Set Up Meta App
Follow `META_SETUP.md` to:
- Create Meta app
- Get permanent access token
- Add your phone as test number
- Configure webhook

### Step 2: Deploy Server

**Option A: Railway (Easiest)**
```bash
chmod +x railway-deploy.sh
./railway-deploy.sh
```

**Option B: Render (Free)**
Follow steps in `render-deploy.md`

**Option C: Fly.io**
```bash
chmod +x fly-deploy.sh
./fly-deploy.sh
```

**Option D: Any VPS / Docker**
```bash
docker build -t sarkari-dost .
docker run -p 3000:3000 --env-file .env sarkari-dost
```

### Step 3: Test
Text **"HI"** to your WhatsApp number. The bot will ask 6 questions and return matched schemes.

---

## 🧪 Local Testing

```bash
npm install
npm run dev

# In another terminal, test with curl:
curl -X POST http://localhost:3000/api/whatsapp/meta-webhook   -H "Content-Type: application/json"   -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "919876543210",
            "text": { "body": "HI" }
          }]
        }
      }]
    }]
  }'
```

---

## 📋 Bot Commands

| Command | Action |
|---------|--------|
| `HI` / `START` / `HELLO` | Begin eligibility check |
| `RESTART` | Start over from Question 1 |
| `HELP` | Show help message |

---

## 🏗️ Architecture

```
User WhatsApp Message
    ↓
Meta Cloud API / Twilio
    ↓
POST /api/whatsapp/meta-webhook
    ↓
Session Manager (in-memory, auto-cleanup)
    ↓
Flow Engine (6 questions)
    ↓
Eligibility Engine (25 schemes)
    ↓
Match Score Calculator
    ↓
Formatted Results → WhatsApp API Reply
```

---

## 📊 What's Built In

- ✅ 25 real Indian government schemes
- ✅ 9 categories (Agriculture, Health, Housing, Pension, Women, Education, Business, General)
- ✅ Rule-based eligibility scoring (0-100% match)
- ✅ 6-question conversational flow
- ✅ Session persistence (30-min timeout, auto-cleanup)
- ✅ Meta Cloud API support
- ✅ Twilio support (simultaneous)
- ✅ Health check endpoint
- ✅ Error handling & logging
- ✅ No database required (memory store)

---

## 🔗 Connect to Your Existing App Later

When your main app is ready, you can:
1. Replace the in-memory `sessions` Map with your MySQL `whatsappSessions` table
2. Replace the hardcoded `SCHEMES` array with your tRPC `scheme.list` API
3. Move the router into your existing `api/routers/whatsapp.ts`
4. Mount it in your existing `api/boot.ts`

The code structure is identical — just copy-paste when ready.

---

## 💰 Costs

| Platform | Cost |
|----------|------|
| Meta API | Free (1,000 conversations/month), then ~₹0.50-₹4/conversation |
| Twilio | ~$0.005 per message |
| Railway | Free tier, then ~$5/month |
| Render | Free tier, then ~$7/month |
| Fly.io | Free tier, then ~$2/month |
| VPS (DigitalOcean) | $5/month |

---

## 🆘 Need Help?

- **Meta API issues**: See `META_SETUP.md` troubleshooting section
- **Twilio issues**: See `TWILIO_SETUP.md`
- **Deployment issues**: Check server logs with `npm start`
- **Webhook not working**: Make sure your URL is HTTPS and publicly accessible

**Deploy now. Update later.** 🚀
