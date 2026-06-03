import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { StatCard, DataTable, Badge, Card, SectionHeader, Btn, Input, Select, Alert, Spinner, Modal } from '../../components/common'
import { Users, FileText, Bell, ClipboardList, Shield } from 'lucide-react'
import api from '../../services/api'
import { KnowledgeBase, RAGChat } from '../../components/common/RAGComponents'

// ── Overview ──────────────────────────────────────────────────────────
function Overview() {
  const [stats, setStats] = useState(null)
  useEffect(() => { api.get('/admin/stats').then(r => setStats(r.data)) }, [])
  if (!stats) return <Spinner />
  return (
    <div>
      <SectionHeader title="Platform Overview" subtitle="Real-time statistics across the entire platform" />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard title="Total Users"      value={stats.total_users}      icon={Users} />
        <StatCard title="Total Cases"      value={stats.total_cases}      icon={FileText} />
        <StatCard title="Active Cases"     value={stats.active_cases}     color="#22c55e" icon={FileText} />
        <StatCard title="Completed"        value={stats.completed_cases}  color="#6366f1" icon={Shield} />
        <StatCard title="Open Escalations" value={stats.open_escalations} color="#f59e0b" icon={Bell} />
      </div>
    </div>
  )
}

// ── User Management ───────────────────────────────────────────────────
function UserManagement() {
  const [users, setUsers]     = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [form, setForm]       = useState({ name:'', email:'', password:'', role:'BANKER', phone:'' })
  const [err, setErr]         = useState(null)
  const [saving, setSaving]   = useState(false)

  const load = () => {
    setLoading(true)
    api.get('/admin/users').then(r => setUsers(r.data.users)).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const create = async () => {
    setSaving(true); setErr(null)
    try { await api.post('/admin/users', form); setModal(false); load() }
    catch (e) { setErr(e.response?.data?.detail || 'Failed') }
    finally { setSaving(false) }
  }

  const remove = async id => {
    if (!confirm('Delete this user?')) return
    await api.delete(`/admin/users/${id}`)
    setUsers(u => u.filter(x => x.id !== id))
  }

  const toggle = async id => {
    await api.patch(`/admin/users/${id}/toggle-active`)
    load()
  }

  const cols = [
    { key:'name',       label:'Name' },
    { key:'email',      label:'Email' },
    { key:'role',       label:'Role',   render: r => <Badge label={r.role} /> },
    { key:'is_active',  label:'Active', render: r => r.is_active ? '✅' : '❌' },
    { key:'created_at', label:'Joined', render: r => r.created_at ? new Date(r.created_at).toLocaleDateString() : '—' },
    { key:'actions',    label:'',
      render: r => (
        <div className="flex gap-2">
          <Btn size="sm" variant="secondary" onClick={() => toggle(r.id)}>Toggle</Btn>
          <Btn size="sm" variant="danger"    onClick={() => remove(r.id)}>Remove</Btn>
        </div>
      )
    },
  ]

  const roles = ['SUPER_ADMIN','BANKER','CUSTOMER','UNDERWRITER','COMPLIANCE','OPS_ADMIN'].map(r => ({ value:r, label:r }))

  return (
    <div>
      <SectionHeader title="User Management"
        action={<Btn onClick={() => setModal(true)}>+ Add User</Btn>} />
      <Card>{loading ? <Spinner /> : <DataTable columns={cols} rows={users} emptyText="No users found." />}</Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Create User">
        {err && <Alert type="error" message={err} />}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Name"     value={form.name}     onChange={v => setForm(f => ({...f, name:v}))}     placeholder="Full name" />
          <Input label="Email"    value={form.email}    onChange={v => setForm(f => ({...f, email:v}))}    placeholder="email@bank.com" />
          <Input label="Password" value={form.password} onChange={v => setForm(f => ({...f, password:v}))} type="password" placeholder="••••••••" />
          <Input label="Phone"    value={form.phone}    onChange={v => setForm(f => ({...f, phone:v}))}    placeholder="+91 9876543210" />
        </div>
        <Select label="Role" value={form.role} onChange={v => setForm(f => ({...f, role:v}))} options={roles} className="mt-3" />
        <div className="flex gap-3 mt-5">
          <Btn onClick={create} disabled={saving}>{saving ? 'Creating…' : 'Create User'}</Btn>
          <Btn variant="secondary" onClick={() => setModal(false)}>Cancel</Btn>
        </div>
      </Modal>
    </div>
  )
}

// ── Audit Logs ────────────────────────────────────────────────────────
function AuditLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setL] = useState(true)
  useEffect(() => { api.get('/admin/audit-logs').then(r => setLogs(r.data.logs)).finally(() => setL(false)) }, [])
  const cols = [
    { key:'action',      label:'Action' },
    { key:'entity_type', label:'Entity' },
    { key:'user_id',     label:'User',   render: r => r.user_id ? r.user_id.slice(0,8)+'…' : 'system' },
    { key:'ip_address',  label:'IP' },
    { key:'created_at',  label:'Time',   render: r => r.created_at ? new Date(r.created_at).toLocaleString() : '—' },
  ]
  return (
    <div>
      <SectionHeader title="Audit Logs" subtitle="Full system audit trail" />
      <Card>{loading ? <Spinner /> : <DataTable columns={cols} rows={logs} emptyText="No logs." />}</Card>
    </div>
  )
}

// ── Escalations ───────────────────────────────────────────────────────
function EscalationsView() {
  const [escs, setEscs] = useState([])
  const [loading, setL] = useState(true)
  useEffect(() => { api.get('/admin/escalations').then(r => setEscs(r.data.escalations)).finally(() => setL(false)) }, [])
  const cols = [
    { key:'case_id',          label:'Case',   render: r => r.case_id.slice(0,8)+'…' },
    { key:'level',            label:'Level',  render: r => <Badge label={r.level} /> },
    { key:'stage',            label:'Stage' },
    { key:'assigned_to_role', label:'Assigned To' },
    { key:'reason',           label:'Reason', render: r => <span className="text-xs text-[#6b7280]">{r.reason?.slice(0,50)}…</span> },
    { key:'created_at',       label:'Time',   render: r => r.created_at ? new Date(r.created_at).toLocaleDateString() : '—' },
  ]
  return (
    <div>
      <SectionHeader title="Active Escalations" />
      <Card>{loading ? <Spinner /> : <DataTable columns={cols} rows={escs} emptyText="No active escalations." />}</Card>
    </div>
  )
}


export default function SuperAdminDashboard() {
  return (
    <Routes>
      <Route index           element={<Overview />} />
      <Route path="users"    element={<UserManagement />} />
      <Route path="audit"    element={<AuditLogs />} />
      <Route path="escalations" element={<EscalationsView />} />
      <Route path="kb"       element={<KnowledgeBase />} />
      <Route path="rag-chat" element={<RAGChat />} />
    </Routes>
  )
}
