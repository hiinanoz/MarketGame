"""App Store Connect API (JWT ile). Ortam: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH. Gerekenler: pip install pyjwt cryptography"""
import json
import os
import time
import urllib.error
import urllib.request

import jwt

API = 'https://api.appstoreconnect.apple.com/v1'


def token():
    key = open(os.environ['ASC_KEY_PATH']).read()
    now = int(time.time())
    return jwt.encode({'iss': os.environ['ASC_ISSUER_ID'], 'iat': now, 'exp': now + 1100, 'aud': 'appstoreconnect-v1'},
                      key, algorithm='ES256', headers={'kid': os.environ['ASC_KEY_ID'], 'typ': 'JWT'})


def call(method, path, body=None):
    req = urllib.request.Request(API + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Authorization': 'Bearer ' + token(), 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors='replace')
        raise RuntimeError(f'{method} {path} → HTTP {e.code}: {detail}') from None
