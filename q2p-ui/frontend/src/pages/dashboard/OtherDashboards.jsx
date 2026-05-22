import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { StatCard, DataTable, Badge, Card, SectionHeader, Btn, Alert, Spinner } from '../../components/common'
import { Home, FileText, ShieldCheck, Clock, ClipboardList, Stethoscope, Bell } from 'lucide-react'
import api from '../../services/api'

// ════════════════════════════════════════════════════════════════════
// CUSTOMER DASHBOARD
// ════════════════════════════════════════════════════════════════════

const STAGES = ['CUSTOMER_INTAKE','NEEDS_ANALYSIS','SUITABILITY_VALIDATION','QUOTE_RETRIEVAL',
  'QUOTE_COMPARISON','RECOMMENDATION','BANKER_APPROVAL','OTP_CONSENT',
  'PROPOSAL_GENERATION','MEDICAL_COORDINATION','UNDERWRITING','POLICY_ISSUANCE','COMPLETED']

function StageTimeline({ stage }) {
  const idx = STAGES.indexOf(stage)
  return (
    <div className="flex overflow-x-auto gap-0 py-3 pb-1">
      {STAGES.map((s, i) => (
        <div key={s} className="flex items-center">
          <div className="flex flex-col items-center gap-1 min-w-[80px]">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{
                background: i < idx ? '#22c55e' : i === idx ? '#6366f1' : 'transparent',
                border: `2px solid ${i < idx ? '#22c55e' : i === idx ? '#6366f1' : '#2a2f45'}`,
                color: i <= idx ? '#fff' : '#6b7280',
              }}>
              {i < idx ? '✓' : i + 1}
            </div>
            <span className="text-[9px] text-center leading-tight" style={{ color: i <= idx ? '#e8eaf0' : '#6b7280' }}>
              {s.replace(/_/g,' ')}
            </span>
          </div>
          {i < STAGES.length - 1 && (
            <div className="h-0.5 w-5 mb-5 flex-shrink-0" style={{ background: i < idx ? '#22c55e' : '#2a2f45' }} />
          )}
        </div>
      ))}
    </div>
  )
}

function CustomerMyCases() {
  const { user } = useSelector(s => s.auth)
  const [cases, setCases] = useState([])
  const [loading, setL]   = useState(true)
  useEffect(() => {
    api.get('/cases/').then(r => setCases(r.data.cases)).finally(() => setL(false))
  }, [])
  return (
    <div>
      <SectionHeader title="My Insurance Cases" />
      <div className="grid grid-cols-3 gap-4 mb-5">
        <StatCard title="Total"     value={cases.length}                                  icon={Home} />
        <StatCard title="Active"    value={cases.filter(c=>c.status==='ACTIVE').length}    color="#22c55e" icon={Clock} />
        <StatCard title="Completed" value={cases.filter(c=>c.status==='COMPLETED').length} color="#6366f1" icon={ShieldCheck} />
      </div>
      {loading ? <Spinner /> : cases.length === 0
        ? <Card className="text-center py-12 text-[#6b7280]">No cases yet. Contact your banker.</Card>
        : cases.map(c => (
          <Card key={c.id} className="mb-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-bold">{c.case_number}</p>
                <Badge label={c.status} />
              </div>
              <p className="text-sm font-bold text-[#22c55e]">{c.sum_assured ? `₹${c.sum_assured.toLocaleString()}` : ''}</p>
            </div>
            <StageTimeline stage={c.current_stage} />
          </Card>
        ))
      }
    </div>
  )
}

function OTPConsentPage() {
  const [otp, setOtp]         = useState(Array(6).fill(''))
  const [caseId, setCaseId]   = useState('')
  const [cases, setCases]     = useState([])
  const [status, setStatus]   = useState('idle')
  const [err, setErr]         = useState(null)

  useEffect(() => {
    api.get('/cases/').then(r => {
      const otpCases = r.data.cases.filter(c => c.current_stage === 'OTP_CONSENT')
      setCases(otpCases)
      if (otpCases.length > 0) setCaseId(otpCases[0].id)
    })
  }, [])

  const handleDigit = (i, val) => {
    if (!/^\d?$/.test(val)) return
    const next = [...otp]; next[i] = val; setOtp(next)
    if (val && i < 5) document.getElementById(`otp-${i+1}`)?.focus()
  }

  const sendOTP = async () => {
    if (!caseId) return
    try { await api.post('/otp/send', { case_id: caseId }); setStatus('sent') }
    catch (e) { setErr(e.response?.data?.detail || 'Failed to send OTP') }
  }

  const verify = async () => {
    setStatus('verifying'); setErr(null)
    try {
      await api.post('/otp/verify', { case_id: caseId, otp_code: otp.join('') })
      setStatus('success')
    } catch (e) { setErr(e.response?.data?.detail || 'Invalid OTP'); setStatus('sent') }
  }

  return (
    <div>
      <SectionHeader title="OTP Consent" subtitle="Provide your consent via OTP for policy issuance" />
      <Card className="max-w-md">
        {status === 'success' ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-lg font-bold text-[#22c55e] mb-2">Consent Verified!</h3>
            <p className="text-sm text-[#6b7280]">Your policy is being processed.</p>
          </div>
        ) : (
          <>
            {cases.length > 0 && (
              <div className="mb-5">
                <label className="text-xs font-semibold text-[#6b7280] block mb-1.5">Select Case</label>
                <select value={caseId} onChange={e => setCaseId(e.target.value)}
                  className="w-full bg-[#0f1117] border border-[#2a2f45] rounded-lg px-3 py-2 text-sm outline-none">
                  {cases.map(c => <option key={c.id} value={c.id}>{c.case_number}</option>)}
                </select>
              </div>
            )}
            {err && <Alert type="error" message={err} />}
            {status === 'idle' && (
              <div className="text-center">
                <p className="text-sm text-[#6b7280] mb-5">Click below to receive an OTP on your registered email.</p>
                <Btn onClick={sendOTP} className="w-full">Send OTP to Email</Btn>
              </div>
            )}
            {(status === 'sent' || status === 'verifying') && (
              <>
                <p className="text-sm text-[#6b7280] mb-4 text-center">Enter the 6-digit OTP sent to your email.</p>
                <div className="flex gap-2 justify-center mb-5">
                  {otp.map((d, i) => (
                    <input key={i} id={`otp-${i}`} maxLength={1} value={d}
                      onChange={e => handleDigit(i, e.target.value)}
                      onKeyDown={e => e.key === 'Backspace' && !d && i > 0 && document.getElementById(`otp-${i-1}`)?.focus()}
                      className="w-11 h-13 text-center text-xl font-bold rounded-lg border outline-none transition-colors"
                      style={{
                        background:'#0f1117', height:52,
                        borderColor: d ? '#6366f1' : '#2a2f45',
                        color: '#e8eaf0',
                      }} />
                  ))}
                </div>
                <Btn onClick={verify} disabled={otp.join('').length < 6 || status === 'verifying'} className="w-full">
                  {status === 'verifying' ? 'Verifying…' : 'Verify & Give Consent'}
                </Btn>
                <p className="text-center text-xs text-[#6b7280] mt-3">
                  Didn't receive?{' '}
                  <span className="text-[#6366f1] cursor-pointer" onClick={() => { setStatus('idle'); setOtp(Array(6).fill('')) }}>Resend</span>
                </p>
              </>
            )}
          </>
        )}
      </Card>
    </div>
  )
}

function CustomerPolicies() {
  const { user } = useSelector(s => s.auth)
  const [policies, setP] = useState([])
  const [loading, setL]  = useState(true)
  useEffect(() => {
    api.get(`/policies/customer/${user?.id}`).then(r => setP(r.data.policies)).finally(() => setL(false))
  }, [user])
  const cols = [
    { key:'policy_number', label:'Policy #' },
    { key:'insurer_name',  label:'Insurer' },
    { key:'product_name',  label:'Product' },
    { key:'sum_assured',   label:'Sum Assured', render: r => `₹${r.sum_assured?.toLocaleString()}` },
    { key:'annual_premium',label:'Premium',     render: r => `₹${r.annual_premium?.toLocaleString()}` },
    { key:'status',        label:'Status',      render: r => <Badge label={r.status} /> },
  ]
  return (
    <div>
      <SectionHeader title="My Policies" />
      <Card>{loading ? <Spinner /> : <DataTable columns={cols} rows={policies} emptyText="No policies yet." />}</Card>
    </div>
  )
}

export function CustomerDashboard() {
  return (
    <Routes>
      <Route index          element={<CustomerMyCases />} />
      <Route path="consent" element={<OTPConsentPage />} />
      <Route path="policies" element={<CustomerPolicies />} />
      <Route path="documents" element={<Card className="text-center py-12 text-[#6b7280]">Document upload coming soon.</Card>} />
    </Routes>
  )
}

// ════════════════════════════════════════════════════════════════════
// UNDERWRITER DASHBOARD
// ════════════════════════════════════════════════════════════════════

function UWQueue() {
  const [queue, setQueue] = useState([])
  const [loading, setL]   = useState(true)
  const [modal, setModal] = useState(null)
  const [decision, setD]  = useState('APPROVED')
  const [remarks, setR]   = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr]     = useState(null)
  const [ok, setOk]       = useState(null)

  useEffect(() => {
    api.get('/underwriting/queue').then(r => setQueue(r.data.queue)).finally(() => setL(false))
  }, [])

  const submit = async policyId => {
    setSaving(true); setErr(null)
    try {
      await api.post('/underwriting/decision', { policy_id: policyId, decision, remarks })
      setOk(`Decision "${decision}" recorded.`)
      setModal(null)
      api.get('/underwriting/queue').then(r => setQueue(r.data.queue))
    } catch (e) { setErr(e.response?.data?.detail || 'Failed') }
    finally { setSaving(false) }
  }

  const cols = [
    { key:'case_number',   label:'Case #' },
    { key:'current_stage', label:'Stage',  render: r => <Badge label={r.current_stage} /> },
    { key:'sum_assured',   label:'Sum Assured', render: r => r.sum_assured ? `₹${r.sum_assured.toLocaleString()}` : '—' },
    { key:'created_at',    label:'Created',     render: r => r.created_at ? new Date(r.created_at).toLocaleDateString() : '—' },
    { key:'actions',       label:'',            render: r => <Btn size="sm" onClick={() => setModal(r)}>Review</Btn> },
  ]

  return (
    <div>
      <SectionHeader title="Underwriting Queue" subtitle="Cases pending UW review" />
      <div className="grid grid-cols-1 gap-4 mb-5">
        <StatCard title="Pending Review" value={queue.length} icon={ClipboardList} />
      </div>
      {ok && <Alert type="success" message={ok} />}
      <Card>{loading ? <Spinner /> : <DataTable columns={cols} rows={queue} emptyText="No cases in UW queue." />}</Card>

      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#161b2e] border border-[#2a2f45] rounded-xl p-6 w-full max-w-md">
            <h3 className="font-bold font-display text-lg mb-4">UW Decision — {modal.case_number}</h3>
            {err && <Alert type="error" message={err} />}
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-[#6b7280] block mb-1.5">Decision</label>
                <select value={decision} onChange={e => setD(e.target.value)}
                  className="w-full bg-[#0f1117] border border-[#2a2f45] rounded-lg px-3 py-2 text-sm outline-none">
                  <option value="APPROVED">Approve</option>
                  <option value="REJECTED">Reject</option>
                  <option value="DEFERRED">Defer</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#6b7280] block mb-1.5">Remarks</label>
                <textarea value={remarks} onChange={e => setR(e.target.value)} rows={3}
                  className="w-full bg-[#0f1117] border border-[#2a2f45] rounded-lg px-3 py-2 text-sm outline-none resize-none"
                  placeholder="UW remarks…" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <Btn onClick={() => submit(modal.id)} disabled={saving}>{saving ? 'Submitting…' : 'Submit Decision'}</Btn>
              <Btn variant="secondary" onClick={() => setModal(null)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function UnderwriterDashboard() {
  return <Routes><Route index element={<UWQueue />} /><Route path="decisions" element={<UWQueue />} /></Routes>
}

// ════════════════════════════════════════════════════════════════════
// COMPLIANCE DASHBOARD
// ════════════════════════════════════════════════════════════════════

function ComplianceOverview() {
  const [stats, setStats] = useState(null)
  useEffect(() => { api.get('/compliance/dashboard').then(r => setStats(r.data)) }, [])
  if (!stats) return <Spinner />
  return (
    <div>
      <SectionHeader title="Compliance Dashboard" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard title="Compliance Score" value={`${stats.compliance_score}%`}  color="#22c55e" icon={ShieldCheck} />
        <StatCard title="Total Policies"   value={stats.total_policies}           icon={FileText} />
        <StatCard title="Checked"          value={stats.checked}                  color="#6366f1" icon={ShieldCheck} />
        <StatCard title="Exceptions"       value={stats.exceptions}               color="#f59e0b" icon={Bell} />
      </div>
    </div>
  )
}

function ComplianceExceptions() {
  const [items, setItems] = useState([])
  const [loading, setL]   = useState(true)
  useEffect(() => { api.get('/compliance/exceptions').then(r => setItems(r.data.exceptions)).finally(() => setL(false)) }, [])
  const cols = [
    { key:'policy_number',      label:'Policy #' },
    { key:'insurer_name',       label:'Insurer' },
    { key:'status',             label:'Status',   render: r => <Badge label={r.status} /> },
    { key:'compliance_remarks', label:'Remarks' },
  ]
  return <div><SectionHeader title="Exception Reports" /><Card>{loading ? <Spinner /> : <DataTable columns={cols} rows={items} emptyText="No exceptions." />}</Card></div>
}

function ComplianceConsents() {
  const [items, setItems] = useState([])
  const [loading, setL]   = useState(true)
  useEffect(() => { api.get('/compliance/consents').then(r => setItems(r.data.consents)).finally(() => setL(false)) }, [])
  const cols = [
    { key:'id',           label:'ID',       render: r => r.id.slice(0,8)+'…' },
    { key:'case_id',      label:'Case',     render: r => r.case_id.slice(0,8)+'…' },
    { key:'consent_type', label:'Type' },
    { key:'consented_at', label:'Date',     render: r => r.consented_at ? new Date(r.consented_at).toLocaleDateString() : '—' },
  ]
  return <div><SectionHeader title="Consent Records" /><Card>{loading ? <Spinner /> : <DataTable columns={cols} rows={items} emptyText="No consent records." />}</Card></div>
}

export function ComplianceDashboard() {
  return (
    <Routes>
      <Route index            element={<ComplianceOverview />} />
      <Route path="exceptions" element={<ComplianceExceptions />} />
      <Route path="consents"   element={<ComplianceConsents />} />
      <Route path="audit"      element={<Card className="text-center py-10 text-[#6b7280]">See Admin → Audit Logs for full trail.</Card>} />
    </Routes>
  )
}

// ════════════════════════════════════════════════════════════════════
// OPS ADMIN DASHBOARD
// ════════════════════════════════════════════════════════════════════

function MedicalQueue() {
  const [queue, setQueue]   = useState([])
  const [loading, setL]     = useState(true)
  const [completing, setC]  = useState({})

  const load = () => {
    setL(true)
    api.get('/medical/queue').then(r => setQueue(r.data.queue)).finally(() => setL(false))
  }
  useEffect(load, [])

  const complete = async id => {
    setC(c => ({...c, [id]:true}))
    await api.patch(`/medical/${id}/complete`)
    setQueue(q => q.filter(x => x.id !== id))
    setC(c => ({...c, [id]:false}))
  }

  const cols = [
    { key:'id',           label:'Request ID', render: r => r.id.slice(0,8)+'…' },
    { key:'case_id',      label:'Case ID',    render: r => r.case_id.slice(0,8)+'…' },
    { key:'requirements', label:'Requirements', render: r => (r.requirements||[]).join(', ') },
    { key:'status',       label:'Status',     render: r => <Badge label={r.status?.toUpperCase()} /> },
    { key:'created_at',   label:'Created',    render: r => r.created_at ? new Date(r.created_at).toLocaleDateString() : '—' },
    { key:'actions',      label:'',           render: r => <Btn size="sm" variant="success" onClick={() => complete(r.id)} disabled={completing[r.id]}>Mark Done</Btn> },
  ]

  return (
    <div>
      <SectionHeader title="Medical Coordination Queue" />
      <div className="mb-5">
        <StatCard title="Pending Medical Requests" value={queue.length} icon={Stethoscope} color="#2dd4bf" />
      </div>
      <Card>{loading ? <Spinner /> : <DataTable columns={cols} rows={queue} emptyText="No pending medical requests." />}</Card>
    </div>
  )
}

function OpsEscalations() {
  const [escs, setEscs] = useState([])
  const [loading, setL] = useState(true)
  useEffect(() => { api.get('/admin/escalations').then(r => setEscs(r.data.escalations)).finally(() => setL(false)) }, [])
  const cols = [
    { key:'case_id',          label:'Case',   render: r => r.case_id.slice(0,8)+'…' },
    { key:'level',            label:'Level',  render: r => <Badge label={r.level} /> },
    { key:'stage',            label:'Stage' },
    { key:'assigned_to_role', label:'Role' },
    { key:'created_at',       label:'Time',   render: r => r.created_at ? new Date(r.created_at).toLocaleDateString() : '—' },
  ]
  return <div><SectionHeader title="Active Escalations" /><Card>{loading ? <Spinner /> : <DataTable columns={cols} rows={escs} emptyText="No escalations." />}</Card></div>
}

export function OpsAdminDashboard() {
  return (
    <Routes>
      <Route index            element={<MedicalQueue />} />
      <Route path="escalations" element={<OpsEscalations />} />
      <Route path="sla"         element={<OpsEscalations />} />
    </Routes>
  )
}
