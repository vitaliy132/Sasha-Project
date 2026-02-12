#!/bin/bash
# Quick Start Guide for Google Sheets Integration

echo "🚀 Google Sheets Lead Validator - Quick Start"
echo ""
echo "Step 1: Install Dependencies"
npm install
echo "✅ Dependencies installed"
echo ""

echo "Step 2: Create .env file"
echo "Create a .env file with these required variables:"
echo ""
cat .env.example
echo ""

echo "Step 3: Set Up Google Sheets"
echo "📋 Follow these steps:"
echo "1. Go to Google Cloud Console: https://console.cloud.google.com"
echo "2. Create/select project 'rv-chatbot-backend'"
echo "3. Create service account 'manychat-backend'"
echo "4. Download JSON credentials"
echo "5. Extract GOOGLE_PROJECT_ID, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY"
echo "6. Create Google Sheet and share with service account email"
echo "7. Copy Sheet ID from URL"
echo ""

echo "Step 4: Local Testing"
echo "npm start          # Start server locally"
echo ""
echo "Test endpoints:"
echo "  GET http://localhost:3000/health"
echo "  GET http://localhost:3000/api/env-check"
echo ""
echo "Send test lead:"
echo "curl -X POST http://localhost:3000/api/leads/manychat \\"
echo "  -H 'x-webhook-secret: your-secret' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"first_name\": \"John\", \"last_name\": \"Doe\", \"email\": \"john@example.com\"}'"
echo ""

echo "Step 5: Deploy to Render"
echo "1. Push all changes to Git"
echo "2. Go to Render dashboard"
echo "3. Add all environment variables from .env"
echo "4. Deploy"
echo ""

echo "✨ Setup complete! Check GOOGLE_SHEETS_SETUP.md for detailed instructions"
