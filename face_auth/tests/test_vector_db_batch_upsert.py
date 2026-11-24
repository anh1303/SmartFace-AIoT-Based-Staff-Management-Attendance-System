import sys
import unittest
from pathlib import Path
from unittest.mock import patch
import numpy as np

FACE_AUTH_ROOT = Path(__file__).resolve().parents[1]
if str(FACE_AUTH_ROOT) not in sys.path:
    sys.path.insert(0, str(FACE_AUTH_ROOT))

from database.vector_db import VectorDB


class FakeCursor:
    def __init__(self, row=None, rowcount=0):
        self._row = row
        self.rowcount = rowcount

    def fetchone(self):
        return self._row


class FakeConn:
    def __init__(self, deleted_rowcount=0):
        self.executed = []
        self.deleted_rowcount = deleted_rowcount

    def transaction(self):
        return self

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, sql, params=None):
        sql_str = " ".join(str(sql).split())
        self.executed.append((sql_str, params))
        if "SELECT id FROM employees WHERE employee_code" in sql_str:
            return FakeCursor(("11111111-1111-4111-8111-111111111111",))
        if "SELECT 1 FROM background_operations" in sql_str:
            return FakeCursor(None)
        if "DELETE FROM face_embeddings" in sql_str:
            return FakeCursor(None, rowcount=self.deleted_rowcount)
        return FakeCursor(None)


class FakePool:
    def __init__(self, conn):
        self.conn = conn

    def connection(self):
        return self.conn


class TestVectorDbBatchUpsert(unittest.TestCase):
    def _make_db(self, conn):
        db = object.__new__(VectorDB)
        db.pool = FakePool(conn)
        db.query_timeout_ms = 5000
        return db

    def test_multi_row_insert_batches_samples_and_centroid_without_select_1_on_overwrite(self):
        conn = FakeConn(deleted_rowcount=0)
        db = self._make_db(conn)
        samples = [np.ones(512, dtype=np.float32) * (i + 1) for i in range(5)]
        centroid = np.ones(512, dtype=np.float32)

        code, is_new, is_ignored = db.upsert(
            employee_code="NV-001",
            individual_embeddings=samples,
            mean_embedding=centroid,
            model_version="buffalo_s",
            overwrite=True,
            save_individuals=True,
        )

        self.assertEqual(code, "NV-001")
        self.assertTrue(is_new)
        self.assertFalse(is_ignored)

        select_existing = [q for q, _ in conn.executed if "SELECT 1 FROM face_embeddings" in q]
        self.assertEqual(len(select_existing), 0, "overwrite=True must skip redundant SELECT 1")

        inserts = [(q, p) for q, p in conn.executed if q.startswith("INSERT INTO face_embeddings")]
        self.assertEqual(len(inserts), 1, "Must batch all SAMPLE + CENTROID rows into exactly 1 INSERT")
        insert_sql, insert_params = inserts[0]
        self.assertEqual(insert_sql.count("gen_random_uuid()"), 6)
        self.assertEqual(len(insert_params), 6 * 4)
        # 5 SAMPLE + 1 CENTROID
        types = [insert_params[i * 4 + 2] for i in range(6)]
        self.assertEqual(types, ["SAMPLE"] * 5 + ["CENTROID"])

    def test_idempotent_operation_replay_returns_ignored_without_inserting(self):
        conn = FakeConn(deleted_rowcount=2)
        db = self._make_db(conn)
        centroid = np.ones(512, dtype=np.float32)

        with patch("enrollment.operation.begin_enrollment", return_value={"status": "ok"}):
            code, is_new, is_ignored = db.upsert(
                employee_code="NV-001",
                individual_embeddings=[centroid],
                mean_embedding=centroid,
                model_version="buffalo_s",
                overwrite=True,
                save_individuals=True,
                operation_id="22222222-2222-4222-8222-222222222222",
                operation_result={"status": "ok"},
            )

        self.assertEqual((code, is_new, is_ignored), ("NV-001", False, True))
        inserts = [q for q, _ in conn.executed if q.startswith("INSERT INTO face_embeddings")]
        self.assertEqual(len(inserts), 0)


if __name__ == "__main__":
    unittest.main()
