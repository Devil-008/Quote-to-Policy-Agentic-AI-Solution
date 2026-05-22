import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../store/slices/authSlice";

const ROLES = ["BANKER", "CUSTOMER", "UNDERWRITER", "COMPLIANCE", "OPS_ADMIN"];

export default function RegisterPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((s) => s.auth);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "CUSTOMER", phone: "" });

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await dispatch(registerUser(form));
    if (res.meta.requestStatus === "fulfilled") navigate("/login");
  };

  const inputStyle = {
    background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8,
    padding: "10px 12px", color: "var(--text)", fontSize: 14, outline: "none", width: "100%",
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 40, width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 16, margin: "0 auto 12px" }}>Q2P</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Create account</h1>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {error && <div style={{ background: "#ef444415", border: "1px solid #ef444444", color: "#ef4444", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>{error}</div>}

          {[
            { label: "Full name", key: "name", type: "text", placeholder: "John Doe" },
            { label: "Email", key: "email", type: "email", placeholder: "you@bank.com" },
            { label: "Password", key: "password", type: "password", placeholder: "••••••••" },
            { label: "Phone (optional)", key: "phone", type: "tel", placeholder: "+91 9876543210" },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{label}</label>
              <input type={type} value={form[key]} onChange={(e) => set(key)(e.target.value)} placeholder={placeholder} required={key !== "phone"} style={inputStyle} />
            </div>
          ))}

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Role</label>
            <select value={form.role} onChange={(e) => set("role")(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              {ROLES.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
            </select>
          </div>

          <button type="submit" disabled={loading} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: 12, fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, marginTop: 4 }}>
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-muted)", marginTop: 20 }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
