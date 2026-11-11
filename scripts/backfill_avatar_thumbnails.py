"""Back up employee avatars before a bounded, compare-and-swap thumbnail backfill.

Default is a dry run. --apply writes avatars; --apply --restore BACKUP restores
only records whose current avatar still equals this backfill's replacement.
Original images live only in the ignored backup, never in console/report logs.
"""
import argparse
import base64
from datetime import datetime, timezone
import hashlib
import json
import logging
import os
from pathlib import Path
import sys
import uuid

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from face_auth.enrollment.avatar import make_avatar_thumbnail, MAX_BYTES


def prepare_avatar(original):
    if not original or len(original.encode('utf-8')) <= MAX_BYTES or original.startswith(('https://', 'http://')):
        return None
    if original.startswith('data:'):
        header, encoded = original.split(',', 1)
        if header.lower() not in ('data:image/jpeg;base64', 'data:image/png;base64', 'data:image/webp;base64'):
            raise ValueError('Unsupported inline image')
    else:
        encoded = original  # Legacy enrollment also stored bare base64.
    data = base64.b64decode(encoded, validate=True)
    image = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError('Invalid inline image')
    return make_avatar_thumbnail(image)


def save_backup(directory, rows, replacements):
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / ('avatars-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8] + '.json')
    payload = json.dumps({'created_at_utc': datetime.now(timezone.utc).isoformat(), 'rows': rows,
                          'replacements': replacements}, ensure_ascii=False, default=str).encode('utf-8')
    # Exclusive creation prevents an accidental rerun overwriting the only backup.
    with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'wb') as handle:
        handle.write(payload)
        handle.flush()
        os.fsync(handle.fileno())
    digest = hashlib.sha256(payload).hexdigest()
    path.with_suffix('.sha256').write_text(digest + '\n', encoding='ascii')
    if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
        raise RuntimeError('Backup verification failed; refusing writes')
    json.loads(path.read_text(encoding='utf-8'))
    return path


def guarded_update(conn, employee_id, expected, replacement):
    return conn.execute('''UPDATE employees SET avatar_url=%s, updated_at=now()
        WHERE id=%s::uuid AND avatar_url IS NOT DISTINCT FROM %s RETURNING id''',
                        (replacement, employee_id, expected)).fetchone() is not None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--restore', type=Path)
    args = parser.parse_args()
    if args.restore and not args.apply:
        parser.error('--restore requires --apply')
    from dotenv import load_dotenv
    import psycopg
    from psycopg.rows import dict_row
    logging.getLogger('dotenv.main').setLevel(logging.ERROR)
    load_dotenv(ROOT / 'backend/.env', override=True)
    report = {'at_utc': datetime.now(timezone.utc).isoformat(), 'mode': 'restore' if args.restore else 'apply' if args.apply else 'dry-run'}
    with psycopg.connect(os.environ['DATABASE_URL'], connect_timeout=8, autocommit=True,
                         row_factory=dict_row, application_name='smartface_avatar_backfill') as conn:
        if args.restore:
            raw = args.restore.read_bytes()
            if hashlib.sha256(raw).hexdigest() != args.restore.with_suffix('.sha256').read_text().strip():
                raise RuntimeError('Backup checksum mismatch; refusing restore')
            backup = json.loads(raw)
            originals = {row['id']: row['avatar_url'] for row in backup['rows']}
            changes = [(key, value, originals[key]) for key, value in backup['replacements'].items()]
            report['backup'] = str(args.restore)
        else:
            with conn.transaction():
                conn.execute('SET TRANSACTION READ ONLY')
                conn.execute("SET LOCAL statement_timeout='5s'")
                rows = conn.execute('SELECT id::text, avatar_url, updated_at FROM employees ORDER BY id').fetchall()
            report['employee_count'] = len(rows)
            report['before_avatar_bytes'] = sum(len((r['avatar_url'] or '').encode()) for r in rows)
            replacements, skipped = {}, []
            for row in rows:
                try:
                    thumbnail = prepare_avatar(row['avatar_url'])
                    if thumbnail is not None:
                        replacements[row['id']] = thumbnail
                except (ValueError, cv2.error):
                    skipped.append({'id': row['id'], 'reason': 'invalid_or_unsupported_inline_image'})
            report.update(candidates=len(replacements), skipped=skipped)
            changes = [(r['id'], r['avatar_url'], replacements[r['id']]) for r in rows if r['id'] in replacements]
            if args.apply and changes:
                report['backup'] = str(save_backup(ROOT / '.local/database-backups', rows, replacements))
        report['changes'] = [{'id': key, 'before_bytes': len((old or '').encode()), 'after_bytes': len((new or '').encode())}
                             for key, old, new in changes]
        if args.apply:
            # Every original is durably backed up and verified before reaching this transaction.
            applied, conflicts = [], []
            with conn.transaction():
                conn.execute("SET LOCAL statement_timeout='5s'")
                conn.execute("SET LOCAL lock_timeout='2s'")
                for key, old, new in changes:
                    (applied if guarded_update(conn, key, old, new) else conflicts).append(key)
            report.update(applied=applied, conflicts=conflicts)
            with conn.transaction():
                conn.execute('SET TRANSACTION READ ONLY')
                conn.execute("SET LOCAL statement_timeout='5s'")
                report['after'] = conn.execute('''SELECT count(*)::int AS employee_count,
                    sum(octet_length(avatar_url))::bigint AS total_avatar_bytes,
                    max(octet_length(avatar_url))::bigint AS max_avatar_bytes FROM employees''').fetchone()
    target = ROOT / 'docs/maintenance' / ('avatar-' + report['mode'] + '-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '.json')
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, indent=2, default=str) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2, default=str))
    print('Report:', target.relative_to(ROOT))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Database errors may contain connection details; never print credentials or blob params.
        print('Avatar operation failed:', type(error).__name__, 'sqlstate=', getattr(error, 'sqlstate', None), file=sys.stderr)
        sys.exit(1)
