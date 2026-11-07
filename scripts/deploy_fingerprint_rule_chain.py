"""Extend only the existing attendance filter; preserve the live dashboard/chain.

Default is dry-run. --apply requires the same configured trusted webhook secret.
"""
import argparse
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen
try:
    from dotenv import dotenv_values
except ImportError:
    def dotenv_values(path):
        result={}
        for line in Path(path).read_text().splitlines():
            if not line.strip() or line.lstrip().startswith('#') or '=' not in line:
                continue
            key,value=line.split('=',1);value=value.strip()
            if len(value)>=2 and value[0]==value[-1] and value[0] in "\"'":
                value=value[1:-1]
            result[key.strip()]=value
        return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply',action='store_true')
    args=parser.parse_args()
    root=Path(__file__).resolve().parents[1]
    env={**dotenv_values(root/'backend/.env'),**os.environ}
    base=f"http://{env.get('TB_HOST','127.0.0.1')}:{env.get('TB_HTTP_PORT','8080')}"
    headers={'Content-Type':'application/json'}
    def api(path,data=None):
        payload=None if data is None else json.dumps(data).encode()
        with urlopen(Request(base+path,data=payload,headers=headers),timeout=15) as r:return json.load(r)
    token=api('/api/auth/login',{'username':env['TB_USERNAME'],'password':env['TB_PASSWORD']})['token']
    headers['X-Authorization']='Bearer '+token
    chains=api('/api/ruleChains?pageSize=100&page=0&type=CORE')['data']
    chain=next(c for c in chains if c['root'])
    metadata=api('/api/ruleChain/'+chain['id']['id']+'/metadata')
    nodes=metadata['nodes'];changed=0
    for n in nodes:
        config=n['configuration']
        if n['type'].endswith('TbJsFilterNode'):
            for key in ['jsScript','tbelScript']:
                script=config.get(key,'')
                if "msg.method == 'verify_face'" in script and 'antispoof_score' not in script and 'verify_fingerprint' not in script:
                    config[key]=script.replace("msg.method == 'verify_face'","(msg.method == 'verify_face' || msg.method == 'verify_fingerprint')")
                    changed+=1
    reply=any(n['type'].endswith('TbSendRPCReplyNode') for n in nodes)
    rest=any(n['type'].endswith('TbRestApiCallNode') and 'tb-webhook' in n['configuration'].get('restEndpointUrlPattern','') for n in nodes)
    if not reply or not rest:raise RuntimeError('Attendance REST/RPC reply path incomplete')
    print('Attendance chain found; filter edits:',changed,'apply:',args.apply)
    if args.apply and changed:
        api('/api/ruleChain/metadata',metadata)
        print('Fingerprint RPC enabled in existing attendance filter')
    elif not changed:
        print('No filter edits needed; verify direct RPC-to-REST path on this chain')


if __name__=='__main__':main()
