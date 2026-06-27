# Twilio WhatsApp Setup (5 minutes - Fastest!)

Use this if you want to test immediately without Meta business verification.

## Step 1: Create Twilio Account
1. Go to [twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Sign up with your email
3. Verify your phone number
4. You get $15.50 free credit

## Step 2: Get WhatsApp Sandbox Number
1. In Twilio Console, go to **Messaging → Try it out → Send a WhatsApp message**
2. You will see a sandbox number like `+1 415 523 8886`
3. **Join the sandbox** by sending this exact message from your WhatsApp:
   ```
   join <your-sandbox-code>
   ```
   (The code is shown on the Twilio page)

## Step 3: Get Credentials
1. Go to Twilio Console → Account Info
2. Copy:
   - **Account SID** (starts with AC...)
   - **Auth Token** (click the eye icon to reveal)

## Step 4: Configure Webhook
1. Go to **Messaging → Settings → WhatsApp Sandbox Settings**
2. Under **"When a message comes in"**:
   - URL: `https://YOUR-DOMAIN.com/api/whatsapp/twilio-webhook`
   - Method: `POST`
3. Click **"Save"**

## Step 5: Fill .env File
```bash
TWILIO_SID=your_account_sid
TWILIO_TOKEN=your_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

## Step 6: Deploy & Test
```bash
npm install
npm start
```

Text **"HI"** to the Twilio sandbox number!

## Limitations
- Sandbox only works with numbers you verify
- "join" code expires and needs to be renewed
- Not suitable for production (use Meta API for production)
- Costs ~$0.005 per message

## Switching to Meta API Later
Just update your webhook URL in Meta to point to the same server. The server supports both Meta and Twilio simultaneously.
