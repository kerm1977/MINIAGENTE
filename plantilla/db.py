"""SQLite embebido con Flask-SQLAlchemy: usuarios, sesiones, snippets."""
import time

from flask_login import UserMixin
from flask_sqlalchemy import SQLAlchemy

from config import DATABASE_URL

sa = SQLAlchemy()
session = sa.session


class User(UserMixin, sa.Model):
    __tablename__ = "users"
    id = sa.Column(sa.Integer, primary_key=True)
    username = sa.Column(sa.String(80), unique=True, nullable=False)
    email = sa.Column(sa.String(120), unique=True, nullable=False)
    password_hash = sa.Column(sa.String(255), nullable=False)
    created_at = sa.Column(sa.Float, default=time.time)


class Session(sa.Model):
    __tablename__ = "sessions"
    id = sa.Column(sa.Integer, primary_key=True)
    user_id = sa.Column(sa.Integer, sa.ForeignKey("users.id"), nullable=True)
    title = sa.Column(sa.String(120), default="Sin título")
    model = sa.Column(sa.String(120), default="")
    created_at = sa.Column(sa.Float, default=time.time)


class Message(sa.Model):
    __tablename__ = "messages"
    id = sa.Column(sa.Integer, primary_key=True)
    session_id = sa.Column(sa.Integer, sa.ForeignKey("sessions.id"), nullable=False)
    role = sa.Column(sa.String(20), nullable=False)
    content = sa.Column(sa.Text, nullable=False)
    created_at = sa.Column(sa.Float, default=time.time)


class Snippet(sa.Model):
    __tablename__ = "snippets"
    id = sa.Column(sa.Integer, primary_key=True)
    title = sa.Column(sa.String(120), default="")
    lang = sa.Column(sa.String(40), default="")
    content = sa.Column(sa.Text, nullable=False)
    created_at = sa.Column(sa.Float, default=time.time)


class Template(sa.Model):
    __tablename__ = "templates"
    id = sa.Column(sa.Integer, primary_key=True)
    name = sa.Column(sa.String(120), unique=True, nullable=False)
    description = sa.Column(sa.String(300), default="")
    content = sa.Column(sa.Text, nullable=False)
    created_at = sa.Column(sa.Float, default=time.time)


def init_app(app):
    app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    sa.init_app(app)
    with app.app_context():
        sa.create_all()
