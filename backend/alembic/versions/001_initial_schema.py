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
    # users
    op.create_table(
        'users',
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('display_name', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('last_seen', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('email'),
    )

    # history_entries
    op.create_table(
        'history_entries',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_email', sa.String(), nullable=True),
        sa.Column('filename', sa.String(), nullable=True),
        sa.Column('original_path', sa.String(), nullable=True),
        sa.Column('transcript', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('options', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('speaker_count', sa.Integer(), nullable=True),
        sa.Column('word_count', sa.Integer(), nullable=True),
        sa.Column('ai_inferred_speakers', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('minutes', sa.Text(), nullable=True),
        sa.Column('transcribed_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_email'], ['users.email'], ),
        sa.PrimaryKeyConstraint('id'),
    )

    # presets
    op.create_table(
        'presets',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_email', sa.String(), nullable=True),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('options', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_email'], ['users.email'], ),
        sa.PrimaryKeyConstraint('id'),
    )

    # vocabulary_categories
    op.create_table(
        'vocabulary_categories',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('is_system', sa.Boolean(), nullable=True),
        sa.Column('user_email', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    # vocabularies
    op.create_table(
        'vocabularies',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('category_id', sa.String(), nullable=True),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('terms', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('is_system', sa.Boolean(), nullable=True),
        sa.Column('user_email', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['category_id'], ['vocabulary_categories.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )

    # jobs
    op.create_table(
        'jobs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_email', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('result', sa.Text(), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_email'], ['users.email'], ),
        sa.PrimaryKeyConstraint('id'),
    )

    # Seed system vocabulary categories
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
