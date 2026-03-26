#!/bin/sh
set -e

echo "Running database migrations..."
./node_modules/.bin/prisma migrate deploy --schema=apps/bot/prisma/schema.prisma

echo "Starting API server..."
exec node apps/api/dist/index.js
