#!/usr/bin/env python3
"""App Store Connect'teki derlemelerin ve TestFlight test gruplarının durumu (yalnızca okur).

Ortam: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH, BUNDLE_ID
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from asc_signing import call  # noqa: E402


def safe(path):
    try:
        return call('GET', path)
    except RuntimeError as e:
        print('  (okunamadı)', str(e)[:300])
        return {'data': [], 'included': []}


ident = os.environ['BUNDLE_ID']
apps = call('GET', f'/apps?filter[bundleId]={ident}')['data']
if not apps:
    sys.exit(f'{ident} için App Store Connect uygulaması yok')
app = apps[0]
print(f"Uygulama: {app['attributes']['name']} ({app['id']})")

print('\n== Yüklemeler (buildUploads) ==')
for u in safe(f"/apps/{app['id']}/buildUploads?limit=10").get('data', []):
    a = u['attributes']
    print(f"  {a.get('cfBundleShortVersionString')} ({a.get('cfBundleVersion')}) durum={a.get('state')} "
          f"yüklendi={a.get('uploadedDate') or a.get('createdDate')}")
    for k in ('errors', 'warnings', 'infos'):
        for m in (a.get('state') or {}).get(k, []) if isinstance(a.get('state'), dict) else a.get(k) or []:
            print(f"    {k}: {m}")

print('\n== Derlemeler ==')
builds = safe(f"/builds?filter[app]={app['id']}&sort=-uploadedDate&limit=10&include=buildBetaDetail,preReleaseVersion")
inc = {(i['type'], i['id']): i['attributes'] for i in builds.get('included', [])}
if not builds['data']:
    print('  Hiç derleme yok (Apple yüklemeyi reddettiyse hesap e-postasına "ITMS-" hatası gelir)')
for b in builds['data']:
    a = b['attributes']
    rel = b.get('relationships', {})
    beta = inc.get(('buildBetaDetails', (rel.get('buildBetaDetail', {}).get('data') or {}).get('id')), {})
    ver = inc.get(('preReleaseVersions', (rel.get('preReleaseVersion', {}).get('data') or {}).get('id')), {})
    print(f"  {ver.get('version', '?')} ({a['version']}): işleme={a['processingState']} "
          f"dahili={beta.get('internalBuildState')} harici={beta.get('externalBuildState')} "
          f"şifreleme_beyanı={a.get('usesNonExemptEncryption')} süresi_doldu={a.get('expired')} yüklendi={a['uploadedDate']}")

print('\n== TestFlight grupları ==')
groups = safe(f"/apps/{app['id']}/betaGroups?limit=50")['data']
if not groups:
    print('  Hiç test grubu yok → App Store Connect → TestFlight → Dahili Test → ➕')
for g in groups:
    a = g['attributes']
    testers = safe(f"/betaGroups/{g['id']}/betaTesters?limit=50")['data']
    gb = safe(f"/betaGroups/{g['id']}/builds?limit=20")['data']
    print(f"  {a['name']}: dahili={a.get('isInternalGroup')} tüm_derlemeler_otomatik={a.get('hasAccessToAllBuilds')} "
          f"test_eden={len(testers)} gruptaki_derleme={len(gb)}")
    for t in testers:
        ta = t['attributes']
        print(f"    - {ta.get('email')} davet={ta.get('state')}")
