import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { changePassword } from "../store/slices/authSlice";

export default function ResetPassword() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((s) => s.auth);
  const [current, setCurrent] = useState("");
  const [npass, setNpass] = useState("");
  const [confirm, setConfirm] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (npass !== confirm) return alert('Passwords do not match')
    const res = await dispatch(changePassword({ current_password: current, new_password: npass }));
    if (res.meta.requestStatus === 'fulfilled') {
      navigate('/dashboard')
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surface)', padding: 28, borderRadius: 12, width: 420 }}>
        <h2 style={{ marginTop: 0 }}>Change your password</h2>
        <p style={{ color: 'var(--text-muted)' }}>For security, please choose a new password.</p>
        {error && <div style={{ color: '#b91c1c', marginBottom: 12 }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input required type="password" placeholder="Current password" value={current} onChange={e => setCurrent(e.target.value)} />
          <input required type="password" placeholder="New password" value={npass} onChange={e => setNpass(e.target.value)} />
          <input required type="password" placeholder="Confirm new password" value={confirm} onChange={e => setConfirm(e.target.value)} />
          <button disabled={loading} style={{ background: 'var(--accent)', color: '#fff', padding: 10, borderRadius: 8, border: 'none' }}>
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
