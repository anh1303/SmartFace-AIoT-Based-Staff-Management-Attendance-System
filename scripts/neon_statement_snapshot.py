"""Save real PostgreSQL call counters without query text/parameters or resetting stats."""
import argparse
from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
import psycopg
from psycopg.rows import dict_row

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--compare', type=Path)
    args = parser.parse_args()
    logging.getLogger('dotenv.main').setLevel(logging.ERROR)
    load_dotenv(ROOT / 'backend/.env', override=True)
    with psycopg.connect(os.environ['DATABASE_URL'], connect_timeout=8, autocommit=True,
                         application_name='smartface_statement_measurement', row_factory=dict_row) as conn:
        with conn.transaction():
            conn.execute('SET TRANSACTION READ ONLY')
            conn.execute("SET LOCAL statement_timeout='5s'")
            reset = conn.execute('SELECT stats_reset FROM pg_stat_statements_info').fetchone()['stats_reset']
            rows = conn.execute('''SELECT queryid::text, calls, rows, total_exec_time,
                CASE WHEN query ILIKE '%pg_stat_statements%' THEN 'measurement'
                WHEN query ILIKE '%background_operation_inputs%' AND query ~* '^\\s*DELETE' THEN 'worker_input_cleanup'
                WHEN query ILIKE '%background_operations%' AND query ILIKE '%SKIP LOCKED%' THEN 'worker_claim'
                WHEN query ILIKE '%fingerprint%' THEN 'fingerprint'
                WHEN query ILIKE '%daily_attendance_summary%' THEN 'daily_summary'
                WHEN query ILIKE '%attendance_logs%' THEN 'attendance_logs'
                WHEN query ILIKE '%face_embeddings%' THEN 'face_embeddings'
                WHEN query ILIKE '%background_operation%' THEN 'background_operations'
                WHEN query ILIKE '%users%' THEN 'users/auth'
                WHEN query ILIKE '%employees%' THEN 'employees'
                ELSE 'other' END AS query_group
                FROM pg_stat_statements
                WHERE dbid=(SELECT oid FROM pg_database WHERE datname=current_database())
                ORDER BY calls DESC''').fetchall()
    result = {'at_utc': datetime.now(timezone.utc).isoformat(), 'stats_reset': str(reset), 'statements': rows}
    if args.compare:
        previous = json.loads(args.compare.read_text(encoding='utf-8'))
        if previous['stats_reset'] != result['stats_reset']:
            raise RuntimeError('Counters reset between snapshots; delta is invalid')
        old = {r['queryid']: r for r in previous['statements']}
        groups = {}
        for row in rows:
            baseline = old.get(row['queryid'], {})
            group = groups.setdefault(row['query_group'], {'calls': 0, 'rows': 0, 'execution_ms': 0})
            for key, column in [('calls', 'calls'), ('rows', 'rows'), ('execution_ms', 'total_exec_time')]:
                delta = row[column] - baseline.get(column, 0)
                if delta < 0:
                    raise RuntimeError('Statement counters decreased; delta is invalid')
                group[key] += delta
        result['elapsed_seconds'] = (datetime.fromisoformat(result['at_utc']) - datetime.fromisoformat(previous['at_utc'])).total_seconds()
        result['delta_by_query_group'] = dict(sorted(groups.items(), key=lambda pair: -pair[1]['calls']))
        result['baseline'] = str(args.compare)
        result['note'] = 'Actual call/row/time deltas, not measured network bytes. Grouping uses query shape and is approximate; no query text is exported.'
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, default=str) + '\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in result.items() if k != 'statements'}, indent=2, default=str))
    print('Statement groups:', len(rows))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('Snapshot failed:', type(error).__name__, 'sqlstate=', getattr(error, 'sqlstate', None))
        raise SystemExit(1)
