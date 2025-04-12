from app import create_app, socketio  # we will expose `socketio` from app/__init__.py
from app.database import init_db

app = create_app()

if __name__ == '__main__':
    init_db()
    print("[App] Running Flask-SocketIO app on PORT 5000")
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
