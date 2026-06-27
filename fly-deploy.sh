#!/bin/bash
# Fly.io Deploy Script
# Run: chmod +x fly-deploy.sh && ./fly-deploy.sh

echo "🚀 Deploying to Fly.io..."

# Install flyctl if needed
if ! command -v flyctl &> /dev/null; then
    curl -L https://fly.io/install.sh | sh
    export PATH="$HOME/.fly/bin:$PATH"
fi

# Login
flyctl auth login

# Launch app
flyctl launch --name sarkari-dost-whatsapp --region bom --no-deploy

# Set secrets
flyctl secrets set WHATSAPP_TOKEN="$WHATSAPP_TOKEN"
flyctl secrets set WHATSAPP_PHONE_ID="$WHATSAPP_PHONE_ID"
flyctl secrets set META_VERIFY_TOKEN="$META_VERIFY_TOKEN"

# Deploy
flyctl deploy

URL=$(flyctl status --json | grep -o '"Hostname":"[^"]*"' | cut -d'"' -f4)
echo "✅ Deployed! URL: https://$URL"
