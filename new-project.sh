#!/bin/bash

# Create New GitHub Project Script
# Usage: ./new-project.sh "project-name" "description"

set -e

if [ -z "$1" ]; then
    echo "❌ Please provide a project name"
    echo "Usage: ./new-project.sh \"project-name\" \"Project description\""
    exit 1
fi

PROJECT_NAME="$1"
DESCRIPTION="${2:-A new project}"
TOKEN="${GITHUB_TOKEN:-}"

if [ -z "$TOKEN" ]; then
    echo "❌ GITHUB_TOKEN environment variable not set"
    echo "Export your token: export GITHUB_TOKEN=your_token_here"
    exit 1
fi

echo "🚀 Creating new GitHub project: $PROJECT_NAME"

# Create directory and initialize
mkdir -p "$PROJECT_NAME"
cd "$PROJECT_NAME"

# Initialize git
git init
git branch -m main

# Create basic files
echo "# $PROJECT_NAME" > README.md
echo "$DESCRIPTION" >> README.md
echo ""  >> README.md
echo "Created $(date)" >> README.md

echo "node_modules/" > .gitignore
echo ".env" >> .gitignore
echo "*.log" >> .gitignore

# Initial commit
git add .
git commit -m "Initial commit

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"

# Create GitHub repository
echo "📦 Creating GitHub repository..."
curl -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/user/repos \
  -d "{
    \"name\": \"$PROJECT_NAME\",
    \"description\": \"$DESCRIPTION\",
    \"private\": false,
    \"auto_init\": false
  }" > /dev/null

# Set up remote and push
git remote add origin https://$TOKEN@github.com/agentcomponents/$PROJECT_NAME.git
git push -u origin main

echo "✅ Project created successfully!"
echo "🌐 https://github.com/agentcomponents/$PROJECT_NAME"
echo "📁 Local directory: $(pwd)"