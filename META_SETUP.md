# Meta WhatsApp Cloud API Setup (15 minutes)

## Step 1: Create Meta App
1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Click "Create App"
3. Select **"Other"** → **"Business"**
4. App name: `Sarkari Dost WhatsApp`
5. App contact email: your email
6. **Do NOT** connect a Business Account yet (skip for now)
7. Click "Create App"

## Step 2: Add WhatsApp Product
1. On the app dashboard, click **"Add Product"**
2. Find **WhatsApp** → Click **"Set Up"**
3. You will see:
   - **Test Phone Number** (free, starts with +1)
   - **Phone Number ID** (copy this!)
   - **Access Token** (temporary, we'll replace later)

## Step 3: Get Permanent Access Token
1. Go to [business.facebook.com/settings](https://business.facebook.com/settings)
2. Click **"System Users"** (left sidebar)
3. Click **"Add"** → Name: `Sarkari Dost Bot` → Role: `Admin`
4. Click on the new user → **"Generate New Token"**
5. Select your app
6. Permissions needed:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
7. Click **"Generate Token"**
8. **Copy the token** (it never expires)

## Step 4: Add Your Phone as Test Number
1. Back in your Meta App → WhatsApp → API Setup
2. Scroll to **"Test Numbers"**
3. Click **"Add Phone Number"**
4. Enter your WhatsApp number (with country code, e.g., +919876543210)
5. You will receive a **verification code** on WhatsApp
6. Enter the code

## Step 5: Configure Webhook
1. In your Meta App → WhatsApp → Configuration
2. Click **"Edit"** next to Webhooks
3. **Callback URL**: `https://YOUR-DOMAIN.com/api/whatsapp/meta-webhook`
4. **Verify Token**: (any random string, e.g., `sarkari_dost_2024`)
5. Click **"Verify and Save"**
6. Under **"Webhook Fields"**, subscribe to **"messages"**

## Step 6: Fill .env File
```bash
WHATSAPP_TOKEN=your_permanent_token_from_step_3
WHATSAPP_PHONE_ID=your_phone_number_id_from_step_2
META_VERIFY_TOKEN=the_same_random_string_from_step_5
```

## Step 7: Deploy & Test
```bash
npm install
npm start
```

Then text **"HI"** to your test WhatsApp number!

## Troubleshooting

**"Webhook verification failed"**
- Make sure your server is running and publicly accessible
- Check the callback URL is exactly correct (including `/api/whatsapp/meta-webhook`)
- Verify `META_VERIFY_TOKEN` matches exactly

**"Messages not received"**
- Check server logs for incoming webhook payload
- Make sure your phone number is added as a test number
- Verify the webhook is subscribed to `messages` field

**"Cannot send messages"**
- Check `WHATSAPP_TOKEN` is the permanent token (not the temporary one)
- Verify `WHATSAPP_PHONE_ID` is correct
- Check server logs for API errors
