// ──────────────────── Underwriter Dashboard ────────────────────
import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { StatCard, DataTable, Badge, Card, SectionHeader, Btn, Alert, Input, Spinner } from "../components/common";
import { ClipboardList, ShieldCheck, Clock } from "lucide-react";
import api from "../services/api";

function UWQueue() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [decision, setDecision] = useState("APPROVED");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get("/underwriting/queue").then(({ data }) => setQueue(data.queue || [])).finally(() => setLoading(false));
  }, []);

  const submit = async (policyId) => {
    setSubmitting(true); setError(null);
    try {
      await api.post("/underwriting/decision", { policy_id: policyId, decision, remarks });
      setSuccess(`Decision "${decision}" recorded.`);
      setSelected(null);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const cols = [
    { key: "case_number", label: "Case #" },
    { key: "current_stage", label: "Stage", render: (r) => <Badge label={r.current_stage} /> },
    { key: "sum_assured", label: "Sum Assured", render: (r) => r.sum_assured ? `₹${r.sum_assured.toLocaleString()}` : "—" },
    { key: "last_activity_at", label: "Last Activity", render: (r) => r.last_activity_at ? new Date(r.last_activity_at).toLocaleDateString() : "—" },
    {
      key: "actions", label: "", render: (r) => (
        <Btn size="sm" onClick={() => setSelected(r)}>Review</Btn>
      )
    },
  ];

  return (
    <div>
      <SectionHeader title="Underwriting Queue" subtitle="Cases pending UW review and decision" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 16, marginBottom: 24 }}>
        <StatCard title="Pending Review" value={queue.length} icon={ClipboardList} />
      </div>
      {success && <Alert type="success" message={success} />}
      {loading ? <Spinner /> : (
        <Card>
          <DataTable columns={cols} rows={queue} emptyText="No cases in UW queue." />
        </Card>
      )}
      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <Card style={{ width: 440, maxHeight: "80vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 16px" }}>UW Decision — {selected.case_number}</h3>
            {error && <Alert type="error" message={error} />}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Decision</label>
                <select value={decision} onChange={(e) => setDecision(e.target.value)} style={{ display: "block", width: "100%", marginTop: 6, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", color: "var(--text)", fontSize: 13 }}>
                  <option value="APPROVED">Approve</option>
                  <option value="REJECTED">Reject</option>
                  <option value="DEFERRED">Defer</option>
                </select>
              </div>
              <Input label="Remarks" value={remarks} onChange={setRemarks} placeholder="UW remarks…" />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <Btn onClick={() => submit(selected.policy_id || selected.id)} disabled={submitting}>
                {submitting ? "Submitting…" : "Submit Decision"}
              </Btn>
              <Btn variant="secondary" onClick={() => setSelected(null)}>Cancel</Btn>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export function UnderwriterDashboard() {
  return (
    <Routes>
      <Route index element={<UWQueue />} />
      <Route path="decisions" element={<UWQueue />} />
    </Routes>
  );
}

// ──────────────────── Compliance Dashboard ────────────────────
function ComplianceOverview() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/compliance/dashboard").then(({ data }) => setStats(data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div>
      <SectionHeader title="Compliance Dashboard" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16, marginBottom: 24 }}>
        <StatCard title="Compliance Score" value={`${stats?.compliance_score || 0}%`} color="#22c55e" icon={ShieldCheck} />
        <StatCard title="Total Policies" value={stats?.total_policies || 0} icon={ClipboardList} />
        <StatCard title="Checked" value={stats?.checked_policies || 0} color="#6366f1" icon={ShieldCheck} />
        <StatCard title="Exceptions" value={stats?.exception_count || 0} color="#f59e0b" icon={Clock} />
      </div>
    </div>
  );
}

function Exceptions() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/compliance/exceptions").then(({ data }) => setItems(data.exceptions || [])).finally(() => setLoading(false));
  }, []);

  const cols = [
    { key: "policy_number", label: "Policy #" },
    { key: "insurer_name", label: "Insurer" },
    { key: "status", label: "Status", render: (r) => <Badge label={r.status} /> },
    { key: "compliance_remarks", label: "Remarks" },
    { key: "created_at", label: "Date", render: (r) => r.created_at ? new Date(r.created_at).toLocaleDateString() : "—" },
  ];

  return (
    <div>
      <SectionHeader title="Exception Reports" />
      <Card>{loading ? <Spinner /> : <DataTable columns={cols} rows={items} emptyText="No exceptions." />}</Card>
    </div>
  );
}

function Consents() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/compliance/consents").then(({ data }) => setItems(data.consents || [])).finally(() => setLoading(false));
  }, []);

  const cols = [
    { key: "id", label: "Consent ID", render: (r) => r.id.slice(0, 8) + "…" },
    { key: "case_id", label: "Case ID", render: (r) => r.case_id.slice(0, 8) + "…" },
    { key: "consent_type", label: "Type" },
    { key: "ip_address", label: "IP Address" },
    { key: "consented_at", label: "Date", render: (r) => r.consented_at ? new Date(r.consented_at).toLocaleDateString() : "—" },
  ];

  return (
    <div>
      <SectionHeader title="Consent Records" />
      <Card>{loading ? <Spinner /> : <DataTable columns={cols} rows={items} emptyText="No consent records." />}</Card>
    </div>
  );
}

export function ComplianceDashboard() {
  return (
    <Routes>
      <Route index element={<ComplianceOverview />} />
      <Route path="exceptions" element={<Exceptions />} />
      <Route path="consents" element={<Consents />} />
    </Routes>
  );
}

// ──────────────────── Ops Admin Dashboard ────────────────────
function MedicalQueue() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/medical/queue").then(({ data }) => setQueue(data.queue || [])).finally(() => setLoading(false));
  }, []);

  const cols = [
    { key: "id", label: "Request ID", render: (r) => r.id.slice(0, 8) + "…" },
    { key: "case_id", label: "Case ID", render: (r) => r.case_id.slice(0, 8) + "…" },
    { key: "requirements", label: "Requirements", render: (r) => (r.requirements || []).join(", ") },
    { key: "status", label: "Status", render: (r) => <Badge label={r.status} /> },
    { key: "created_at", label: "Created", render: (r) => r.created_at ? new Date(r.created_at).toLocaleDateString() : "—" },
    {
      key: "actions", label: "",
      render: (r) => (
        <Btn size="sm" onClick={async () => {
          await api.patch(`/medical/${r.id}`, { status: "COMPLETED", ops_remarks: "Medical docs received" });
          setQueue((q) => q.filter((x) => x.id !== r.id));
        }}>Mark Done</Btn>
      ),
    },
  ];

  return (
    <div>
      <SectionHeader title="Medical Coordination Queue" />
      <Card>{loading ? <Spinner /> : <DataTable columns={cols} rows={queue} emptyText="No pending medical requests." />}</Card>
    </div>
  );
}

function EscalationMonitor() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/admin/escalations").then(({ data }) => setItems(data.escalations || [])).finally(() => setLoading(false));
  }, []);

  const cols = [
    { key: "case_id", label: "Case ID", render: (r) => r.case_id.slice(0, 8) + "…" },
    { key: "level", label: "Level", render: (r) => <Badge label={r.level} /> },
    { key: "stage", label: "Stage" },
    { key: "assigned_to_role", label: "Assigned To" },
    { key: "reason", label: "Reason" },
    { key: "created_at", label: "Date", render: (r) => r.created_at ? new Date(r.created_at).toLocaleDateString() : "—" },
  ];

  return (
    <div>
      <SectionHeader title="Active Escalations" />
      <Card>{loading ? <Spinner /> : <DataTable columns={cols} rows={items} emptyText="No active escalations." />}</Card>
    </div>
  );
}

export function OpsAdminDashboard() {
  return (
    <Routes>
      <Route index element={<MedicalQueue />} />
      <Route path="escalations" element={<EscalationMonitor />} />
      <Route path="sla" element={<EscalationMonitor />} />
    </Routes>
  );
}
