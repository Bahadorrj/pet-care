"""add username

Revision ID: ec3b31a074c4
Revises: 0001
Create Date: 2026-06-20 00:09:37.122299

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ec3b31a074c4'
down_revision: Union[str, Sequence[str], None] = '0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add username column (not-null, unique) to users table."""
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('username', sa.String(length=30), nullable=False))
        batch_op.create_unique_constraint('uq_users_username', ['username'])


def downgrade() -> None:
    """Remove username column from users table."""
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_constraint('uq_users_username', type_='unique')
        batch_op.drop_column('username')
