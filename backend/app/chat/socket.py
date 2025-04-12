from flask_socketio import emit, join_room, leave_room
from flask_jwt_extended import decode_token
from flask import request
import time
from app.database import get_db_connection

connected_users = {}  # Maps user_id to socket session ID

def register_socketio_events(socketio):

    @socketio.on('connect')
    def handle_connect():
        print(f"[Socket] New connection from {request.sid}")
        token = request.args.get("token")
        user_id = request.args.get("userId")
        
        if not token or not user_id:
            print("[Socket] No token or userId provided")
            return False

        try:
            # Just validate the token, don't use its contents
            decode_token(token)
            connected_users[str(user_id)] = request.sid
            join_room(request.sid)
            print(f"[Socket] User {user_id} connected with SID {request.sid}")
            return True
            
        except Exception as e:
            print(f"[Socket] Token validation failed: {e}")
            return False

    @socketio.on('disconnect')
    def handle_disconnect():
        user_id = None
        for uid, sid in connected_users.items():
            if sid == request.sid:
                user_id = uid
                break
        if user_id:
            del connected_users[user_id]
            print(f"[Socket] User {user_id} disconnected")

    @socketio.on('private_message')
    def handle_private_message(data):
        """Handle private messages between users"""
        print(f"[Socket] Received private_message data: {data}")

        try:
            from_user_id = str(data['from'])
            to_user_id = str(data['to'])
            text = data['text']
            timestamp = int(time.time())

            # Store message in database
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO messages (from_user_id, to_user_id, text, timestamp)
                VALUES (?, ?, ?, ?)
            ''', (from_user_id, to_user_id, text, timestamp))
            conn.commit()
            conn.close()

            if to_user_id in connected_users:
                emit("private_message", {
                    "from": from_user_id,
                    "text": text,
                    "timestamp": timestamp
                }, room=connected_users[to_user_id])
                print(f"[Socket] Sent message to user {to_user_id}")
            else:
                print(f"[Socket] User {to_user_id} is offline, message stored")

        except Exception as e:
            print(f"[Socket] Error handling private_message: {e}")
            emit("error", {"message": str(e)})

    @socketio.on('screen-sharing-started')
    def handle_screen_sharing_started(data):
        """Handle screen sharing start event"""
        target_user_id = str(data.get('targetUserId'))
        from_user_id = str(data.get('fromUserId'))
        target_sid = connected_users.get(target_user_id)
        
        if target_sid:
            emit('screen-sharing-started', {
                'fromUserId': from_user_id,
                'hasAudio': data.get('hasAudio', False),
                'hasVideo': data.get('hasVideo', True)
            }, room=target_sid)
            print(f"[WebRTC] Screen sharing started from {from_user_id} to {target_user_id}")

    @socketio.on('screen-sharing-stopped')
    def handle_screen_sharing_stopped(data):
        """Handle screen sharing stop event"""
        if 'targetUserId' in data:
            target_sid = connected_users.get(str(data['targetUserId']))
            if target_sid:
                emit('screen-sharing-stopped', room=target_sid)

    @socketio.on('screen-share-offer')
    def handle_screen_share_offer(data):
        print(f"[WebRTC] Received offer data: {data}")
        from_user_id = data.get('fromUserId')
        target_user_id = str(data.get('targetUserId'))
        
        if not from_user_id or not target_user_id:
            print("[WebRTC] Missing user IDs")
            emit('error', {'message': 'Invalid user IDs'}, room=request.sid)
            return

        target_sid = connected_users.get(target_user_id)
        if target_sid:
            print(f"[WebRTC] Forwarding offer from {from_user_id} to {target_user_id}")
            emit('screen-share-offer', {
                'offer': data['offer'],
                'fromUserId': from_user_id
            }, room=target_sid)
        else:
            print(f"[WebRTC] Target user {target_user_id} not found")
            emit('error', {'message': 'Target user not connected'}, room=request.sid)

    @socketio.on('screen-share-answer')
    def handle_screen_share_answer(data):
        print(f"[WebRTC] Received answer data: {data}")
        target_sid = connected_users.get(str(data['targetUserId']))
        
        if target_sid:
            emit('screen-share-answer', {
                'answer': data['answer'],
                'fromUserId': data.get('fromUserId')
            }, room=target_sid)
        else:
            emit('error', {'message': 'Target user not connected'}, room=request.sid)

    @socketio.on('ice-candidate')
    def handle_ice_candidate(data):
        print(f"[WebRTC] Forwarding ICE candidate from {data.get('fromUserId')}")
        target_sid = connected_users.get(str(data['targetUserId']))
        if target_sid:
            emit('ice-candidate', {
                'candidate': data['candidate'],
                'fromUserId': data['fromUserId']
            }, room=target_sid)
        else:
            print(f"[WebRTC] Target user not found for ICE candidate")
