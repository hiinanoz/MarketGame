#!/usr/bin/env python3
"""TestFlight için geçici imza (GitHub Actions).

Otomatik imza arşivde geliştirme profili ister; o da takımda kayıtlı cihaz ister.
Bunun yerine App Store Connect API ile her çalıştırmada geçici bir dağıtım sertifikası
ve App Store profili oluşturulur (cihaz gerekmez), iş bitince ikisi de silinir.

  asc_signing.py setup    → sertifika + profil + p12 + ExportOptions, proje Release ayarları manuel imzaya
  asc_signing.py cleanup  → profili sil, sertifikayı iptal et (her durumda çalıştırılır)

Ortam: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH, APPLE_TEAM_ID, BUNDLE_ID, RUNNER_TEMP, GITHUB_ENV
Gerekenler: pip install pyjwt cryptography
"""
import base64
import json
import os
import plistlib
import secrets
import sys
import time
import urllib.error
import urllib.request

import jwt
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID

API = 'https://api.appstoreconnect.apple.com/v1'
TMP = os.environ.get('RUNNER_TEMP', '/tmp')
STATE = os.path.join(TMP, 'asc-signing.json')
PROJECT = 'apple/ios/App/App.xcodeproj/project.pbxproj'
APP_RELEASE = '504EC3181FED79650016851F /* Release */'


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


def env_out(**kv):
    with open(os.environ['GITHUB_ENV'], 'a') as f:
        for k, v in kv.items():
            f.write(f'{k}={v}\n')


def bundle_id(identifier):
    res = call('GET', f'/bundleIds?filter[identifier]={identifier}&limit=200')
    for b in res['data']:
        if b['attributes']['identifier'] == identifier and b['attributes']['platform'] in ('IOS', 'UNIVERSAL'):
            return b['id']
    raise RuntimeError(f'Bundle ID {identifier} bu takımda kayıtlı değil (developer.apple.com → Identifiers)')


def ensure_capabilities(bid):
    """Profil, yetkileri (entitlements) App ID'den alır: Game Center ve iCloud açık olmalı."""
    have = {c['attributes']['capabilityType'] for c in call('GET', f'/bundleIds/{bid}/bundleIdCapabilities')['data']}
    want = {
        'GAME_CENTER': None,
        'ICLOUD': [{'key': 'ICLOUD_VERSION', 'options': [{'key': 'XCODE_6'}]}],
    }
    for cap, settings in want.items():
        if cap in have:
            continue
        attrs = {'capabilityType': cap}
        if settings:
            attrs['settings'] = settings
        print(f'App ID yeteneği açılıyor: {cap}')
        call('POST', '/bundleIdCapabilities', {'data': {
            'type': 'bundleIdCapabilities', 'attributes': attrs,
            'relationships': {'bundleId': {'data': {'type': 'bundleIds', 'id': bid}}}}})


def patch_project(profile_name, team):
    """Yalnızca App hedefinin Release ayarı manuel imzaya geçer (SPM paketlerine dokunulmaz)."""
    src = open(PROJECT).read()
    start = src.index(APP_RELEASE)
    end = src.index('name = Release;', start)
    block = src[start:end]
    assert 'CODE_SIGN_STYLE = Automatic;' in block
    block = block.replace('CODE_SIGN_STYLE = Automatic;', '\n\t\t\t\t'.join([
        'CODE_SIGN_STYLE = Manual;',
        '"CODE_SIGN_IDENTITY[sdk=iphoneos*]" = "Apple Distribution";',
        f'DEVELOPMENT_TEAM = {team};',
        f'PROVISIONING_PROFILE_SPECIFIER = "{profile_name}";',
    ]))
    open(PROJECT, 'w').write(src[:start] + block + src[end:])


def setup():
    team = os.environ['APPLE_TEAM_ID']
    ident = os.environ['BUNDLE_ID']
    state = {}

    bid = bundle_id(ident)
    ensure_capabilities(bid)

    # Sertifika: anahtar ve CSR burada üretilir, özel anahtar çalıştırıcıdan çıkmaz.
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    csr = (x509.CertificateSigningRequestBuilder()
           .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'GitHub Actions'),
                                    x509.NameAttribute(NameOID.COUNTRY_NAME, 'US')]))
           .sign(key, hashes.SHA256()))
    try:
        cert = call('POST', '/certificates', {'data': {'type': 'certificates', 'attributes': {
            'certificateType': 'DISTRIBUTION',
            'csrContent': csr.public_bytes(serialization.Encoding.PEM).decode()}}})['data']
    except RuntimeError as e:
        if 'HTTP 409' in str(e):
            raise RuntimeError('Dağıtım sertifikası sınırı dolu: developer.apple.com → Certificates bölümünden '
                               'kullanılmayan "Apple Distribution" sertifikalarından birini iptal et.\n' + str(e)) from None
        raise
    state['cert'] = cert['id']
    json.dump(state, open(STATE, 'w'))
    der = base64.b64decode(cert['attributes']['certificateContent'])

    # Eski macOS anahtarlıkları da açabilsin diye 3DES/SHA1 p12
    password = secrets.token_hex(16)
    print('::add-mask::' + password)
    enc = (serialization.PrivateFormat.PKCS12.encryption_builder().kdf_rounds(50000)
           .key_cert_algorithm(pkcs12.PBES.PBESv1SHA1And3KeyTripleDESCBC)
           .hmac_hash(hashes.SHA1()).build(password.encode()))
    p12 = pkcs12.serialize_key_and_certificates(b'dist', key, x509.load_der_x509_certificate(der), None, enc)
    p12_path = os.path.join(TMP, 'dist.p12')
    open(p12_path, 'wb').write(p12)

    name = f'CI AppStore {ident} {int(time.time())}'
    prof = call('POST', '/profiles', {'data': {
        'type': 'profiles', 'attributes': {'name': name, 'profileType': 'IOS_APP_STORE'},
        'relationships': {'bundleId': {'data': {'type': 'bundleIds', 'id': bid}},
                          'certificates': {'data': [{'type': 'certificates', 'id': cert['id']}]}}}})['data']
    state['profile'] = prof['id']
    json.dump(state, open(STATE, 'w'))
    uuid = prof['attributes']['uuid']
    content = base64.b64decode(prof['attributes']['profileContent'])
    for d in ('~/Library/MobileDevice/Provisioning Profiles', '~/Library/Developer/Xcode/UserData/Provisioning Profiles'):
        d = os.path.expanduser(d)
        os.makedirs(d, exist_ok=True)
        open(os.path.join(d, uuid + '.mobileprovision'), 'wb').write(content)

    plistlib.dump({
        'method': 'app-store-connect', 'destination': 'upload', 'signingStyle': 'manual', 'teamID': team,
        'signingCertificate': 'Apple Distribution', 'provisioningProfiles': {ident: name},
        'manageAppVersionAndBuildNumber': False,
    }, open('ExportOptions.plist', 'wb'))

    patch_project(name, team)
    print(f'Sertifika {cert["id"]}, profil "{name}" ({uuid}) hazır')
    env_out(SIGN_P12=p12_path, SIGN_P12_PASSWORD=password)


def cleanup():
    if not os.path.exists(STATE):
        return
    state = json.load(open(STATE))
    for kind in ('profile', 'cert'):
        if kind in state:
            path = ('/profiles/' if kind == 'profile' else '/certificates/') + state[kind]
            try:
                call('DELETE', path)
                print('Silindi:', path)
            except RuntimeError as e:
                print('::warning::' + str(e))


if __name__ == '__main__':
    {'setup': setup, 'cleanup': cleanup}[sys.argv[1]]()
