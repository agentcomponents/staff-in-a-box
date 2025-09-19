#!/bin/bash

# Staff in a Box - Quick Deploy Script
# Usage: ./deploy.sh "commit message"

set -e

echo "🚀 Deploying Staff in a Box..."

# Check if commit message provided
if [ -z "$1" ]; then
    echo "❌ Please provide a commit message"
    echo "Usage: ./deploy.sh \"your commit message\""
    exit 1
fi

# Add all changes
echo "📦 Adding changes..."
git add .

# Commit with message
echo "💾 Committing changes..."
git commit -m "$1

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to GitHub
echo "⬆️  Pushing to GitHub..."
git push

echo "✅ Deployment complete!"
echo "🌐 GitHub: https://github.com/agentcomponents/staff-in-a-box"
echo "🚂 Railway will auto-deploy backend"
echo "🎯 Netlify will auto-deploy frontend"
echo ""
echo "🔗 Links:"
echo "  • Repository: https://github.com/agentcomponents/staff-in-a-box"
echo "  • Railway Backend: https://digitalstaff-production.up.railway.app"
echo "  • Netlify Frontend: https://digitalstaff.netlify.app"