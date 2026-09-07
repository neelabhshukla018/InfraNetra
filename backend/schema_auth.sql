-- ==============================================================================
-- INFRANETRA MULTI-ROLE AUTHENTICATION & ACCESS CONTROL SCHEMA (ADDITIVE)
-- ==============================================================================

-- 1. Unified User Identity and Credentials Table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    designation TEXT,
    role TEXT NOT NULL CHECK(role IN ('ADMIN', 'MINISTRY', 'PROJECT_MANAGER', 'PUBLIC')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_single_admin ON users(role) WHERE role = 'ADMIN';

-- 2. Single Authoritative Ministry Assignment Table
CREATE TABLE IF NOT EXISTS user_ministry_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ministry TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'ACTIVE', 'REVOKED')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_ministry UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_uma_user_id ON user_ministry_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_uma_ministry ON user_ministry_assignments(ministry);

-- 3. Single Authoritative Project Manager Assignment Table
CREATE TABLE IF NOT EXISTS project_manager_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'ACTIVE', 'REVOKED')),
    assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_pm UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_pma_user_id ON project_manager_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_pma_project_id ON project_manager_assignments(project_id);

-- MANDATORY DATABASE RULE: ONE PROJECT ID = MAXIMUM ONE CURRENT (ACTIVE OR PENDING) PROJECT MANAGER
-- Enforced strictly via partial unique index at the database level.
DROP INDEX IF EXISTS idx_unique_active_pm;
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_or_pending_pm ON project_manager_assignments(project_id) WHERE status IN ('ACTIVE', 'PENDING');


-- 4. Controlled Daily Project Updates Table
CREATE TABLE IF NOT EXISTS daily_project_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    manager_user_id INTEGER NOT NULL REFERENCES users(id),
    update_date TEXT NOT NULL,
    today_physical_progress REAL DEFAULT 0.0,
    cumulative_physical_progress REAL NOT NULL,
    today_expenditure REAL DEFAULT 0.0,
    cumulative_expenditure REAL NOT NULL,
    milestone_status TEXT,
    current_milestone TEXT,
    target_completion_date TEXT,
    issues_risks TEXT,
    remarks TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dpu_project_id ON daily_project_updates(project_id);
CREATE INDEX IF NOT EXISTS idx_dpu_manager ON daily_project_updates(manager_user_id);
CREATE INDEX IF NOT EXISTS idx_dpu_update_date ON daily_project_updates(update_date);

-- 5. Authoritative Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id INTEGER,
    actor_username TEXT,
    actor_role TEXT,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    details TEXT,
    ip_address TEXT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    result TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_actor_username ON audit_logs(actor_username);
