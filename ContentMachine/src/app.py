from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import appsecrets
import text_machine as text_machine

app = Flask(__name__)
CORS(app)

@app.route('/api/linkedin', methods=['GET'])
def linkedin_callback():
    auth_code = request.args.get('authCode')
    params = {
        'code': auth_code,
        'grant_type': 'authorization_code',
        'redirect_uri': 'http://localhost:4200/linkedin-callback',
        'client_id': appsecrets.LINKEDIN_CLIENT_ID,
        'client_secret': appsecrets.LINKEDIN_CLIENT_SECRET
    }
    
    try:
        response = requests.post('https://www.linkedin.com/oauth/v2/accessToken', data=params)
        print("🚀 ~ response:", response.json())
        
        return jsonify({'message': 'success', 'data': response.json()}), 200
    except Exception as e:
        print("🚀 ~ error:", str(e))
        return jsonify({ 'message': 'error', 'error': str(e) }), 500

@app.route('/api/facebook/callback', methods=['GET'])
def facebook_callback():
    auth_code = request.args.get('authCode')
    params = {
        'client_id': appsecrets.FACEBOOK_CLIENT_ID,
        'client_secret': appsecrets.FACEBOOK_CLIENT_SECRET,
        'redirect_uri': 'http://localhost:4200/facebook-callback',
        'code': auth_code
    }
    
    try:
        response = requests.get('https://graph.facebook.com/v15.0/oauth/access_token', params=params)
        print("🚀 ~ response:", response.json())
        
        token = response.json()['access_token']
        # Use the access token for further API requests or save it for later use
        
        return jsonify({
            'message': 'success',
            'data': {'accessToken': token}
        }), 200
    except Exception as e:
        print("🚀 ~ error:", str(e))
        return jsonify({ 'Authentication failed.', 500 })

@app.route('/api/schedule-text-posts', methods=['POST'])
def text_to_content():
    data = request.json
    userUuid = data['userUuid']
    content = data['content']
    image = data['image']
    
    bool_result = text_machine.process_text(userUuid, content, image)

    return jsonify(result=bool_result)

if __name__ == '__main__':
    app.run(debug=True)