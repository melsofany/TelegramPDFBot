#!/bin/bash

# Get the deployed URL from environment
if [ -z "$REPLIT_DOMAINS" ]; then
  echo "Error: REPLIT_DOMAINS not set. Please deploy the app first."
  exit 1
fi

# Get the first domain
DOMAIN=$(echo $REPLIT_DOMAINS | cut -d',' -f1)
WEBHOOK_URL="https://${DOMAIN}/api/webhooks/telegram/action"

# Set the webhook
echo "Setting Telegram webhook to: $WEBHOOK_URL"
curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${WEBHOOK_URL}\"}"

echo ""
echo "Done!"
