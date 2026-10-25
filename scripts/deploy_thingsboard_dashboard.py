"""Deploy the supplied SmartFace dashboard against the current ThingsBoard tenant."""
import os
import copy
import json
from datetime import datetime
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
BASE = "http://127.0.0.1:8081"
OUT = ROOT / "docs" / "assets" / "thingsboard"
HEADERS = {"Content-Type": "application/json"}


def api(path, data=None):
    body = None if data is None else json.dumps(data).encode()
    with urlopen(Request(BASE + path, data=body, headers=HEADERS), timeout=20) as response:
        raw = response.read()
        return json.loads(raw) if raw else None


def save(name, data):
    OUT.mkdir(parents=True, exist_ok=True)
    # Exports are reviewable templates, never commit the live webhook secret.
    redacted = copy.deepcopy(data)
    def scrub(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if key.lower() == 'x-tb-webhook-secret': value[key] = '__CONFIGURE_TB_WEBHOOK_SECRET__'
                else: scrub(child)
        elif isinstance(value, list):
            for child in value: scrub(child)
    scrub(redacted)
    (OUT / name).write_text(json.dumps(redacted, ensure_ascii=False, indent=2) + "\n")


def main():
    global BASE
    env = {**dotenv_values(ROOT / "backend" / ".env"), **os.environ}
    secret = env.get('TB_WEBHOOK_SECRET', '')
    if len(secret) < 24:
        raise SystemExit('Cần TB_WEBHOOK_SECRET >=24 ký tự, giống backend; chưa thay đổi ThingsBoard.')
    host = env.get('TB_HOST', '127.0.0.1')
    port = env.get('TB_HTTP_PORT', '8081')
    BASE = f"http://{host}:{port}"
    HEADERS["X-Authorization"] = "Bearer " + api("/api/auth/login", {
        "username": env["TB_USERNAME"], "password": env["TB_PASSWORD"],
    })["token"]
    device = api("/api/tenant/devices?deviceName=PI4_FRONT_GATE")
    device_id = device["id"]["id"]
    template = json.loads((ROOT / "smartface_dashboard.json").read_text())
    reference = json.loads((ROOT / "smartface_root_rule_chain.json").read_text())
    expected = {"org.thingsboard.rule.engine.rest.TbRestApiCallNode",
                "org.thingsboard.rule.engine.rpc.TbSendRPCReplyNode"}
    assert expected <= {n["type"] for n in reference["metadata"]["nodes"]}

    dashboard = {k: copy.deepcopy(template[k]) for k in
                 ("title", "configuration", "mobileHide", "mobileOrder") if k in template}
    config = dashboard["configuration"]
    aliases = config["entityAliases"]
    for alias in aliases.values():
        alias["filter"]["singleEntity"] = device["id"]
        alias["filter"]["resolveMultiple"] = False

    for widget in config["widgets"].values():
        # Resolve every supplied widget type before changing the server.
        api("/api/widgetType?fqn=" + quote(widget["typeFullFqn"]))
        cfg = widget["config"]
        if widget["type"] == "rpc":
            cfg["targetDeviceId"] = device_id
            cfg["targetDeviceAliasIds"] = list(aliases)
            cfg["settings"].update(retrieveValueMethod="rpc", requestTimeout=10000,
                                   getValueMethod="getValue", setValueMethod="setValue",
                                   parseValueFunction="return data === true;",
                                   convertValueFunction="return value;")
        if widget["typeFullFqn"] == "system.cards.html_value_card":
            html = cfg["settings"]["cardHtml"]
            for old, new in {"${current_mode:CHECK_IN}": "${current_mode}",
                             "${ai_state:SLEEP}": "${ai_state}",
                             "${attendance_latch:READY}": "${attendance_latch}",
                             "${distance:--}": "${distance:1}"}.items():
                html = html.replace(old, new)
            html = html.replace("● ONLINE", "● ${status}")
            html = html.replace("640x480 @ 15fps", "640x480 (cấu hình 15 FPS)")
            cfg["settings"]["cardHtml"] = html
        if widget["type"] == "timeseries":
            if any(k.get("name") == "antispoof_score" for ds in cfg.get("datasources", []) for k in ds.get("dataKeys", [])):
                cfg["title"] = "Liveness Confidence — mỗi lượt gửi RPC"
            elif any(k.get("name") == "distance" for ds in cfg.get("datasources", []) for k in ds.get("dataKeys", [])):
                cfg["title"] = "Cảm Biến Khoảng Cách (HC-SR04)"
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    existing = [d for d in api("/api/tenant/dashboards?pageSize=100&page=0")["data"]
                if d["title"] == dashboard["title"]]
    if existing:
        previous = api("/api/dashboard/" + existing[0]["id"]["id"])
        save(f"dashboard_before_{stamp}.json", previous)
        dashboard["id"] = previous["id"]
        dashboard["version"] = previous["version"]

    chain = next(c for c in api("/api/ruleChains?pageSize=100&page=0&type=CORE")["data"] if c["root"])
    metadata = api("/api/ruleChain/" + chain["id"]["id"] + "/metadata")
    assert expected <= {n["type"] for n in metadata["nodes"]}, "Live RPC pipeline is incomplete"
    save(f"root_rule_chain_before_{stamp}.json", {"ruleChain": chain, "metadata": metadata})
    nodes = metadata["nodes"]
    for node in nodes:
        if node['type'].endswith('TbRestApiCallNode') and any(path in node['configuration'].get('restEndpointUrlPattern', '') for path in ('tb-webhook', 'mode-notify')):
            node['configuration'].setdefault('headers', {}).update({
                'X-TB-Webhook-Secret': secret, 'X-Device-Name': '${deviceName}'})
            node['configuration']['readTimeoutMs'] = 15000
    switch = next(i for i, n in enumerate(nodes) if n['type'].endswith('TbMsgTypeSwitchNode'))
    if not any(n['name'] == 'SmartFace Mode Relay' for n in nodes):
        start = len(nodes)
        component = api('/api/component/org.thingsboard.rule.engine.filter.TbJsFilterNode')
        settings = component['configurationDescriptor']['nodeDefinition']['defaultConfiguration']
        script = "return msg.current_mode != null && msg.mode_changed_at != null;"
        settings.update(scriptLang='TBEL', tbelScript=script, jsScript=script)
        nodes.append({'type': 'org.thingsboard.rule.engine.filter.TbJsFilterNode', 'name': 'SmartFace Has Mode Revision',
                      'configurationVersion': component['configurationVersion'], 'configuration': settings,
                      'additionalInfo': {'layoutX': 600, 'layoutY': 850}})
        original = next(n for n in nodes if n['type'].endswith('TbRestApiCallNode') and 'tb-webhook' in n['configuration'].get('restEndpointUrlPattern', ''))
        config_rest = copy.deepcopy(original['configuration'])
        base = config_rest['restEndpointUrlPattern'].split('/api/attendance/')[0]
        config_rest['restEndpointUrlPattern'] = base + '/api/devices/${deviceName}/mode-notify'
        nodes.append({'type': original['type'], 'name': 'SmartFace Mode Relay',
                      'configurationVersion': original['configurationVersion'], 'configuration': config_rest,
                      'additionalInfo': {'layoutX': 930, 'layoutY': 850}})
        metadata['connections'].extend([{'fromIndex': switch, 'toIndex': start, 'type': 'Post telemetry'},
                                        {'fromIndex': start, 'toIndex': start + 1, 'type': 'True'}])
    if not any(n["name"] == "SmartFace Score Only" for n in nodes):
        switch = next(i for i, n in enumerate(nodes) if n["type"].endswith("TbMsgTypeSwitchNode"))
        storage = next(i for i, n in enumerate(nodes) if n["type"].endswith("TbMsgTimeseriesNode"))
        start = len(nodes)
        for cls, name, script, x in [
            ("org.thingsboard.rule.engine.filter.TbJsFilterNode", "SmartFace Has Liveness Score",
             "return msg.method == 'verify_face' && msg.params != null && msg.params.antispoof_score != null;", 600),
            ("org.thingsboard.rule.engine.transform.TbTransformMsgNode", "SmartFace Score Only",
             "return {msg: {antispoof_score: msg.params.antispoof_score}, metadata: metadata, msgType: 'POST_TELEMETRY_REQUEST'};", 930),
        ]:
            component = api("/api/component/" + cls)
            settings = component["configurationDescriptor"]["nodeDefinition"]["defaultConfiguration"]
            settings.update(scriptLang="TBEL", tbelScript=script, jsScript=script)
            nodes.append({"type": cls, "name": name, "configurationVersion": component["configurationVersion"],
                          "configuration": settings, "additionalInfo": {"layoutX": x, "layoutY": 620}})
        metadata["connections"].extend([
            {"fromIndex": switch, "toIndex": start, "type": "RPC Request from Device"},
            {"fromIndex": start, "toIndex": start + 1, "type": "True"},
            {"fromIndex": start + 1, "toIndex": storage, "type": "Success"},
        ])
    api("/api/ruleChain/metadata", metadata)

    saved = api("/api/dashboard", dashboard)
    saved = api("/api/dashboard/" + saved["id"]["id"])
    assert len(saved["configuration"]["widgets"]) == len(config["widgets"])
    save("smartface_dashboard.deployed.json", saved)
    save("smartface_root_rule_chain.deployed.json", {
        "ruleChain": api("/api/ruleChain/" + chain["id"]["id"]),
        "metadata": api("/api/ruleChain/" + chain["id"]["id"] + "/metadata"),
    })
    print("Dashboard:", BASE + "/dashboards/" + saved["id"]["id"])
    print("Widgets:", len(config["widgets"]), "Device:", device["name"])
    print("Exports and backups:", OUT)


if __name__ == "__main__":
    main()
