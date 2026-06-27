#!/bin/bash
# Railway One-Click Deploy Script
# Run: chmod +x railway-deploy.sh && ./railway-deploy.sh

echo "🚀 Deploying Sarkari Dost WhatsApp Bot to Railway..."

# Check if railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "Installing Railway CLI..."
    npm install -g @railway/cli
fi

# Login
railway login

# Initialize project (or link existing)
railway init --name sarkari-dost-whatsapp || railway link

# Set environment variables
echo "Setting environment variables..."
railway variables set WHATSAPP_TOKEN="$WHATSAPP_TOKEN"
railway variables set WHATSAPP_PHONE_ID="$WHATSAPP_PHONE_ID"
railway variables set META_VERIFY_TOKEN="$META_VERIFY_TOKEN"

# Deploy
echo "Deploying..."
railway up

# Get URL
URL=$(railway domain)
echo "✅ Deployed! Your bot URL: $URL"
echo ""
echo "📋 Next steps:"
echo "1. Go to developers.facebook.com"
echo "2. Set webhook to: $URL/api/whatsapp/meta-webhook"
echo "3. Add your phone as a test number"
echo "4. Send 'HI' to your WhatsApp number!"
