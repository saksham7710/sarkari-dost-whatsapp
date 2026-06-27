import { Hono } from 'hono';
import { serve } from '@hono/node-server';

// ═══════════════════════════════════════════════════════════════
// SARKARI DOST - WHATSAPP BOT (STANDALONE DEPLOYMENT)
// ═══════════════════════════════════════════════════════════════
// This is a COMPLETE standalone server. Just run:
//   npm install && npm start
// No need to touch your existing project.
// ═══════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3000;
const WHATSAPP_API_VERSION = 'v18.0';
const WHATSAPP_API_BASE = `https://graph.facebook.com/${WHATSAPP_API_VERSION}`;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

// In-memory session store (auto-clears expired sessions)
const sessions = new Map();

// ═══════════════════════════════════════════════════════════════
// CONVERSATION FLOW
// ═══════════════════════════════════════════════════════════════

const FLOW = [
  {
    key: 'age',
    question: `👋 *Namaste!* I am *Sarkari Dost*, your government scheme assistant.

I will ask you 6 simple questions to find schemes you qualify for.

*Question 1/6:* What is your age?
(Reply with a number, e.g., 35)`,
    validate: (v) => { const n = parseInt(v); return !isNaN(n) && n >= 18 && n <= 120; },
    transform: (v) => parseInt(v),
    error: '❌ Please enter a valid age between 18 and 120.',
  },
  {
    key: 'occupation',
    question: `*Question 2/6:* What is your occupation?

1️⃣ Farmer
2️⃣ Student
3️⃣ Salaried (Govt/Private job)
4️⃣ Self-employed
5️⃣ Unemployed
6️⃣ Homemaker

Reply with the number (1-6):`,
    validate: (v) => ['1','2','3','4','5','6'].includes(v.trim()),
    transform: (v) => ['farmer','student','salaried','self-employed','unemployed','homemaker'][parseInt(v)-1],
    error: '❌ Please reply with a number from 1 to 6.',
  },
  {
    key: 'income',
    question: `*Question 3/6:* What is your annual family income?

1️⃣ Below ₹1 lakh
2️⃣ ₹1 - ₹3 lakh
3️⃣ ₹3 - ₹5 lakh
4️⃣ ₹5 - ₹10 lakh
5️⃣ Above ₹10 lakh

Reply with the number (1-5):`,
    validate: (v) => ['1','2','3','4','5'].includes(v.trim()),
    transform: (v) => ['below-1l','1l-3l','3l-5l','5l-10l','above-10l'][parseInt(v)-1],
    error: '❌ Please reply with a number from 1 to 5.',
  },
  {
    key: 'state',
    question: `*Question 4/6:* Which state are you from?

Type your state name (e.g., Uttar Pradesh, Maharashtra, Madhya Pradesh)`,
    validate: (v) => v.trim().length >= 2,
    transform: (v) => v.trim().toLowerCase(),
    error: '❌ Please enter a valid state name.',
  },
  {
    key: 'gender',
    question: `*Question 5/6:* What is your gender?

1️⃣ Male
2️⃣ Female
3️⃣ Other

Reply with the number (1-3):`,
    validate: (v) => ['1','2','3'].includes(v.trim()),
    transform: (v) => ['male','female','other'][parseInt(v)-1],
    error: '❌ Please reply with 1, 2, or 3.',
  },
  {
    key: 'caste',
    question: `*Question 6/6:* What is your social category?

1️⃣ General
2️⃣ OBC
3️⃣ SC (Scheduled Caste)
4️⃣ ST (Scheduled Tribe)
5️⃣ EWS (Economically Weaker Section)

Reply with the number (1-5):`,
    validate: (v) => ['1','2','3','4','5'].includes(v.trim()),
    transform: (v) => ['general','obc','sc','st','ews'][parseInt(v)-1],
    error: '❌ Please reply with a number from 1 to 5.',
  },
];

// ═══════════════════════════════════════════════════════════════
// 25 GOVERNMENT SCHEMES DATABASE
// ═══════════════════════════════════════════════════════════════

const SCHEMES = [
  { id: 'pm-kisan', name: 'PM-KISAN', category: 'Agriculture', benefit: '₹6,000/year in 3 installments', eligibility: { occupations: ['farmer'] }, documents: ['Aadhaar Card', 'Land Records', 'Bank Passbook'], applyUrl: 'https://pmkisan.gov.in' },
  { id: 'ayushman-bharat', name: 'Ayushman Bharat (PM-JAY)', category: 'Health', benefit: '₹5 lakh health cover', eligibility: { maxIncome: 'below-1l' }, documents: ['Aadhaar Card', 'Ration Card', 'Income Certificate'], applyUrl: 'https://pmjay.gov.in' },
  { id: 'pmay-urban', name: 'PMAY-Urban (Housing)', category: 'Housing', benefit: 'Interest subsidy up to ₹2.67 lakh', eligibility: { maxIncome: '3l-5l', occupations: ['salaried','self-employed'] }, documents: ['Aadhaar Card', 'Income Proof', 'Bank Statement'], applyUrl: 'https://pmay-urban.gov.in' },
  { id: 'pmay-gramin', name: 'PMAY-Gramin', category: 'Housing', benefit: '₹1.2 lakh + 90/95 days MNREGA wages', eligibility: { occupations: ['farmer','unemployed'], maxIncome: 'below-1l' }, documents: ['Aadhaar Card', 'BPL Certificate', 'Land Documents'], applyUrl: 'https://pmayg.nic.in' },
  { id: 'pm-vvy', name: 'PM Vaya Vandana Yojana', category: 'Pension', benefit: '₹10,000/month pension', eligibility: { minAge: 60 }, documents: ['Aadhaar Card', 'Age Proof', 'Bank Passbook'], applyUrl: 'https://licindia.in' },
  { id: 'atal-pension', name: 'Atal Pension Yojana', category: 'Pension', benefit: '₹1,000 - ₹5,000/month pension', eligibility: { minAge: 18, maxAge: 40 }, documents: ['Aadhaar Card', 'Bank Account', 'Mobile Number'], applyUrl: 'https://npscra.nsdl.co.in' },
  { id: 'pm-sym', name: 'PM Shram Yogi Maandhan', category: 'Pension', benefit: '₹3,000/month after 60 years', eligibility: { minAge: 18, maxAge: 40, occupations: ['self-employed','unemployed'] }, documents: ['Aadhaar Card', 'Bank Account', 'Mobile Number'], applyUrl: 'https://maandhan.in' },
  { id: 'sukanya-samriddhi', name: 'Sukanya Samriddhi Yojana', category: 'Women', benefit: '8.2% interest + tax benefits', eligibility: { genders: ['female'] }, documents: ['Girl Child Birth Certificate', 'Aadhaar Card', 'Parent ID'], applyUrl: 'https://nsiindia.gov.in' },
  { id: 'pm-mvvy', name: 'PM Matru Vandana Yojana', category: 'Women', benefit: '₹5,000 in 3 installments', eligibility: { genders: ['female'] }, documents: ['Aadhaar Card', 'MCP Card', 'Bank Account'], applyUrl: 'https://wcd.nic.in' },
  { id: 'post-matric-scholarship', name: 'Post Matric Scholarship (SC/ST)', category: 'Education', benefit: 'Full fee reimbursement + maintenance allowance', eligibility: { castes: ['sc','st'] }, documents: ['Caste Certificate', 'Income Certificate', 'Marksheet'], applyUrl: 'https://scholarships.gov.in' },
  { id: 'pm-jan-dhan', name: 'PM Jan Dhan Yojana', category: 'General', benefit: '₹1 lakh accident insurance + ₹30,000 life cover', eligibility: {}, documents: ['Aadhaar Card', 'Passport Photo'], applyUrl: 'https://pmjdy.gov.in' },
  { id: 'mudra-loan', name: 'MUDRA Loan', category: 'Business', benefit: 'Loan up to ₹10 lakh at low interest', eligibility: { occupations: ['self-employed','farmer'] }, documents: ['Aadhaar Card', 'Business Plan', 'Bank Statement'], applyUrl: 'https://mudra.org.in' },
  { id: 'stand-up-india', name: 'Stand-Up India', category: 'Business', benefit: '₹10 lakh - ₹1 crore loan', eligibility: { castes: ['sc','st'], genders: ['female'] }, documents: ['Aadhaar Card', 'Caste Certificate', 'Project Report'], applyUrl: 'https://standupmitra.in' },
  { id: 'pm-fasal-bima', name: 'PM Fasal Bima Yojana', category: 'Agriculture', benefit: 'Full crop loss compensation', eligibility: { occupations: ['farmer'] }, documents: ['Aadhaar Card', 'Land Records', 'Bank Account'], applyUrl: 'https://pmfby.gov.in' },
  { id: 'soil-health-card', name: 'Soil Health Card Scheme', category: 'Agriculture', benefit: 'Free soil health card + fertilizer recommendations', eligibility: { occupations: ['farmer'] }, documents: ['Aadhaar Card', 'Land Records'], applyUrl: 'https://soilhealth.dac.gov.in' },
  { id: 'pm-krishi-sinchayee', name: 'PM Krishi Sinchayee Yojana', category: 'Agriculture', benefit: '55-75% subsidy on drip/sprinkler irrigation', eligibility: { occupations: ['farmer'] }, documents: ['Aadhaar Card', 'Land Records', 'Bank Account'], applyUrl: 'https://pmksy.gov.in' },
  { id: 'ignoaps', name: 'Indira Gandhi Old Age Pension', category: 'Pension', benefit: '₹200-₹1,000/month (varies by state)', eligibility: { minAge: 60, maxIncome: 'below-1l' }, documents: ['Aadhaar Card', 'Age Proof', 'BPL Card'], applyUrl: 'https://nsap.nic.in' },
  { id: 'nfbsc', name: 'National Family Benefit Scheme', category: 'General', benefit: '₹20,000 one-time assistance', eligibility: { maxIncome: 'below-1l' }, documents: ['Death Certificate', 'Income Certificate', 'Aadhaar Card'], applyUrl: 'https://nsap.nic.in' },
  { id: 'pmegp', name: 'PM Employment Generation Programme', category: 'Business', benefit: '15-35% subsidy on project cost', eligibility: { occupations: ['unemployed','self-employed'] }, documents: ['Aadhaar Card', 'Project Report', 'Caste Certificate'], applyUrl: 'https://pmegp.kviconline.gov.in' },
  { id: 'beti-bachao', name: 'Beti Bachao Beti Padhao', category: 'Women', benefit: 'Cash transfer for girl education', eligibility: { genders: ['female'] }, documents: ['Birth Certificate', 'Aadhaar Card', 'Parent ID'], applyUrl: 'https://wcd.nic.in' },
  { id: 'pm-ujjwala', name: 'PM Ujjwala Yojana', category: 'General', benefit: 'Free gas connection + first refill', eligibility: { maxIncome: 'below-1l' }, documents: ['Aadhaar Card', 'BPL Card', 'Bank Account'], applyUrl: 'https://pmuy.gov.in' },
  { id: 'pm-awas-yojana', name: 'PM Awas Yojana (Rural)', category: 'Housing', benefit: '₹1.2 lakh + MGNREGA wages', eligibility: { occupations: ['farmer','unemployed'], maxIncome: 'below-1l' }, documents: ['Aadhaar Card', 'BPL Certificate'], applyUrl: 'https://pmayg.nic.in' },
  { id: 'pm-svanidhi', name: 'PM SVANidhi', category: 'Business', benefit: '₹10,000 loan + 7% interest subsidy', eligibility: { occupations: ['self-employed'] }, documents: ['Aadhaar Card', 'Vendor Certificate', 'Bank Account'], applyUrl: 'https://pmsvanidhi.mohua.gov.in' },
  { id: 'pm-kusum', name: 'PM-KUSUM', category: 'Agriculture', benefit: '60% subsidy on solar pumps', eligibility: { occupations: ['farmer'] }, documents: ['Aadhaar Card', 'Land Records', 'Bank Account'], applyUrl: 'https://mnre.gov.in' },
  { id: 'pm-garib-kalyan', name: 'PM Garib Kalyan Anna Yojana', category: 'General', benefit: '5 kg wheat/rice + 1 kg dal per person/month', eligibility: { maxIncome: 'below-1l' }, documents: ['Ration Card', 'Aadhaar Card'], applyUrl: 'https://nfsa.gov.in' },
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
  if (scheme.eligibility.occupations) { totalChecks++; if (scheme.eligibility.occupations.includes(occupation)) score++; }
  if (scheme.eligibility.maxIncome) {
    totalChecks++;
    const levels = ['below-1l','1l-3l','3l-5l','5l-10l','above-10l'];
    if (levels.indexOf(income) <= levels.indexOf(scheme.eligibility.maxIncome)) score++;
  }
  if (scheme.eligibility.genders) { totalChecks++; if (scheme.eligibility.genders.includes(gender)) score++; }
  if (scheme.eligibility.castes) { totalChecks++; if (scheme.eligibility.castes.includes(caste)) score++; }
  if (totalChecks === 0) return 50;
  return Math.round((score / totalChecks) * 100);
}

function getMatchedSchemes(answers) {
  return SCHEMES.map(s => ({ ...s, matchScore: calculateMatchScore(s, answers) }))
    .filter(s => s.matchScore >= 30).sort((a, b) => b.matchScore - a.matchScore).slice(0, 5);
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
// SESSION MANAGEMENT (In-Memory with Auto-Cleanup)
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

// Clean up expired sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [phone, s] of sessions.entries()) {
    if (now - s.lastActive > SESSION_TIMEOUT_MS) sessions.delete(phone);
  }
  console.log(`Session cleanup: ${sessions.size} active sessions`);
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

// Health check
app.get('/', (c) => c.json({ status: 'ok', service: 'Sarkari Dost WhatsApp Bot', time: new Date().toISOString(), uptime: process.uptime() }));
app.get('/health', (c) => c.json({ status: 'ok', activeSessions: sessions.size }));

// Meta webhook verification
app.get('/api/whatsapp/meta-webhook', (c) => {
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');
  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully');
    return c.text(challenge);
  }
  return c.text('Forbidden', 403);
});

// Meta webhook - receive messages
app.post('/api/whatsapp/meta-webhook', async (c) => {
  try {
    const data = await c.req.json();
    const message = data.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return c.json({ success: true });

    const from = message.from;
    const text = message.text?.body || '';
    console.log(`📩 ${from}: ${text}`);

    const reply = await processMessage(from, text);
    await sendWhatsAppMessage(from, reply);

    return c.json({ success: true });
  } catch (e) {
    console.error('❌ Webhook error:', e);
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

// ═══════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════

console.log('🚀 Sarkari Dost WhatsApp Bot starting...');
console.log(`📡 Port: ${PORT}`);
console.log(`🧠 Active sessions: ${sessions.size}`);
console.log(`📋 Schemes loaded: ${SCHEMES.length}`);

serve({ fetch: app.fetch, port: Number(PORT) });
