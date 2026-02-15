#!/bin/bash

# Like and Save Implementation Test Runner
# This script runs comprehensive tests for the like and save functionality

echo "🚀 Starting Like and Save Implementation Tests"
echo "=============================================="

# Check if required environment variables are set
if [ -z "$TEST_USER_TOKEN" ]; then
    echo "❌ Error: TEST_USER_TOKEN environment variable is required"
    echo "   Please set it with a valid authentication token"
    echo "   Example: export TEST_USER_TOKEN='your-jwt-token-here'"
    exit 1
fi

if [ -z "$TEST_MEDIA_ID" ]; then
    echo "⚠️  Warning: TEST_MEDIA_ID not set, using default test media ID"
    export TEST_MEDIA_ID="64f1a2b3c4d5e6f7g8h9i0j1"
fi

# Install required dependencies if not already installed
echo "📦 Checking dependencies..."
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is required but not installed"
    exit 1
fi

if ! npm list axios &> /dev/null; then
    echo "📦 Installing axios..."
    npm install axios
fi

if ! npm list socket.io-client &> /dev/null; then
    echo "📦 Installing socket.io-client..."
    npm install socket.io-client
fi

# Run the test suite
echo "🧪 Running test suite..."
node test-like-and-save-implementation.js

# Check exit code
if [ $? -eq 0 ]; then
    echo "✅ All tests passed!"
else
    echo "❌ Some tests failed. Check the output above for details."
    exit 1
fi

