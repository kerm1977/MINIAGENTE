"""Autenticación: registro, login y logout con bcrypt + Flask-Login."""
from flask import Blueprint, flash, redirect, render_template, request, url_for
from flask_bcrypt import Bcrypt
from flask_login import current_user, login_required, login_user, logout_user

import db
import validators

bp = Blueprint("auth", __name__)
bcrypt = Bcrypt()


def _validar_form(data):
    """Aplica las reglas de validators.py; devuelve dict de errores."""
    errores = {}
    try:
        data["username"] = validators.validate("nombre", data.get("username", ""))
    except validators.RuleError as e:
        errores["username"] = str(e)
    try:
        data["email"] = validators.validate("email", data.get("email", ""))
    except validators.RuleError as e:
        errores["email"] = str(e)
    try:
        validators.validate("password", data.get("password", ""))
    except validators.RuleError as e:
        errores["password"] = str(e)
    return errores


@bp.route("/registro", methods=["GET", "POST"])
def registro():
    if current_user.is_authenticated:
        return redirect(url_for("main.index"))
    errores = {}
    if request.method == "POST":
        data = request.form.to_dict()
        errores = _validar_form(data)
        if not errores:
            if db.User.query.filter_by(username=data["username"]).first():
                errores["username"] = "Ese nombre de usuario ya existe"
            elif db.User.query.filter_by(email=data["email"]).first():
                errores["email"] = "Ese correo ya está registrado"
            else:
                user = db.User(
                    username=data["username"],
                    email=data["email"],
                    password_hash=bcrypt.generate_password_hash(
                        data["password"]
                    ).decode("utf-8"),
                )
                db.session.add(user)
                db.session.commit()
                login_user(user)
                flash("Cuenta creada correctamente", "success")
                return redirect(url_for("main.index"))
    return render_template("auth.html", modo="registro", errores=errores,
                           form=request.form if request.method == "POST" else {})


@bp.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("main.index"))
    error = None
    if request.method == "POST":
        ident = request.form.get("ident", "").strip()
        user = db.User.query.filter(
            (db.User.email == ident.lower()) | (db.User.username == ident)
        ).first()
        if user and bcrypt.check_password_hash(
            user.password_hash, request.form.get("password", "")
        ):
            login_user(user)
            return redirect(url_for("main.index"))
        error = "Credenciales inválidas"
    return render_template("auth.html", modo="login", error=error,
                           form=request.form if request.method == "POST" else {})


@bp.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("main.index"))
