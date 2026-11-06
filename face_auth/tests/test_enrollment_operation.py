import unittest
from unittest.mock import Mock
from enrollment.operation import begin_enrollment


class EnrollmentOperationTest(unittest.TestCase):
    def test_committed_operation_returns_receipt_without_replacing_vectors(self):
        conn = Mock()
        conn.execute.return_value.fetchone.return_value = ({"n_samples_used": 3},)
        self.assertEqual(begin_enrollment(conn, "emp1", "op1"), {"n_samples_used": 3})
        self.assertEqual(conn.execute.call_count, 1)

    def test_cancelled_or_revoked_operation_cannot_replace_vectors(self):
        conn = Mock()
        conn.execute.return_value.fetchone.side_effect = [None, None]
        with self.assertRaises(ValueError):
            begin_enrollment(conn, "emp1", "op1")


if __name__ == '__main__':
    unittest.main()
