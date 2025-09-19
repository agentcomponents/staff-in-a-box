#!/bin/bash

# GitHub CLI Setup Script
export PATH="$HOME/.local/bin:$PATH"

echo "🔐 Setting up GitHub CLI..."

# Create the repository
echo "📦 Creating GitHub repository..."
~/.local/bin/gh repo create agentcomponents/staff-in-a-box \
  --public \
  --description "AI-powered digital staff system for small businesses" \
  --clone=false

echo "✅ Repository created: https://github.com/agentcomponents/staff-in-a-box"

# Push existing code
echo "⬆️  Pushing code to GitHub..."
git push -u origin main

echo "🎉 GitHub setup complete!"
echo ""
echo "🛠️  Your CLI commands:"
echo "  gh repo create <name>     # Create new repo"
echo "  gh repo clone <repo>      # Clone repo"
echo "  gh pr create              # Create pull request"
echo "  gh issue create           # Create issue"
echo "  gh repo list              # List your repos"
echo ""
echo "🔗 GitHub: https://github.com/agentcomponents/staff-in-a-box"