import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const WHATSAPP_API_VERSION = 'v18.0';
const WHATSAPP_API_BASE = `https://graph.facebook.com/${WHATSAPP_API_VERSION}`;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

const sessions = new Map();

// ═══════════════════════════════════════════════════════════════
// LOAD SCHEMES FROM JSON
// ═══════════════════════════════════════════════════════════════

let SCHEMES = [];
try {
  const schemesData = readFileSync(join(__dirname, '../public/schemes.json'), 'utf-8');
  SCHEMES = JSON.parse(schemesData);
  console.log(`📚 Loaded ${SCHEMES.length} schemes from JSON`);
} catch (e) {
  console.error('❌ Failed to load schemes.json:', e.message);
  // Fallback to empty array - bot will still work but return no schemes
  SCHEMES = [];
}

// ═══════════════════════════════════════════════════════════════
// CONVERSATION FLOW
// ═══════════════════════════════════════════════════════════════

const FLOW = [
  {
    key: 'age',
    question: `👋 *Namaste!* I am *Sarkari Dost*, your government scheme assistant.\n\nI will ask you 6 simple questions to find schemes you qualify for.\n\n*Question 1/6:* What is your age?\n(Reply with a number, e.g., 35)`,
    validate: (v) => { const n = parseInt(v); return !isNaN(n) && n >= 18 && n <= 120; },
    transform: (v) => parseInt(v),
    error: '❌ Please enter a valid age between 18 and 120.',
  },
  {
    key: 'occupation',
    question: `*Question 2/6:* What is your occupation?\n\n1️⃣ Farmer\n2️⃣ Student\n3️⃣ Salaried (Govt/Private job)\n4️⃣ Self-employed\n5️⃣ Unemployed\n6️⃣ Homemaker\n\nReply with the number (1-6):`,
    validate: (v) => ['1','2','3','4','5','6'].includes(v.trim()),
    transform: (v) => ['farmer','student','salaried','self-employed','unemployed','homemaker'][parseInt(v)-1],
    error: '❌ Please reply with a number from 1 to 6.',
  },
  {
    key: 'income',
    question: `*Question 3/6:* What is your annual family income?\n\n1️⃣ Below ₹1 lakh\n2️⃣ ₹1 - ₹3 lakh\n3️⃣ ₹3 - ₹5 lakh\n4️⃣ ₹5 - ₹10 lakh\n5️⃣ Above ₹10 lakh\n\nReply with the number (1-5):`,
    validate: (v) => ['1','2','3','4','5'].includes(v.trim()),
    transform: (v) => ['below-1l','1l-3l','3l-5l','5l-10l','above-10l'][parseInt(v)-1],
    error: '❌ Please reply with a number from 1 to 5.',
  },
  {
    key: 'state',
    question: `*Question 4/6:* Which state are you from?\n\nType your state name (e.g., Uttar Pradesh, Maharashtra, Madhya Pradesh)`,
    validate: (v) => v.trim().length >= 2,
    transform: (v) => v.trim().toLowerCase(),
    error: '❌ Please enter a valid state name.',
  },
  {
    key: 'gender',
    question: `*Question 5/6:* What is your gender?\n\n1️⃣ Male\n2️⃣ Female\n3️⃣ Other\n\nReply with the number (1-3):`,
    validate: (v) => ['1','2','3'].includes(v.trim()),
    transform: (v) => ['male','female','other'][parseInt(v)-1],
    error: '❌ Please reply with 1, 2, or 3.',
  },
  {
    key: 'caste',
    question: `*Question 6/6:* What is your social category?\n\n1️⃣ General\n2️⃣ OBC\n3️⃣ SC (Scheduled Caste)\n4️⃣ ST (Scheduled Tribe)\n5️⃣ EWS (Economically Weaker Section)\n\nReply with the number (1-5):`,
    validate: (v) => ['1','2','3','4','5'].includes(v.trim()),
    transform: (v) => ['general','obc','sc','st','ews'][parseInt(v)-1],
    error: '❌ Please reply with a number from 1 to 5.',
  },
];

// ═══════════════════════════════════════════════════════════════
// ELIGIBILITY ENGINE
// ═══════════════════════════════════════════════════════════════

function calculateMatchScore(scheme, answers) {
  let score = 0, totalChecks = 0;
  const { age, occupation, income, gender, caste } = answers;

  if (scheme.eligibility.minAge || scheme.eligibility.maxAge) {
    totalChecks++;
    if (age >= (scheme.eligibility.minAge || 0) && age <= (scheme.eligibility.maxAge || 150)) score++;
  }
  if (scheme.eligibility.occupations) {
    totalChecks++;
    if (scheme.eligibility.occupations.includes(occupation)) score++;
  }
  if (scheme.eligibility.maxIncome) {
    totalChecks++;
    const levels = ['below-1l','1l-3l','3l-5l','5l-10l','above-10l'];
    if (levels.indexOf(income) <= levels.indexOf(scheme.eligibility.maxIncome)) score++;
  }
  if (scheme.eligibility.genders) {
    totalChecks++;
    if (scheme.eligibility.genders.includes(gender)) score++;
  }
  if (scheme.eligibility.castes) {
    totalChecks++;
    if (scheme.eligibility.castes.includes(caste)) score++;
  }
  if (scheme.eligibility.states) {
    totalChecks++;
    if (scheme.eligibility.states.includes(answers.state)) score++;
  }

  return totalChecks === 0 ? 50 : Math.round((score / totalChecks) * 100);
}

function getMatchedSchemes(answers) {
  return SCHEMES.map(s => ({ ...s, matchScore: calculateMatchScore(s, answers) }))
    .filter(s => s.matchScore >= 30)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 10);
}

function formatResults(schemes, answers) {
  const { age, occupation, income, state, gender, caste } = answers;
  const occLabels = { farmer: 'Farmer', student: 'Student', salaried: 'Salaried', 'self-employed': 'Self-employed', unemployed: 'Unemployed', homemaker: 'Homemaker' };
  const incLabels = { 'below-1l': 'Below ₹1 lakh', '1l-3l': '₹1-3 lakh', '3l-5l': '₹3-5 lakh', '5l-10l': '₹5-10 lakh', 'above-10l': 'Above ₹10 lakh' };
  const cstLabels = { general: 'General', obc: 'OBC', sc: 'SC', st: 'ST', ews: 'EWS' };

  let msg = `🎯 *Your Eligibility Results*\n━━━━━━━━━━━━━━━━━━━\n\n📋 *Your Profile:*\n`;
  msg += `• Age: ${age} years\n• Occupation: ${occLabels[occupation] || occupation}\n`;
  msg += `• Income: ${incLabels[income] || income}\n• State: ${state.charAt(0).toUpperCase() + state.slice(1)}\n`;
  msg += `• Gender: ${gender.charAt(0).toUpperCase() + gender.slice(1)}\n• Category: ${cstLabels[caste] || caste}\n\n`;
  msg += `━━━━━━━━━━━━━━━━━━━\n✅ *You match ${schemes.length} scheme${schemes.length !== 1 ? 's' : ''}!*\n\n`;

  schemes.forEach((s, i) => {
    const emoji = s.matchScore >= 80 ? '🟢' : s.matchScore >= 50 ? '🟡' : '🟠';
    msg += `${i + 1}. *${s.name}* ${emoji} ${s.matchScore}% match\n`;
    msg += `   💰 ${s.benefit}\n   📝 Docs: ${s.documents.join(', ')}\n   🔗 ${s.applyUrl}\n\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━━\nType *RESTART* to check again`;
  return msg;
}

// ═══════════════════════════════════════════════════════════════
// WHATSAPP API CLIENT
// ═══════════════════════════════════════════════════════════════

async function sendWhatsAppMessage(to, body) {
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const token = process.env.WHATSAPP_TOKEN;
  if (!phoneId || !token) { console.error('Missing WhatsApp credentials'); return; }
  try {
    const res = await fetch(`${WHATSAPP_API_BASE}/${phoneId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { body, preview_url: false } }),
    });
    if (!res.ok) console.error('WhatsApp API error:', await res.text());
  } catch (e) { console.error('Failed to send WhatsApp message:', e); }
}

// ═══════════════════════════════════════════════════════════════
// SESSION MANAGEMENT
// ═══════════════════════════════════════════════════════════════

function getSession(phone) {
  const s = sessions.get(phone);
  if (!s) return { step: 'start', answers: {} };
  if (Date.now() - s.lastActive > SESSION_TIMEOUT_MS) {
    sessions.delete(phone);
    return { step: 'start', answers: {} };
  }
  return { step: s.step, answers: s.answers };
}

function saveSession(phone, step, answers) {
  sessions.set(phone, { step, answers, lastActive: Date.now() });
}

setInterval(() => {
  const now = Date.now();
  for (const [phone, s] of sessions.entries()) {
    if (now - s.lastActive > SESSION_TIMEOUT_MS) sessions.delete(phone);
  }
}, 10 * 60 * 1000);

// ═══════════════════════════════════════════════════════════════
// MESSAGE PROCESSOR
// ═══════════════════════════════════════════════════════════════

async function processMessage(phone, text) {
  const session = getSession(phone);
  const norm = text.trim().toLowerCase();

  if (norm === 'restart' || norm === 'hi' || norm === 'hello' || norm === 'start') {
    saveSession(phone, 'start', {});
    return FLOW[0].question;
  }
  if (norm === 'help') {
    return `📖 *Sarkari Dost Help*\n\nSend *HI* or *START* to begin eligibility check\nSend *RESTART* to start over\nSend *HELP* for this message\n\nI will ask 6 questions about your age, occupation, income, state, gender, and category to find government schemes you qualify for.`;
  }
  if (session.step === 'start') {
    saveSession(phone, FLOW[0].key, {});
    return FLOW[0].question;
  }

  const idx = FLOW.findIndex(s => s.key === session.step);
  if (idx === -1) { saveSession(phone, 'start', {}); return FLOW[0].question; }

  const step = FLOW[idx];
  if (!step.validate(text)) return step.error + '\n\n' + step.question;

  const val = step.transform ? step.transform(text) : text;
  const answers = { ...session.answers, [step.key]: val };

  if (idx < FLOW.length - 1) {
    const next = FLOW[idx + 1];
    saveSession(phone, next.key, answers);
    return `✅ *Saved!*\n\n${next.question}`;
  }

  saveSession(phone, 'results', answers);
  return formatResults(getMatchedSchemes(answers), answers);
}

// ═══════════════════════════════════════════════════════════════
// HONO APP
// ═══════════════════════════════════════════════════════════════

const app = new Hono();

// SERVE FRONTEND HTML
app.get('/', (c) => {
  try {
    const html = readFileSync(join(__dirname, '../public/index.html'), 'utf-8');
    return c.html(html);
  } catch (e) {
    console.error('Error reading index.html:', e);
    return c.text('Frontend not found. Please make sure public/index.html exists.', 500);
  }
});

// SERVE SCHEMES JSON (for frontend to use)
app.get('/api/schemes', (c) => {
  try {
    const schemesData = readFileSync(join(__dirname, '../public/schemes.json'), 'utf-8');
    return c.json(JSON.parse(schemesData));
  } catch (e) {
    return c.json({ error: 'Failed to load schemes' }, 500);
  }
});

// Health check
app.get('/health', (c) => c.json({ status: 'ok', activeSessions: sessions.size, schemesLoaded: SCHEMES.length }));

// Meta webhook verification
app.get('/api/whatsapp/meta-webhook', (c) => {
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');
  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully');
    return c.text(challenge);
  }
  console.error('Webhook verification failed');
  return c.text('Forbidden', 403);
});

// Meta webhook - receive messages
app.post('/api/whatsapp/meta-webhook', async (c) => {
  try {
    const data = await c.req.json();
    console.log('Incoming webhook:', JSON.stringify(data, null, 2));
    const message = data.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return c.json({ success: true });

    const from = message.from;
    const text = message.text?.body || '';
    console.log(`📩 ${from}: ${text}`);

    const reply = await processMessage(from, text);
    await sendWhatsAppMessage(from, reply);

    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return c.json({ success: false, error: 'Internal error' }, 500);
  }
});

// Twilio webhook (alternative)
app.post('/api/whatsapp/twilio-webhook', async (c) => {
  try {
    const body = await c.req.parseBody();
    const from = (body.From || '').replace('whatsapp:', '');
    const text = body.Body || '';
    const reply = await processMessage(from, text);

    const sid = process.env.TWILIO_SID;
    const auth = process.env.TWILIO_TOKEN;
    if (sid && auth) {
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: { 'Authorization': 'Basic ' + Buffer.from(`${sid}:${auth}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ To: body.From, From: process.env.TWILIO_WHATSAPP_NUMBER, Body: reply }),
      });
    }
    return c.json({ success: true });
  } catch (e) {
    console.error('❌ Twilio error:', e);
    return c.json({ success: false }, 500);
  }
});

console.log('🚀 Sarkari Dost WhatsApp Bot starting...');
console.log(`📡 Port: ${PORT}`);
console.log(`🧠 Active sessions: ${sessions.size}`);
console.log(`📚 Schemes loaded: ${SCHEMES.length}`);
console.log(`🌐 Website: http://localhost:${PORT}`);

serve({ fetch: app.fetch, port: Number(PORT) });
