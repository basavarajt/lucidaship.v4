#!/bin/bash
# Lucida Full Stack Startup Script
# Usage: ./start.sh or bash start.sh

set -e

echo "🚀 LUCIDA FULL STACK STARTUP"
echo "=============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Directories
BACKEND_DIR="$SCRIPT_DIR/apps/backend"
FRONTEND_DIR="$SCRIPT_DIR/apps/frontend"

echo -e "${BLUE}Backend Directory:${NC} $BACKEND_DIR"
echo -e "${BLUE}Frontend Directory:${NC} $FRONTEND_DIR"
echo ""

# Check if directories exist
if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}Error: Backend directory not found${NC}"
    exit 1
fi

if [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${RED}Error: Frontend directory not found${NC}"
    exit 1
fi

# Function to start backend
start_backend() {
    echo -e "${YELLOW}Starting Backend...${NC}"
    cd "$BACKEND_DIR"
    
    # Check if venv exists
    if [ ! -d ".venv" ]; then
        echo -e "${YELLOW}Creating virtual environment...${NC}"
        python3 -m venv .venv
    fi
    
    # Activate venv and install dependencies
    source .venv/bin/activate
    echo -e "${YELLOW}Installing/updating dependencies...${NC}"
    pip install -q -r requirements.txt 2>/dev/null || pip install -r requirements.txt
    
    # Start server
    echo -e "${GREEN}✓ Backend ready${NC}"
    echo -e "${BLUE}Starting Uvicorn on port 8000...${NC}"
    echo ""
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
}

# Function to start frontend
start_frontend() {
    echo -e "${YELLOW}Starting Frontend...${NC}"
    cd "$FRONTEND_DIR"
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}Installing npm dependencies...${NC}"
        npm install -q
    fi
    
    # Start dev server
    echo -e "${GREEN}✓ Frontend ready${NC}"
    echo -e "${BLUE}Starting Vite on port 5173...${NC}"
    echo ""
    npm run dev
}

# Parse command line arguments
case "${1:-both}" in
    backend)
        start_backend
        ;;
    frontend)
        start_frontend
        ;;
    both)
        echo -e "${YELLOW}To start both servers, run in separate terminals:${NC}"
        echo ""
        echo -e "${BLUE}Terminal 1 (Backend):${NC}"
        echo "  cd $BACKEND_DIR"
        echo "  source .venv/bin/activate"
        echo "  uvicorn main:app --reload"
        echo ""
        echo -e "${BLUE}Terminal 2 (Frontend):${NC}"
        echo "  cd $FRONTEND_DIR"
        echo "  npm run dev"
        echo ""
        echo -e "${GREEN}Or use:${NC}"
        echo "  bash start.sh backend   # In terminal 1"
        echo "  bash start.sh frontend  # In terminal 2"
        ;;
    *)
        echo -e "${RED}Usage: bash start.sh [backend|frontend|both]${NC}"
        exit 1
        ;;
esac
