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
        if 'targetUserId' in data:
            target_sid = connected_users.get(str(data['targetUserId']))
            if target_sid:
                emit('screen-sharing-started', room=target_sid)

    @socketio.on('screen-sharing-stopped')
    def handle_screen_sharing_stopped(data):
        """Handle screen sharing stop event"""
        if 'targetUserId' in data:
            target_sid = connected_users.get(str(data['targetUserId']))
            if target_sid:
                emit('screen-sharing-stopped', room=target_sid)

    @socketio.on('screen-share-offer')
    def handle_screen_share_offer(data):
        print(f"[WebRTC] Received offer from {request.sid}")
        
        # Find sender's user ID
        from_user_id = None
        for uid, sid in connected_users.items():
            if sid == request.sid:
                from_user_id = uid
                break
        
        target_sid = connected_users.get(str(data['targetUserId']))
        if target_sid and from_user_id:
            print(f"[WebRTC] Forwarding offer from {from_user_id} to {target_sid}")
            emit('screen-share-offer', {
                'offer': data['offer'],
                'targetUserId': data['targetUserId'],
                'from': from_user_id
            }, room=target_sid)
        else:
            print(f"[WebRTC] Target user not found or sender unknown")
            emit('error', {'message': 'Failed to establish connection'}, room=request.sid)

    @socketio.on('screen-share-answer')
    def handle_screen_share_answer(data):
        print(f"[WebRTC] Received answer for target user ID: {data.get('targetUserId')}")
        print(f"[WebRTC] Answer: {data.get('answer')}")
        target_sid = connected_users.get(str(data['targetUserId']))
        if target_sid:
            print(f"[WebRTC] Forwarding answer to {target_sid}")
            emit('screen-share-answer', {
                'answer': data['answer']
            }, room=target_sid)
        else:
            print(f"[WebRTC] Target user not found: {data['targetUserId']}")

    @socketio.on('ice-candidate')
    def handle_ice_candidate(data):
        print(f"[WebRTC] Forwarding ICE candidate: {data.get('candidate')}")
        print(f"[WebRTC] Target user ID: {data.get('targetUserId')}")
        target_sid = connected_users.get(str(data['targetUserId']))
        if target_sid:
            print(f"[WebRTC] Forwarding ICE candidate to SID: {target_sid}")
            emit('ice-candidate', {
                'candidate': data['candidate']
            }, room=target_sid)
        else:
            print(f"[WebRTC] Target user not found for ICE candidate")
