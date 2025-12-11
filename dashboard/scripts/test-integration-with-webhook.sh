#!/bin/bash
# Script to run integration tests with Stripe webhook forwarding
# This script starts the Stripe webhook listener in the background,
# runs the integration tests, then stops the webhook listener

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting Stripe webhook listener...${NC}"
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook &
STRIPE_PID=$!

# Wait a moment for Stripe CLI to start
sleep 2

# Check if Stripe process is still running
if ! kill -0 $STRIPE_PID 2>/dev/null; then
    echo -e "${YELLOW}Warning: Stripe webhook listener may have failed to start${NC}"
fi

echo -e "${GREEN}Stripe webhook listener started (PID: $STRIPE_PID)${NC}"
echo -e "${YELLOW}Running integration tests...${NC}"

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Stopping Stripe webhook listener (PID: $STRIPE_PID)...${NC}"
    kill $STRIPE_PID 2>/dev/null || true
    wait $STRIPE_PID 2>/dev/null || true
    echo -e "${GREEN}Cleanup complete${NC}"
}

# Trap EXIT to ensure cleanup happens
trap cleanup EXIT INT TERM

# Run integration tests
npm run test:integration:run

