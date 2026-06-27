# Deploy to Render (Free Tier)

## Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial deploy"
git remote add origin https://github.com/YOUR_USERNAME/sarkari-dost-whatsapp.git
git push -u origin main
```

## Step 2: Create Web Service on Render
1. Go to [render.com](https://render.com) and sign up
2. Click "New +" → "Web Service"
3. Connect your GitHub repo
4. Settings:
   - **Name**: sarkari-dost-whatsapp
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

## Step 3: Add Environment Variables
In Render dashboard → Environment:
```
WHATSAPP_TOKEN=your_token
WHATSAPP_PHONE_ID=your_phone_id
META_VERIFY_TOKEN=your_verify_token
```

## Step 4: Deploy
Click "Deploy". Render will give you a URL like:
`https://sarkari-dost-whatsapp.onrender.com`

## Step 5: Configure Meta Webhook
1. Go to developers.facebook.com → Your App → WhatsApp → Configuration
2. Callback URL: `https://sarkari-dost-whatsapp.onrender.com/api/whatsapp/meta-webhook`
3. Verify Token: (same as META_VERIFY_TOKEN)
4. Subscribe to `messages`

## Done! 🎉
Text "HI" to your WhatsApp number.
