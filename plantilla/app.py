"""App Flask de la mega plantilla — ver REGLAS.md."""
import os

from flask import Flask
from flask_cors import CORS
from flask_login import LoginManager
from flask_migrate import Migrate
from flask_wtf.csrf import CSRFProtect

import db
import ota
from config import SECRET_KEY
from routes import api, auth, data, main

login_manager = LoginManager()
login_manager.login_view = "auth.login"
login_manager.login_message = "Inicia sesión para continuar"
csrf = CSRFProtect()


def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = SECRET_KEY
    app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024
    CORS(app)

    db.init_app(app)
    Migrate(app, db.sa)
    auth.bcrypt.init_app(app)
    login_manager.init_app(app)
    csrf.init_app(app)
    csrf.exempt(api.bp)
    csrf.exempt(data.bp)
    csrf.exempt(ota.bp)

    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(db.User, int(user_id))

    app.register_blueprint(main.bp)
    app.register_blueprint(auth.bp)
    app.register_blueprint(api.bp)
    app.register_blueprint(data.bp)
    app.register_blueprint(ota.bp)
    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", 51793)))
