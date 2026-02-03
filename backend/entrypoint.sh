#!/bin/bash
set -e

echo "Waiting for database connection..."
python << END
import time
import psycopg2
import os

max_attempts = 30
attempt = 0

while attempt < max_attempts:
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        conn.close()
        print("Database is ready!")
        break
    except psycopg2.OperationalError:
        attempt += 1
        print(f"Attempt {attempt}/{max_attempts}: Database not ready, waiting...")
        time.sleep(2)
else:
    print("Could not connect to database!")
    exit(1)
END

echo "Running database migrations..."
python << END
import psycopg2
import os

# Check if alembic_version table exists
conn = psycopg2.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()

# Check if this is a fresh database or existing one
cur.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'alembic_version')")
has_alembic = cur.fetchone()[0]

cur.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')")
has_users = cur.fetchone()[0]

conn.close()

if has_users and not has_alembic:
    print("Existing database detected without migration history. Stamping with initial migration...")
    import subprocess
    subprocess.run(['alembic', 'stamp', '001'], check=True)
    print("Database stamped. Future migrations will be applied normally.")
else:
    print("Running migrations...")

END

alembic upgrade head

echo "Starting application..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
