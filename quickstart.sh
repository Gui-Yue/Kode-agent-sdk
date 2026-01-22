#!/bin/bash

# KODE SDK v2.7.0 - Quick Start Script

echo "KODE SDK v2.7.0 Quick Start"
echo ""

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Node.js version must be 18 or higher. Current: $(node -v)"
    exit 1
fi

echo "Node.js $(node -v) detected"
echo ""

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the project
echo "Building TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    echo "Build failed. Please check for errors above."
    exit 1
fi

echo "Build successful!"
echo ""

# Check for API key
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "Warning: ANTHROPIC_API_KEY environment variable is not set."
    echo "  Please set it to run examples:"
    echo "  export ANTHROPIC_API_KEY=your_key_here"
    echo ""
fi

echo "Available examples:"
echo ""
echo "  Getting Started:"
echo "    npm run example:getting-started    - Minimal chat example"
echo ""
echo "  Providers:"
echo "    npm run example:openai             - OpenAI provider usage"
echo "    npm run example:gemini             - Gemini provider usage"
echo "    npm run example:openrouter         - OpenRouter complete example"
echo "    npm run example:openrouter-stream  - OpenRouter streaming"
echo "    npm run example:openrouter-agent   - OpenRouter agent with tools"
echo ""
echo "  Features:"
echo "    npm run example:agent-inbox        - Event-driven inbox"
echo "    npm run example:approval           - Tool approval workflow"
echo "    npm run example:room               - Multi-agent collaboration"
echo "    npm run example:scheduler          - Scheduler with triggers"
echo "    npm run example:nextjs             - Next.js API route"
echo ""
echo "  Database:"
echo "    npm run example:db-sqlite          - SQLite persistence"
echo "    npm run example:db-postgres        - PostgreSQL persistence"
echo ""

echo "Documentation: docs/en/ or docs/zh-CN/"
echo ""

echo "KODE SDK is ready! Happy coding!"
