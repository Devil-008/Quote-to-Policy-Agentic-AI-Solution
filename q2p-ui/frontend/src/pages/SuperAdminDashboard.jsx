import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { StatCard, DataTable, Badge, Card, SectionHeader, Btn, Alert, Input, Spinner } from "../components/common";
import { Users, FileText, Bell, ClipboardList, Settings } from "lucide-react";
import api from "../services/api";

function Overview() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/admin/stats").then(({ data }) => setStats(data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div>
      <SectionHeader title="Platform Overview" subtitle="Real-time statistics across all users and cases" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16, marginBottom: 24 }}>
        <StatCard title="Total Users" value={stats?.total_users ?? 0} icon={Users} />
        <StatCard title="Total Cases" value={stats?.total_cases ?? 0} icon={FileText} />
        <StatCard title="Active Cases" value={stats?.active_cases ?? 0} color="#22c55e" icon={FileText} />
        <StatCard title="Completed" value={stats?.completed_cases ?? 0} color="#6366f1" icon={FileText} />
        <StatCard title="Escalations" value={stats?.open_escalations ?? 0} color="#f59e0b" icon={Bell} />
      </div>
    </div>
  );
}

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "BANKER", phone: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const load = () => {
    api.get("/admin/users").then(({ data }) => setUsers(data.users || [])).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const createUser = async () => {
    setCreating(true); setError(null);
    try {
      await api.post("/admin/users", form);
      setSuccess("User created"); load();
    } catch (e) {
      setError(e.response?.data?.detail || "Failed");
    } finally {
      setCreating(false);
    }
  };

  const deleteUser = async (id) => {
    await api.delete(`/admin/users/${id}`);
    setUsers((u) => u.filter((x) => x.id !== id));
  };

  const cols = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "role", label: "Role", render: (r) => <Badge label={r.role} /> },
    { key: "is_active", label: "Active", render: (r) => r.is_active ? "✅" : "❌" },
    { key: "created_at", label: "Joined", render: (r) => r.created_at ? new Date(r.created_at).toLocaleDateString() : "—" },
    {
      key: "actions", label: "",
      render: (r) => <Btn size="sm" variant="danger" onClick={() => deleteUser(r.id)}>Remove</Btn>
    },
  ];

  return (
    <div>
      <SectionHeader title="User Management" />
      <Card style={{ marginBottom: 20 }}>
        <h4 style={{ margin: "0 0 14px" }}>Add User</h4>
        {error && <Alert type="error" message={error} />}
        {success && <Alert type="success" message={success} />}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Input label="Name" value={form.name} onChange={set("name")} placeholder="Full name" />
          <Input label="Email" value={form.email} onChange={set("email")} placeholder="email@bank.com" />
          <Input label="Password" value={form.password} onChange={set("password")} type="password" placeholder="••••••••" />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Role</label>
            <select value={form.role} onChange={(e) => set("role")(e.target.value)} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", color: "var(--text)", fontSize: 13 }}>
              {["BANKER","CUSTOMER","UNDERWRITER","COMPLIANCE","OPS_ADMIN","SUPER_ADMIN"].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <Input label="Phone" value={form.phone} onChange={set("phone")} placeholder="+91 9876543210" />
        </div>
        <Btn onClick={createUser} disabled={creating} style={{ marginTop: 14 }}>
          {creating ? "Creating…" : "Create User"}
        </Btn>
      </Card>
      <Card>
        {loading ? <Spinner /> : <DataTable columns={cols} rows={users} emptyText="No users." />}
      </Card>
    </div>
  );
}

function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/admin/audit-logs").then(({ data }) => setLogs(data.logs || [])).finally(() => setLoading(false));
  }, []);

  const cols = [
    { key: "action", label: "Action" },
    { key: "entity_type", label: "Entity" },
    { key: "user_id", label: "User ID", render: (r) => r.user_id ? r.user_id.slice(0, 8) + "…" : "system" },
    { key: "ip_address", label: "IP" },
    { key: "created_at", label: "Time", render: (r) => r.created_at ? new Date(r.created_at).toLocaleString() : "—" },
  ];

  return (
    <div>
      <SectionHeader title="Audit Logs" subtitle="Full system audit trail" />
      <Card>{loading ? <Spinner /> : <DataTable columns={cols} rows={logs} emptyText="No audit logs." />}</Card>
    </div>
  );
}

export default function SuperAdminDashboard() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="users" element={<UserManagement />} />
      <Route path="audit" element={<AuditLogs />} />
      <Route path="cases" element={<div style={{ color: "var(--text-muted)" }}>All cases view — use the Banker dashboard for case management.</div>} />
      <Route path="escalations" element={<div style={{ color: "var(--text-muted)" }}>Escalation monitor — see Ops dashboard.</div>} />
      <Route path="kb" element={<div style={{ color: "var(--text-muted)" }}>Knowledge base management via RAG pipeline.</div>} />
    </Routes>
  );
}
