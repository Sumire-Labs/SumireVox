#!/bin/sh
set -e

echo "Running database migrations..."
./apps/bot/node_modules/.bin/prisma migrate deploy --config=apps/bot/prisma.config.ts

echo "Starting API server..."
exec node apps/api/dist/index.js
