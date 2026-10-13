#!/bin/sh
set -eu

psql \
  --set=ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=app_password="$APP_DB_PASSWORD" <<'SQL'
CREATE ROLE uniflow_app
  LOGIN
  PASSWORD :'app_password'
  NOSUPERUSER
  NOBYPASSRLS;
GRANT ALL PRIVILEGES ON DATABASE uniflow_db TO uniflow_app;
GRANT USAGE, CREATE ON SCHEMA public TO uniflow_app;
SQL
