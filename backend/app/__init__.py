from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO

jwt = JWTManager()
socketio = SocketIO(cors_allowed_origins="*", async_mode="eventlet")

def create_app():
    print("[App] Creating Flask app")
    app = Flask(__name__)

    # JWT Configurations
    app.config['JWT_SECRET_KEY'] = 'your_jwt_secret_key'
    app.config["JWT_TOKEN_LOCATION"] = ["headers"]
    app.config["JWT_HEADER_NAME"] = "Authorization"
    app.config["JWT_HEADER_TYPE"] = "Bearer"

    # CORS Configuration
    CORS(app, supports_credentials=True, allow_headers=["Content-Type", "Authorization"])

    # Initialize JWT
    jwt.init_app(app)

    # Optional: Improve error visibility for debugging
    @jwt.unauthorized_loader
    def unauthorized_response(callback):
        print("[JWT] Missing or invalid token")
        return jsonify({"msg": "Missing or invalid JWT"}), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(err):
        print("[JWT] Invalid token:", err)
        return jsonify({"msg": "Invalid JWT"}), 422

    # Register Blueprints
    from app.auth.routes import auth_bp
    app.register_blueprint(auth_bp, url_prefix='/api/auth')

    # Init SocketIO
    socketio.init_app(app)

    # Register socket handlers
    from app.chat.socket import register_socketio_events
    register_socketio_events(socketio)

    print("[APP] app created, blueprints registered, socket events ready")
    return app
