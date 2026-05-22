import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { useSelector } from "react-redux";
import { StatCard, DataTable, Badge, Card, SectionHeader, Btn, Alert, Spinner } from "../components/common";
import { FileText, ShieldCheck, Clock } from "lucide-react";
import api from "../services/api";

const STAGES = [
  "CUSTOMER_INTAKE","NEEDS_ANALYSIS","SUITABILITY_VALIDATION",
  "QUOTE_RETRIEVAL","QUOTE_COMPARISON","RECOMMENDATION",
  "BANKER_APPROVAL","OTP_CONSENT","PROPOSAL_GENERATION",
  "MEDICAL_COORDINATION","UNDERWRITING","POLICY_ISSUANCE","COMPLETED",
];

function CaseTimeline({ stage }) {
  const idx = STAGES.indexOf(stage);
  return (
    <div style={{ display: "flex", overflowX: "auto", gap: 0, padding: "12px 0" }}>
      {STAGES.map((s, i) => (
        <div key={s} style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 90 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              background: i < idx ? "#22c55e" : i === idx ? "var(--accent)" : "var(--surface)",
              border: `2px solid ${i <= idx ? (i < idx ? "#22c55e" : "var(--accent)") : "var(--border)"}`,
              fontSize: 11, fontWeight: 700, color: i <= idx ? "#fff" : "var(--text-muted)",
            }}>
              {i < idx ? "✓" : i + 1}
            </div>
            <span style={{ fontSize: 9, color: i <= idx ? "var(--text)" : "var(--text-muted)", textAlign: "center", lineHeight: 1.2 }}>
              {s.replace(/_/g, " ")}
            </span>
          </div>
          {i < STAGES.length - 1 && (
            <div style={{ height: 2, width: 20, background: i < idx ? "#22c55e" : "var(--border)", marginBottom: 20 }} />
          )}
        </div>
      ))}
    </div>
  );
}

function MyCases() {
  const { user } = useSelector((s) => s.auth);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/cases/customer/${user?.id}`).then(({ data }) => setCases(data.cases || [])).finally(() => setLoading(false));
  }, [user]);

  return (
    <div>
      <SectionHeader title="My Insurance Cases" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 16, marginBottom: 24 }}>
        <StatCard title="Total" value={cases.length} icon={FileText} />
        <StatCard title="Active" value={cases.filter((c) => c.status === "ACTIVE").length} color="#22c55e" icon={Clock} />
        <StatCard title="Completed" value={cases.filter((c) => c.status === "COMPLETED").length} color="#6366f1" icon={ShieldCheck} />
      </div>
      {loading ? <Spinner /> : cases.map((c) => (
        <Card key={c.id} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{c.case_number}</div>
              <Badge label={c.status} />
            </div>
            <div style={{ textAlign: "right", fontSize: 13, color: "var(--text-muted)" }}>
              {c.sum_assured ? `₹${c.sum_assured.toLocaleString()}` : ""}
            </div>
          </div>
          <CaseTimeline stage={c.current_stage} />
        </Card>
      ))}
      {!loading && cases.length === 0 && (
        <Card style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>No cases yet. Visit your bank to start.</Card>
      )}
    </div>
  );
}

function OTPConsent() {
  const [otp, setOtp] = useState(Array(6).fill(""));
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [error, setError] = useState(null);

  const handleDigit = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[i] = val;
    setOtp(next);
    if (val && i < 5) document.getElementById(`otp-${i + 1}`)?.focus();
  };

  const verify = async () => {
    setStatus("loading"); setError(null);
    try {
      const code = otp.join("");
      await api.post("/otp/verify", { otp_code: code });
      setStatus("success");
    } catch (e) {
      setError("Invalid OTP. Please try again.");
      setStatus("error");
    }
  };

  return (
    <div>
      <SectionHeader title="OTP Consent" subtitle="Verify your identity to give consent for policy issuance" />
      <Card style={{ maxWidth: 420 }}>
        {status === "success" ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <h3 style={{ margin: 0, color: "#22c55e" }}>Consent Verified!</h3>
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Your policy proposal is now being processed.</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
              Enter the 6-digit OTP sent to your registered mobile number.
            </p>
            {error && <Alert type="error" message={error} />}
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 24 }}>
              {otp.map((d, i) => (
                <input
                  key={i} id={`otp-${i}`} maxLength={1} value={d}
                  onChange={(e) => handleDigit(i, e.target.value)}
                  onKeyDown={(e) => e.key === "Backspace" && !d && i > 0 && document.getElementById(`otp-${i - 1}`)?.focus()}
                  style={{
                    width: 48, height: 56, textAlign: "center", fontSize: 22, fontWeight: 700,
                    background: "var(--bg)", border: `2px solid ${d ? "var(--accent)" : "var(--border)"}`,
                    borderRadius: 10, color: "var(--text)", outline: "none",
                  }}
                />
              ))}
            </div>
            <Btn onClick={verify} disabled={status === "loading" || otp.join("").length < 6} style={{ width: "100%" }}>
              {status === "loading" ? "Verifying…" : "Verify & Give Consent"}
            </Btn>
            <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", marginTop: 16 }}>
              Didn't receive OTP? <span style={{ color: "var(--accent)", cursor: "pointer" }}>Resend</span>
            </p>
          </>
        )}
      </Card>
    </div>
  );
}

function MyPolicies() {
  const { user } = useSelector((s) => s.auth);
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/policies/customer/${user?.id}`).then(({ data }) => setPolicies(data.policies || [])).finally(() => setLoading(false));
  }, [user]);

  const cols = [
    { key: "policy_number", label: "Policy #" },
    { key: "insurer_name", label: "Insurer" },
    { key: "product_name", label: "Product" },
    { key: "sum_assured", label: "Sum Assured", render: (r) => `₹${r.sum_assured?.toLocaleString()}` },
    { key: "annual_premium", label: "Premium", render: (r) => `₹${r.annual_premium?.toLocaleString()}` },
    { key: "status", label: "Status", render: (r) => <Badge label={r.status} /> },
  ];

  return (
    <div>
      <SectionHeader title="My Policies" />
      <Card>
        {loading ? <Spinner /> : <DataTable columns={cols} rows={policies} emptyText="No policies yet." />}
      </Card>
    </div>
  );
}

export default function CustomerDashboard() {
  return (
    <Routes>
      <Route index element={<MyCases />} />
      <Route path="documents" element={<div style={{ color: "var(--text-muted)" }}>Document upload portal — coming in next milestone.</div>} />
      <Route path="consent" element={<OTPConsent />} />
      <Route path="policies" element={<MyPolicies />} />
    </Routes>
  );
}
