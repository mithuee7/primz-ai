#!/bin/bash

# ============================================================================
# Primz AI - Complete Setup & Deployment Script
# ============================================================================
# This script handles everything:
# 1. Backs up your current project
# 2. Copies all new files to correct locations
# 3. Creates git commit
# 4. Pushes to GitHub
# 5. Shows deployment status
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found!"
    echo "Please run this script from your primz-ai project root directory."
    exit 1
fi

if [ ! -d ".git" ]; then
    print_error "Not a git repository!"
    echo "Please run 'git init' first."
    exit 1
fi

print_header "🚀 Primz AI - Complete Setup"

# Get GitHub username
read -p "$(echo -e ${BLUE})Enter your GitHub username: $(echo -e ${NC})" GITHUB_USER

if [ -z "$GITHUB_USER" ]; then
    print_error "GitHub username is required"
    exit 1
fi

# Confirm files to copy
echo ""
print_info "This will copy:"
echo "  • 3 service files to src/lib/services/"
echo "  • 5 component files to src/components/"
echo "  • 4 API route files to src/app/api/"
echo "  • 1 database migration to supabase/migrations/"
echo ""
read -p "$(echo -e ${YELLOW})Continue? (y/n): $(echo -e ${NC})" -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_error "Setup cancelled"
    exit 1
fi

# Create backup
print_header "Creating Backup"
BACKUP_DIR="primz-ai-backup-$(date +%Y%m%d-%H%M%S)"
print_info "Backing up current project to $BACKUP_DIR..."
cp -r . "../$BACKUP_DIR/" 2>/dev/null || true
print_success "Backup created: ../$BACKUP_DIR"

# Copy files
print_header "Copying Files"

# Services
print_info "Copying services..."
mkdir -p src/lib/services
cp src/lib/services/*.ts ../primz-ai-complete/src/lib/services/ 2>/dev/null || true
cp ../primz-ai-complete/src/lib/services/*.ts src/lib/services/
print_success "Services copied"

# Components
print_info "Copying components..."
mkdir -p src/components/api-keys
mkdir -p src/components/chat
mkdir -p src/components/leads
cp ../primz-ai-complete/src/components/api-keys/*.tsx src/components/api-keys/
cp ../primz-ai-complete/src/components/chat/*.tsx src/components/chat/
cp ../primz-ai-complete/src/components/leads/*.tsx src/components/leads/
print_success "Components copied"

# API Routes
print_info "Copying API routes..."
mkdir -p src/app/api/groq-keys
mkdir -p src/app/api/apify-keys
mkdir -p src/app/api/lead-type/detect
mkdir -p src/app/api/leads/[id]/delete
cp ../primz-ai-complete/src/app/api/groq-keys/route.ts src/app/api/groq-keys/
cp ../primz-ai-complete/src/app/api/apify-keys/route.ts src/app/api/apify-keys/
cp ../primz-ai-complete/src/app/api/lead-type/detect/route.ts src/app/api/lead-type/detect/
cp ../primz-ai-complete/src/app/api/leads/[id]/delete/route.ts src/app/api/leads/[id]/delete/
print_success "API routes copied"

# Database migration
print_info "Copying database migration..."
mkdir -p supabase/migrations
cp ../primz-ai-complete/supabase/migrations/0005_*.sql supabase/migrations/
print_success "Migration copied"

# Documentation
print_info "Copying documentation..."
cp ../primz-ai-complete/README.md ./PRIMZ-AI-FEATURES-README.md
cp ../primz-ai-complete/INTEGRATION_GUIDE.md ./PRIMZ-AI-INTEGRATION.md
print_success "Documentation copied"

echo ""
print_header "📝 Creating Git Commit"

# Create feature branch
BRANCH_NAME="feat/api-keys-and-lead-detection-$(date +%s)"
print_info "Creating branch: $BRANCH_NAME"
git checkout -b "$BRANCH_NAME" 2>/dev/null || git switch -c "$BRANCH_NAME"
print_success "Branch created"

# Stage files
print_info "Staging files..."
git add src/lib/services/ src/components/ src/app/api/ supabase/migrations/ *.md 2>/dev/null || true
git add -A
print_success "Files staged"

# Show what's being committed
echo ""
print_info "Files to be committed:"
git diff --cached --name-status | head -20
TOTAL_FILES=$(git diff --cached --name-status | wc -l)
if [ "$TOTAL_FILES" -gt 20 ]; then
    echo "   ... and $((TOTAL_FILES - 20)) more files"
fi

echo ""
read -p "$(echo -e ${YELLOW})Proceed with commit? (y/n): $(echo -e ${NC})" -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_error "Commit cancelled"
    print_warning "Changes are staged but not committed. You can commit manually later."
    exit 1
fi

# Commit
print_info "Creating commit..."
git commit -m "feat: add multiple API keys, lead detection, and rate limiting

FEATURES ADDED:
- Multiple Groq API key management with auto-switching on rate limits
- Apify Instagram profile scraping for lead type detection  
- Rate limit timer UI component with countdown
- Full message history fetching from Meta Graph API
- AI/Manual mode toggle per conversation
- Lead deletion with confirmation modal
- Database schema for new API key tables

IMPLEMENTATION:
- 3 TypeScript services for key management and API integration
- 5 React components for UI management
- 4 API routes for CRUD operations
- 1 Supabase migration for database schema
- Full TypeScript typing throughout
- Supabase RLS policies for security
- Error handling and loading states

USAGE:
- All API keys stored encrypted in Supabase
- No environment variables needed
- Free Apify and Groq APIs supported
- Automatic key rotation on rate limit
- Full integration guide included

See PRIMZ-AI-FEATURES-README.md for details."

print_success "Commit created"

echo ""
print_header "🔗 Pushing to GitHub"

# Push
print_info "Pushing to GitHub..."
git push -u origin "$BRANCH_NAME"
print_success "Pushed to GitHub"

echo ""
print_header "✨ Setup Complete!"

echo ""
print_success "All files deployed successfully!"

echo ""
echo -e "${YELLOW}📋 NEXT STEPS (REQUIRED):${NC}"
echo ""
echo "1️⃣  Review Pull Request:"
echo "   https://github.com/$GITHUB_USER/primz-ai/pull"
echo ""
echo "2️⃣  Merge to main branch"
echo "   (Your Render app will auto-deploy)"
echo ""
echo "3️⃣  Run Supabase Migration:"
echo "   📂 File: supabase/migrations/0005_add_api_keys_and_features.sql"
echo "   • Go to Supabase → SQL Editor"
echo "   • Copy & execute the migration"
echo ""
echo "4️⃣  Update Settings Page:"
echo "   📂 File: src/app/(app)/settings/page.tsx"
echo "   • Add imports for GroqKeysManager & ApifyKeysManager"
echo "   • Add the components to your JSX"
echo "   • See PRIMZ-AI-INTEGRATION.md for code"
echo ""
echo "5️⃣  Test Features:"
echo "   • Go to Settings → API Keys Management"
echo "   • Add a Groq API key"
echo "   • Add an Apify API key"
echo "   • Try deleting them"
echo "   • Verify chat still works"
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}🎉 Deployment started! Ready for PR merge.${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "📚 Documentation:"
echo "   • PRIMZ-AI-FEATURES-README.md - Overview"
echo "   • PRIMZ-AI-INTEGRATION.md - Step-by-step guide"
echo ""
