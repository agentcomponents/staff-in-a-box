# GitHub CLI Quick Reference

## 🚀 One-Time Setup
```bash
# Install is done! Now authenticate:
~/.local/bin/gh auth login
# Follow prompts to login with your browser

# Create and push your first repo:
./github-setup.sh
```

## 📦 Repository Management
```bash
# Create new repository
~/.local/bin/gh repo create username/repo-name --public

# Clone repository
~/.local/bin/gh repo clone username/repo-name

# List your repositories
~/.local/bin/gh repo list

# Delete repository (careful!)
~/.local/bin/gh repo delete username/repo-name
```

## 🔄 Daily Workflow
```bash
# Quick deploy (your custom script)
./deploy.sh "Add new features"

# Or manual git workflow
git add .
git commit -m "Your changes"
git push

# Create pull request
~/.local/bin/gh pr create --title "Feature title" --body "Description"

# Create issue
~/.local/bin/gh issue create --title "Bug report" --body "Description"
```

## 🎯 Project Management
```bash
# View issues
~/.local/bin/gh issue list

# View pull requests
~/.local/bin/gh pr list

# Create branch and switch
git checkout -b feature-name
git push -u origin feature-name

# Merge PR from CLI
~/.local/bin/gh pr merge 123 --merge
```

## 🔗 Useful Aliases
Add to your ~/.bashrc:
```bash
alias gh='~/.local/bin/gh'
alias deploy='./deploy.sh'
export PATH="$HOME/.local/bin:$PATH"
```

After adding aliases, reload with: `source ~/.bashrc`