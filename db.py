import os
import sqlite3
import time

DB_PATH = os.environ.get(
    "DB_PATH", os.path.join(os.path.dirname(__file__), "mini_agent.db")
)

SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    model TEXT DEFAULT '',
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS snippets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
    lang TEXT DEFAULT '',
    title TEXT DEFAULT '',
    content TEXT NOT NULL,
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    content TEXT NOT NULL,
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS prefs (
    key TEXT PRIMARY KEY,
    value TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
"""


def _conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init():
    with _conn() as c:
        c.executescript(SCHEMA)


def new_session(title, model=""):
    with _conn() as c:
        cur = c.execute(
            "INSERT INTO sessions(title, model, created_at) VALUES(?,?,?)",
            (title[:120], model, time.time()),
        )
        return cur.lastrowid


def list_sessions():
    with _conn() as c:
        return [dict(r) for r in c.execute(
            "SELECT s.*, COUNT(m.id) AS n_msgs FROM sessions s "
            "LEFT JOIN messages m ON m.session_id = s.id "
            "GROUP BY s.id ORDER BY s.created_at DESC LIMIT 100"
        )]


def get_messages(session_id):
    with _conn() as c:
        return [dict(r) for r in c.execute(
            "SELECT role, content, created_at FROM messages "
            "WHERE session_id = ? ORDER BY id", (session_id,)
        )]


def add_message(session_id, role, content):
    with _conn() as c:
        c.execute(
            "INSERT INTO messages(session_id, role, content, created_at) VALUES(?,?,?,?)",
            (session_id, role, content, time.time()),
        )


def delete_session(session_id):
    with _conn() as c:
        c.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
        c.execute("DELETE FROM sessions WHERE id = ?", (session_id,))


def save_snippet(session_id, lang, title, content):
    with _conn() as c:
        cur = c.execute(
            "INSERT INTO snippets(session_id, lang, title, content, created_at) "
            "VALUES(?,?,?,?,?)",
            (session_id, lang, title[:120], content, time.time()),
        )
        return cur.lastrowid


def list_snippets():
    with _conn() as c:
        return [dict(r) for r in c.execute(
            "SELECT id, session_id, lang, title, created_at, "
            "substr(content,1,80) AS preview FROM snippets "
            "ORDER BY created_at DESC LIMIT 200"
        )]


def get_snippet(snippet_id):
    with _conn() as c:
        row = c.execute("SELECT * FROM snippets WHERE id = ?", (snippet_id,)).fetchone()
        return dict(row) if row else None


def save_template(name, description, content):
    with _conn() as c:
        c.execute(
            "INSERT INTO templates(name, description, content, created_at) "
            "VALUES(?,?,?,?) ON CONFLICT(name) DO UPDATE SET "
            "description=excluded.description, content=excluded.content",
            (name[:120], description, content, time.time()),
        )


def list_templates():
    with _conn() as c:
        return [dict(r) for r in c.execute(
            "SELECT id, name, description, created_at FROM templates ORDER BY name"
        )]


def get_template(name):
    with _conn() as c:
        row = c.execute(
            "SELECT * FROM templates WHERE name = ?", (name,)
        ).fetchone()
        return dict(row) if row else None


def delete_template(name):
    with _conn() as c:
        c.execute("DELETE FROM templates WHERE name = ?", (name,))


def get_prefs():
    with _conn() as c:
        return {r["key"]: r["value"] for r in c.execute("SELECT key, value FROM prefs")}


def set_pref(key, value):
    with _conn() as c:
        c.execute(
            "INSERT INTO prefs(key, value) VALUES(?,?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, str(value)),
        )
