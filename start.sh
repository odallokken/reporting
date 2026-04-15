#!/bin/sh
set -e

# Auto-generate AUTH_SECRET if not provided.
# The secret is persisted to the data directory so it survives container restarts
# and existing sessions remain valid.
if [ -z "$AUTH_SECRET" ]; then
  SECRET_FILE="/app/prisma/data/.auth_secret"
  if [ -f "$SECRET_FILE" ]; then
    AUTH_SECRET=$(cat "$SECRET_FILE")
  else
    AUTH_SECRET=$(openssl rand -base64 33)
    echo "$AUTH_SECRET" > "$SECRET_FILE"
    chmod 600 "$SECRET_FILE"
  fi
  export AUTH_SECRET
fi

# Run database migrations and start the application
node node_modules/prisma/build/index.js migrate deploy
exec node server.js
