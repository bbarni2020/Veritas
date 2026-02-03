"""Add post format columns

Revision ID: 002
Revises: 001
Create Date: 2026-02-03 00:00:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE posts ADD COLUMN IF NOT EXISTS mp4_url VARCHAR(1024)")
    op.execute("ALTER TABLE posts ADD COLUMN IF NOT EXISTS webm_url VARCHAR(1024)")
    op.execute("ALTER TABLE posts ADD COLUMN IF NOT EXISTS hls_url VARCHAR(1024)")
    op.execute("ALTER TABLE posts ADD COLUMN IF NOT EXISTS processing_status VARCHAR(50)")


def downgrade() -> None:
    op.execute("ALTER TABLE posts DROP COLUMN IF EXISTS processing_status")
    op.execute("ALTER TABLE posts DROP COLUMN IF EXISTS hls_url")
    op.execute("ALTER TABLE posts DROP COLUMN IF EXISTS webm_url")
    op.execute("ALTER TABLE posts DROP COLUMN IF EXISTS mp4_url")
