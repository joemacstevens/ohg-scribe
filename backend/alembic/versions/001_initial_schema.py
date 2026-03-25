"""initial_schema

Revision ID: 001_initial_schema
Revises:
Create Date: 2025-03-25

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # users — matches models.User exactly
    op.create_table(
        'users',
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('email'),
    )

    # history_entries — matches models.HistoryEntry exactly
    op.create_table(
        'history_entries',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_email', sa.String(), nullable=False),
        sa.Column('filename', sa.String(), nullable=False),
        sa.Column('transcribed_at', sa.DateTime(), nullable=True),
        sa.Column('speaker_count', sa.Integer(), nullable=True),
        sa.Column('word_count', sa.Integer(), nullable=True),
        sa.Column('data', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.ForeignKeyConstraint(['user_email'], ['users.email'], ),
        sa.PrimaryKeyConstraint('id'),
    )

    # presets — matches models.Preset exactly
    op.create_table(
        'presets',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_email', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('options', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_email'], ['users.email'], ),
        sa.PrimaryKeyConstraint('id'),
    )

    # vocabulary_categories — matches models.VocabularyCategory exactly
    op.create_table(
        'vocabulary_categories',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('is_system', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('user_email', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    # vocabularies — matches models.Vocabulary exactly
    op.create_table(
        'vocabularies',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('category_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('terms', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('is_system', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('user_email', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['category_id'], ['vocabulary_categories.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )

    # jobs — matches models.Job exactly
    op.create_table(
        'jobs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_email', sa.String(), nullable=False),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('result', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_email'], ['users.email'], ),
        sa.PrimaryKeyConstraint('id'),
    )

    # Seed system vocabulary categories (no user FK — they are system-wide)
    op.execute("""
        INSERT INTO vocabulary_categories (id, name, is_system, user_email)
        VALUES
            ('pharmaceuticals', 'Pharmaceuticals', true, null),
            ('medical-conditions', 'Medical Conditions', true, null),
            ('procedures', 'Procedures & Treatments', true, null),
            ('organizations', 'Organizations & Companies', true, null),
            ('my-vocabularies', 'My Vocabularies', false, null)
        ON CONFLICT (id) DO NOTHING;
    """)


def downgrade() -> None:
    op.drop_table('jobs')
    op.drop_table('vocabularies')
    op.drop_table('vocabulary_categories')
    op.drop_table('presets')
    op.drop_table('history_entries')
    op.drop_table('users')
