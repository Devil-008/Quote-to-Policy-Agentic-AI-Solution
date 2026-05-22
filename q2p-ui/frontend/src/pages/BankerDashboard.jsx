import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Routes, Route } from "react-router-dom";
import { fetchCases, createCase } from "../store/slices/casesSlice";
import { StatCard, DataTable, Badge, Btn, SectionHeader, Card, Input, Alert, Spinner } from "../components/common";
import { Briefcase, FileText, CheckCircle, Clock } from "lucide-react";
import api from "../services/api";

/* ── Case List ── */
function CaseList() {
  const dispatch = useDispatch();
  const { list: cases, loading } = useSelector((s) => s.cases);
  const { user } = useSelector((s) => s.auth);

  useEffect(() => { dispatch(fetchCases()); }, [dispatch]);

  const cols = [
    { key: "case_number", label: "Case #" },
    { key: "current_stage", label: "Stage", render: (r) => <Badge label={r.current_stage} /> },
    { key: "status", label: "Status", render: (r) => <Badge label={r.status} /> },
    { key: "sum_assured", label: "Sum Assured", render: (r) => r.sum_assured ? `₹${r.sum_assured.toLocaleString()}` : "—" },
    { key: "created_at", label: "Created", render: (r) => r.created_at ? new Date(r.created_at).toLocaleDateString() : "—" },
  ];

  const active = cases.filter((c) => c.status === "ACTIVE").length;
  const pending = cases.filter((c) => c.status === "PENDING").length;
  const completed = cases.filter((c) => c.status === "COMPLETED").length;

  return (
    <div>
      <SectionHeader title="My Cases" subtitle="Track all customer insurance cases" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
        <StatCard title="Total Cases" value={cases.length} icon={Briefcase} />
        <StatCard title="Active" value={active} color="#22c55e" icon={Clock} />
        <StatCard title="Pending" value={pending} color="#f59e0b" icon={FileText} />
        <StatCard title="Completed" value={completed} color="#6366f1" icon={CheckCircle} />
      </div>
      <Card>
        {loading ? <Spinner /> : <DataTable columns={cols} rows={cases} emptyText="No cases yet. Create your first case." />}
      </Card>
    </div>
  );
}

/* ── New Case Form ── */
function NewCaseForm() {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const [form, setForm] = useState({
    customer_name: "", customer_email: "", customer_phone: "",
    customer_dob: "", annual_income: "", sum_assured: "",
    premium_budget: "", policy_tenure: "20", purpose: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setLoading(true); setError(null);
    try {
      await dispatch(createCase({
        customer_profile: { name: form.customer_name, email: form.customer_email, phone: form.customer_phone, dob: form.customer_dob, annual_income: parseFloat(form.annual_income) },
        sum_assured: parseFloat(form.sum_assured),
        premium_budget: parseFloat(form.premium_budget),
        policy_tenure: parseInt(form.policy_tenure),
        needs_analysis: { purpose: form.purpose },
      }));
      setSuccess(true);
    } catch (e) {
      setError("Failed to create case");
    } finally {
      setLoading(false);
    }
  };

  if (success) return (
    <Card style={{ textAlign: "center", padding: 40 }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
      <h3 style={{ margin: 0, marginBottom: 8 }}>Case Created Successfully</h3>
      <p style={{ color: "var(--text-muted)", margin: 0 }}>The AI workflow has been triggered for this case.</p>
      <Btn onClick={() => setSuccess(false)} style={{ marginTop: 20 }}>Create Another</Btn>
    </Card>
  );

  const fields = [
    { label: "Customer Name", key: "customer_name", placeholder: "Rahul Kumar" },
    { label: "Customer Email", key: "customer_email", placeholder: "rahul@email.com" },
    { label: "Phone", key: "customer_phone", placeholder: "+91 9876543210" },
    { label: "Date of Birth", key: "customer_dob", placeholder: "YYYY-MM-DD" },
    { label: "Annual Income (₹)", key: "annual_income", placeholder: "1200000" },
    { label: "Sum Assured (₹)", key: "sum_assured", placeholder: "5000000" },
    { label: "Premium Budget / year (₹)", key: "premium_budget", placeholder: "60000" },
    { label: "Policy Tenure (years)", key: "policy_tenure", placeholder: "20" },
    { label: "Insurance Purpose", key: "purpose", placeholder: "Family protection, tax saving…" },
  ];

  return (
    <div>
      <SectionHeader title="New Case" subtitle="Create a new insurance case for a customer" />
      <Card style={{ maxWidth: 640 }}>
        {error && <Alert type="error" message={error} />}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {fields.map(({ label, key, placeholder }) => (
            <Input key={key} label={label} value={form[key]} onChange={set(key)} placeholder={placeholder} style={key === "purpose" ? { gridColumn: "1 / -1" } : {}} />
          ))}
        </div>
        <Btn onClick={handleSubmit} disabled={loading} style={{ marginTop: 20, width: "100%" }}>
          {loading ? "Creating…" : "Create Case & Trigger Workflow"}
        </Btn>
      </Card>
    </div>
  );
}

/* ── Banker Approvals ── */
function BankerApprovals() {
  const { list: cases } = useSelector((s) => s.cases);
  const pendingApproval = cases.filter((c) => c.current_stage === "BANKER_APPROVAL" && !c.banker_approved);
  const [remarks, setRemarks] = useState({});
  const [loading, setLoading] = useState({});

  const approve = async (caseId) => {
    setLoading((l) => ({ ...l, [caseId]: true }));
    try {
      await api.post(`/cases/${caseId}/banker-approve`, { remarks: remarks[caseId] || "" });
    } finally {
      setLoading((l) => ({ ...l, [caseId]: false }));
    }
  };

  return (
    <div>
      <SectionHeader title="Pending Approvals" subtitle="Cases awaiting your approval before OTP consent" />
      {pendingApproval.length === 0 ? (
        <Card style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>No cases pending approval</Card>
      ) : (
        pendingApproval.map((c) => (
          <Card key={c.id} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{c.case_number}</div>
                <Badge label={c.current_stage} />
              </div>
              <div style={{ textAlign: "right", fontSize: 13, color: "var(--text-muted)" }}>
                ₹{c.sum_assured?.toLocaleString()}
              </div>
            </div>
            <Input label="Remarks" value={remarks[c.id] || ""} onChange={(v) => setRemarks((r) => ({ ...r, [c.id]: v }))} placeholder="Optional remarks…" />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Btn onClick={() => approve(c.id)} disabled={loading[c.id]} size="sm">
                {loading[c.id] ? "Approving…" : "Approve"}
              </Btn>
              <Btn variant="danger" size="sm">Reject</Btn>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

export default function BankerDashboard() {
  return (
    <Routes>
      <Route index element={<CaseList />} />
      <Route path="new" element={<NewCaseForm />} />
      <Route path="quotes" element={<div style={{ color: "var(--text-muted)" }}>Quote comparison loaded via case detail.</div>} />
      <Route path="approvals" element={<BankerApprovals />} />
    </Routes>
  );
}
