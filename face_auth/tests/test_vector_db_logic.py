"""Unit tests for VectorDB logic, identity decisions, and search/re-enroll queries."""

import unittest
from contextlib import contextmanager
from copy import deepcopy
import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
import numpy as np

from database.vector_db import VectorDB, decide_identity


class TestVectorDbLogic(unittest.TestCase):

    def test_decide_identity_thresholds(self):
        """1. decide_identity() với trên/dưới threshold."""
        # Empty rows -> UNKNOWN
        self.assertEqual(decide_identity([], threshold=0.35), (None, "UNKNOWN", 0.0))

        # Dưới threshold -> UNKNOWN
        rows_under = [("NV001", "Nguyen Van A", 0.34)]
        self.assertEqual(decide_identity(rows_under, threshold=0.35), (None, "UNKNOWN", 0.34))

        # Bằng hoặc trên threshold -> trả về danh tính
        rows_exact = [("NV001", "Nguyen Van A", 0.35)]
        self.assertEqual(decide_identity(rows_exact, threshold=0.35), ("NV001", "Nguyen Van A", 0.35))

        rows_above = [("NV001", "Nguyen Van A", 0.88), ("NV002", "Tran Van B", 0.40)]
        self.assertEqual(decide_identity(rows_above, threshold=0.35), ("NV001", "Nguyen Van A", 0.88))

    @patch("database.vector_db.ConnectionPool")
    def test_search_query_filters(self, mock_pool_cls):
        """2. Search query lọc CENTROID, model_version và employee ACTIVE."""
        mock_pool = MagicMock()
        mock_conn = MagicMock()
        mock_pool.connection.return_value.__enter__.return_value = mock_conn
        mock_conn.execute.return_value.fetchall.return_value = [("NV001", "Nguyen Van A", 0.9)]
        mock_pool_cls.return_value = mock_pool

        with patch.object(VectorDB, "validate_schema"):
            db = VectorDB("fake_conninfo")

        dummy_emb = np.ones(512, dtype=np.float32)
        results = db.search(dummy_emb, top_k=3, model_version="buffalo_s")

        self.assertEqual(len(results), 1)
        search_call = None
        for call in mock_conn.execute.call_args_list:
            sql = call[0][0]
            if "SELECT" in sql and "face_embeddings" in sql and "<=>" in sql:
                search_call = call
                break

        self.assertIsNotNone(search_call, "Search query was not executed")
        sql, params = search_call[0][0], search_call[0][1]
        self.assertIn("f.embedding_type = 'CENTROID'", sql)
        self.assertIn("f.model_version = %s", sql)
        self.assertIn("e.status = 'ACTIVE'", sql)
        self.assertEqual(params[1], "buffalo_s")
        self.assertEqual(params[3], 3)

    @patch("database.vector_db.ConnectionPool")
    def test_re_enrollment_deletes_old_embeddings(self, mock_pool_cls):
        """3. Re-enroll xóa embedding cũ cùng model version trước khi insert."""
        mock_pool = MagicMock()
        mock_conn = MagicMock()
        mock_pool.connection.return_value.__enter__.return_value = mock_conn
        def execute(sql, params=None):
            if "SELECT id FROM employees" in sql:
                row = ("uuid-1234",)
            elif "FROM background_operations" in sql:
                row = None
            elif "SELECT 1 FROM face_embeddings" in sql:
                row = (1,)
            else:
                row = None
            return SimpleNamespace(fetchone=lambda: row)
        mock_conn.execute.side_effect = execute
        mock_pool_cls.return_value = mock_pool

        with patch.object(VectorDB, "validate_schema"):
            db = VectorDB("fake_conninfo")

        dummy_sample = np.ones(512, dtype=np.float32)
        dummy_centroid = np.ones(512, dtype=np.float32)

        emp_code, is_new, is_ignored = db.upsert(
            employee_code="NV-001",
            individual_embeddings=[dummy_sample],
            mean_embedding=dummy_centroid,
            overwrite=True,
            model_version="arcface_v1",
        )

        self.assertEqual(emp_code, "NV-001")
        self.assertFalse(is_new)
        self.assertFalse(is_ignored)

        # Verify DELETE was called with employee UUID and model_version
        delete_called = False
        for call in mock_conn.execute.call_args_list:
            sql = call[0][0]
            if "DELETE FROM face_embeddings" in sql and "employee_id = %s" in sql:
                delete_called = True
                self.assertEqual(call[0][1], ("uuid-1234", "arcface_v1"))

        self.assertTrue(delete_called, "Must delete old embeddings for the same employee and model_version")

    def test_operation_receipt_and_vectors_commit_once_and_replay_without_writes(self):
        conn = EnrollmentTransactionFake()
        db = VectorDB.__new__(VectorDB)
        db.pool = conn
        result = {"employee_code": "NV-001", "n_samples_used": 1}
        arguments = dict(employee_code="NV-001", individual_embeddings=[np.ones(512)],
                         mean_embedding=np.ones(512), model_version="arcface_v1",
                         operation_id="operation-1", operation_result=result, avatar_url="new-avatar")
        self.assertEqual(db.upsert(**arguments), ("NV-001", False, False))
        self.assertEqual(len(conn.state["vectors"]), 2)
        self.assertEqual(conn.state["receipt"], result)
        self.assertEqual(conn.state["avatar"], "new-avatar")
        self.assertEqual(conn.state["audits"], 1)
        self.assertEqual(conn.state["status"], "succeeded")
        committed = deepcopy(conn.state)
        self.assertEqual(db.upsert(**arguments), ("NV-001", False, True))
        self.assertEqual(conn.state, committed)

    def test_receipt_or_completion_failure_rolls_back_vectors_avatar_and_audit(self):
        for failure in ["receipt", "completion"]:
            with self.subTest(failure=failure):
                conn = EnrollmentTransactionFake(failure)
                db = VectorDB.__new__(VectorDB)
                db.pool = conn
                original = deepcopy(conn.state)
                with self.assertRaisesRegex(RuntimeError, "injected transaction failure"):
                    db.upsert(employee_code="NV-001", mean_embedding=np.ones(512),
                              model_version="arcface_v1", operation_id="operation-1",
                              operation_result={"n_samples_used": 1}, avatar_url="new-avatar")
                self.assertEqual(conn.state, original)

    @patch("database.vector_db.ConnectionPool")
    def test_upsert_employee_not_found(self, mock_pool_cls):
        """4. Upsert ném ValueError nếu employee_code không tồn tại trong DB."""
        mock_pool = MagicMock()
        mock_conn = MagicMock()
        mock_pool.connection.return_value.__enter__.return_value = mock_conn
        mock_conn.execute.return_value.fetchone.return_value = None
        mock_pool_cls.return_value = mock_pool

        with patch.object(VectorDB, "validate_schema"):
            db = VectorDB("fake_conninfo")
        dummy_centroid = np.ones(512, dtype=np.float32)

        with self.assertRaises(ValueError):
            db.upsert(
                employee_code="NV-999",
                mean_embedding=dummy_centroid,
                model_version="arcface_v1",
            )


class EnrollmentTransactionFake:
    """Buffer DB writes so the real upsert/receipt flow must share one transaction."""

    def __init__(self, failure=None):
        self.state = {"vectors": ["old-vector"], "receipt": None, "avatar": "old-avatar",
                      "audits": 0, "status": "running"}
        self.pending = None
        self.failure = failure

    @contextmanager
    def connection(self):
        yield self

    @contextmanager
    def transaction(self):
        self.pending = deepcopy(self.state)
        try:
            yield
        except BaseException:
            raise
        else:
            self.state = self.pending
        finally:
            self.pending = None

    def execute(self, sql, params=()):
        if self.pending is None:
            raise AssertionError("Enrollment writes escaped the transaction")
        state = self.pending
        row = None
        if "SELECT id FROM employees" in sql:
            row = ("uuid-1234",)
        elif "pg_advisory_xact_lock" in sql:
            pass
        elif "SELECT result FROM face_enrollment_receipts" in sql:
            row = (state["receipt"],) if state["receipt"] is not None else None
        elif "SELECT o.owner_id FROM background_operations" in sql:
            row = ("owner-1",)
        elif "SELECT 1 FROM face_embeddings" in sql:
            row = (1,) if state["vectors"] else None
        elif "DELETE FROM face_embeddings" in sql:
            state["vectors"] = []
        elif "INSERT INTO face_embeddings" in sql:
            state["vectors"].append(params[1])
        elif "INSERT INTO face_enrollment_receipts" in sql:
            if self.failure == "receipt":
                raise RuntimeError("injected transaction failure")
            state["receipt"] = json.loads(params[2])
        elif "UPDATE employees SET avatar_url" in sql:
            state["avatar"] = params[0]
        elif "INSERT INTO audit_logs" in sql:
            state["audits"] += 1
        elif "UPDATE background_operations SET status" in sql:
            if self.failure == "completion":
                raise RuntimeError("injected transaction failure")
            state["status"] = "succeeded"
        else:
            raise AssertionError(f"Unexpected database operation: {sql}")
        return SimpleNamespace(fetchone=lambda: row)


if __name__ == "__main__":
    unittest.main()
