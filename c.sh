#!/bin/bash

echo "Cleaning old generated JavaScript files..."

# Remove compiled output folder
rm -rf dist

echo "Recompiling TypeScript..."

# Run TypeScript compiler
npm run build

if [ $? -eq 0 ]; then
  echo "Build completed successfully."
else
  echo "Build failed."
  exit 1
fi