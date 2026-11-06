"""Durable enrollment receipts. Caller holds the biometric lock in the vector transaction."""
import json


def begin_enrollment(conn, employee_id, operation_id):
    previous = conn.execute(
        "SELECT result FROM face_enrollment_receipts WHERE operation_id = %s AND employee_id = %s",
        (operation_id, employee_id),
    ).fetchone()
    if previous:
        return previous[0]
    allowed = conn.execute("""
        SELECT o.owner_id FROM background_operations o
        JOIN users u ON u.id = o.owner_id
        JOIN roles r ON r.id = u.role_id
        JOIN employees target ON target.id = %s
        LEFT JOIN employees actor ON actor.user_id = u.id
        LEFT JOIN users target_user ON target_user.id = target.user_id
        LEFT JOIN roles target_role ON target_role.id = target_user.role_id
        LEFT JOIN positions target_position ON target_position.id = target.position_id
        WHERE o.id = %s AND o.type = 'biometric.enroll' AND o.status = 'running'
          AND o.payload->>'employeeId' = target.id::text
          AND u.is_active = true AND target.status = 'ACTIVE'
          AND (upper(r.role_name) = 'ADMIN' OR (
            upper(r.role_name) = 'MANAGER' AND actor.department_id = target.department_id
            AND actor.id <> target.id AND upper(coalesce(target_role.role_name, 'EMPLOYEE')) = 'EMPLOYEE'
            AND coalesce(target_position.level::text, '') <> 'MANAGER'
            AND coalesce(target_position.name, '') !~* '(quản lý|manager|trưởng phòng|giám đốc)'))
        FOR UPDATE OF o
    """, (employee_id, operation_id)).fetchone()
    if not allowed:
        raise ValueError("Tác vụ không còn hiệu lực hoặc quyền quản lý đã thay đổi.")
    return None


def finish_enrollment(conn, employee_id, operation_id, result, avatar_url=None):
    encoded = json.dumps(result)
    conn.execute("INSERT INTO face_enrollment_receipts(operation_id, employee_id, result) VALUES (%s, %s, %s::jsonb)",
                 (operation_id, employee_id, encoded))
    if avatar_url:
        conn.execute("UPDATE employees SET avatar_url = %s, updated_at = now() WHERE id = %s", (avatar_url, employee_id))
    conn.execute("""INSERT INTO audit_logs(user_id, action, target_table, record_id, new_values)
        SELECT owner_id, 'ENROLL_FACE_IMAGES', 'face_embeddings', %s, %s::jsonb FROM background_operations WHERE id = %s""",
                 (str(employee_id), encoded, operation_id))
    conn.execute("""UPDATE background_operations SET status = 'succeeded', result = %s::jsonb,
        total = 1, completed = 1, succeeded = 1, revision = revision + 1, updated_at = now()
        WHERE id = %s""", (encoded, operation_id))
