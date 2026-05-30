import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { StatCard, DataTable, Badge, Card, SectionHeader, Btn, Alert, Spinner } from '../../components/common'
import { Home, FileText, ShieldCheck, Clock, ClipboardList, Stethoscope, Bell, UserRound, BarChart3, CalendarClock } from 'lucide-react'
import api from '../../services/api'

// ════════════════════════════════════════════════════════════════════
// CUSTOMER DASHBOARD
// ════════════════════════════════════════════════════════════════════

const STAGES = ['CUSTOMER_INTAKE', 'NEEDS_ANALYSIS', 'SUITABILITY_VALIDATION', 'QUOTE_RETRIEVAL',
  'QUOTE_COMPARISON', 'RECOMMENDATION', 'BANKER_APPROVAL', 'OTP_CONSENT',
  'PROPOSAL_GENERATION', 'MEDICAL_COORDINATION', 'UNDERWRITING', 'POLICY_ISSUANCE', 'COMPLETED']

const CUSTOMER_DOC_TYPES = [
  { key: 'PAN_CARD', label: 'PAN Card' },
  { key: 'ADDRESS_PROOF', label: 'Address Proof (Aadhaar / Voter ID)' },
  { key: 'SELFIE', label: 'Live Photo / Selfie' },
  { key: 'SIGNATURE', label: 'Signature' },
]

const humanizeKey = (key) => key.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase())

function findBestTradeOffText(quote) {
  const coverage = quote?.coverage_details ? JSON.stringify(quote.coverage_details) : ''
  const riders = quote?.riders ? JSON.stringify(quote.riders) : ''
  const exclusions = quote?.exclusions ? JSON.stringify(quote.exclusions) : ''
  const parts = []
  if (coverage) parts.push(`Coverage: ${coverage.slice(0, 120)}`)
  if (riders) parts.push(`Riders: ${riders.slice(0, 120)}`)
  if (exclusions) parts.push(`Exclusions: ${exclusions.slice(0, 120)}`)
  return parts.join(' • ') || 'No detailed trade-off data returned by the insurer.'
}

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
              {s.replace(/_/g, ' ')}
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
  const [loading, setL] = useState(true)
  useEffect(() => {
    api.get('/cases/').then(r => setCases(r.data.cases)).finally(() => setL(false))
  }, [])
  return (
    <div>
      <SectionHeader title="My Insurance Cases" />
      <div className="grid grid-cols-3 gap-4 mb-5">
        <StatCard title="Total" value={cases.length} icon={Home} />
        <StatCard title="Active" value={cases.filter(c => c.status === 'ACTIVE').length} color="#22c55e" icon={Clock} />
        <StatCard title="Completed" value={cases.filter(c => c.status === 'COMPLETED').length} color="#6366f1" icon={ShieldCheck} />
      </div>
      {loading ? <Spinner /> : cases.length === 0
        ? <Card className="text-center py-12 text-[#6b7280]">No cases yet. Contact your banker.</Card>
        : cases.map(c => (
          <Card key={c.id} className="mb-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-bold">{c.case_number}</p>
                <Badge label={c.status} />
                <div className="flex gap-2 mt-2 flex-wrap">
                  <Badge label={c.kyc_status || 'PENDING_KYC'} />
                  <Badge label={c.esign_status || 'NOT_STARTED'} />
                </div>
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

function CustomerProfileNeeds() {
  const { user } = useSelector(s => s.auth)
  const [cases, setCases] = useState([])
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [profile, setProfile] = useState({})
  const [needs, setNeeds] = useState({ purpose: '', term: '', sum_assured_goal: '', riders_needed: '' })
  const [profileEditable, setProfileEditable] = useState(false)
  const [bankerProfileSnapshot, setBankerProfileSnapshot] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
const [customers, setCustomers] = useState()
const [loadingCustomers, setLoadingCustomers] = useState(false)
  useEffect(() => {
     api.get('/cases/').then(r => {
      const ownCases = (r.data.cases || []).filter(c => c.customer_id === user?.id)
      setCases(ownCases)
      if (ownCases.length > 0) setSelectedCaseId(ownCases[0].id)
    }).finally(() => setLoading(false))
  }, [user])
 
  const loadCustomers = async () => {
  setLoadingCustomers(true)
  try {
    const { data } = await api.get('/banker/customers/logged-in-customer')
    const customerData = data.customer || {}
    setCustomers(customerData)
    console.log("Loaded customers2:", customerData)
        setProfileEditable(false)
    setProfile({
      name: customerData.normalized_payload.name || user?.name || '',
      email: customerData.normalized_payload.email || user?.email || '',
      phone: customerData.normalized_payload.phone || '',
      date_of_birth: customerData.normalized_payload.date_of_birth || customerData.dob || '',
      notes:` Customer ${customerData.normalized_payload.name || 'N/A'} from ${customerData.normalized_payload.city || 'Unknown City'} is a ${customerData.normalized_payload.age || 'N/A'} year old ${customerData.normalized_payload.gender || 'N/A'} customer working as ${customerData.normalized_payload.occupation || 'N/A'}.
      Her annual income is approximately ₹${customerData.normalized_payload.annual_income || '0'} with ${customerData.normalized_payload.dependents || '0'} dependents and a ${customerData.normalized_payload.risk_appetite || 'N/A'} risk appetite.
      The customer is ${customerData.normalized_payload.marital_status || 'N/A'}, is a ${customerData.normalized_payload.smoker === 'Yes' ? 'smoker' : 'non-smoker'}, and ${ customerData.normalized_payload.existing_insurance === 'Yes' ? 'currently has' : 'currently does not have any'} existing insurance coverage.`
    })
  } catch (error) {
    console.error('Error loading customers:', error)
    setError(error.response?.data?.detail || 'Failed to load customers')
  } finally {
    setLoadingCustomers(false)
  }
}

useEffect(() => {
  loadCustomers()
}, [])

  useEffect(() => {
    const selected = cases.find(c => c.id === selectedCaseId)
    if (!selected) return
    const currentProfile = selected.customer_profile || {}
    const currentNeeds = selected.needs_analysis || {}
    setBankerProfileSnapshot(currentProfile)
    // setProfileEditable(false)
    // setProfile({
    //   ...currentProfile,
    //   name: currentProfile.name || user?.name || '',
    //   email: currentProfile.email || user?.email || '',
    //   phone: currentProfile.phone || '',
    //   date_of_birth: currentProfile.date_of_birth || currentProfile.dob || '',
    //   notes: currentProfile.notes || '',
    // })
    setNeeds({
      purpose: currentNeeds.purpose || '',
      term: currentNeeds.term || '',
      sum_assured_goal: currentNeeds.sum_assured_goal || '',
      riders_needed: Array.isArray(currentNeeds.riders_needed) ? currentNeeds.riders_needed.join(', ') : (currentNeeds.riders_needed || ''),
    })
  }, [cases, selectedCaseId, user])

  const save = async () => {
    if (!selectedCaseId) return
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const profilePayload = {
        ...profile,
        annual_income: profile.annual_income ? Number(profile.annual_income) : null,
        dependents: profile.dependents ? Number(profile.dependents) : null,
      }
      const needsPayload = {
        purpose: needs.purpose,
        term: needs.term,
        sum_assured_goal: needs.sum_assured_goal,
        riders_needed: needs.riders_needed.split(',').map(x => x.trim()).filter(Boolean),
      }
      const { data } = await api.post(`/cases/${selectedCaseId}/customer-intake`, {
        customer_profile: profilePayload,
        needs_analysis: needsPayload,
      })
      setMessage(data.message || 'Profile and needs saved')
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save profile and needs')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <div>
      <SectionHeader title="Profile & Needs Intake" subtitle="Review or update your profile and insurance needs" />
      {error && <Alert type="error" message={error} />}
      {message && <Alert type="success" message={message} />}
      <Card className="mb-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-[#6b7280] block mb-1.5">Select Case</label>
            <select value={selectedCaseId} onChange={e => setSelectedCaseId(e.target.value)} className="w-full bg-[#0f1117] border border-[#2a2f45] rounded-lg px-3 py-2 text-sm outline-none">
              {cases.map(c => <option key={c.id} value={c.id}>{c.case_number}</option>)}
            </select>
          </div>
          <div className="rounded-lg border border-[#2a2f45] bg-[#0f1117] p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-[#6b7280]">Current KYC Status</p>
              <p className="font-semibold">{cases.find(c => c.id === selectedCaseId)?.kyc_status || 'PENDING_KYC'}</p>
            </div>
            <Badge label={cases.find(c => c.id === selectedCaseId)?.kyc_status || 'PENDING_KYC'} />
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="font-semibold">Your Profile</p>
            <Btn size="sm" variant="secondary" onClick={() => setProfileEditable(v => !v)}>
              {profileEditable ? 'Lock Profile' : 'Edit Profile'}
            </Btn>
          </div>
          <p className="text-xs text-[#6b7280] mb-3">Loaded from banker CSV. Use Edit Profile to make changes.</p>
          <div className="rounded-lg border border-[#2a2f45] bg-[#0f1117] p-4 mb-4">
            <p className="text-xs font-semibold text-[#6b7280] mb-3">Banker Provided Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {Object.entries(bankerProfileSnapshot || {}).length > 0 ? Object.entries(bankerProfileSnapshot).map(([key, value]) => (
                <div key={key} className="rounded-md border border-[#2a2f45] bg-[#111827] p-2">
                  <p className="text-[11px] uppercase tracking-wide text-[#6b7280]">{humanizeKey(key)}</p>
                  <p className="font-medium break-words">{Array.isArray(value) ? value.join(', ') : String(value ?? '—')}</p>
                </div>
              )) : (
                <p className="text-[#6b7280]">No banker profile data found for this case.</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries({ ...bankerProfileSnapshot, ...profile })
              .filter(([key]) => key !== 'notes')
              .map(([key, value]) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-[#6b7280] block mb-1.5">{humanizeKey(key)}</label>
                  <input
                    value={Array.isArray(value) ? value.join(', ') : String(profile[key] ?? value ?? '')}
                    onChange={(e) => setProfile(prev => ({ ...prev, [key]: e.target.value }))}
                    readOnly={!profileEditable}
                    className={`w-full border rounded-lg px-3 py-2 text-sm outline-none ${profileEditable ? 'bg-[#0f1117] border-[#2a2f45]' : 'bg-[#0b0d14] border-[#1f2436] text-[#94a3b8]'}`}
                    placeholder={humanizeKey(key)}
                  />
                </div>
              ))}
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-[#6b7280] block mb-1.5">Notes / Extra Details</label>
              <textarea
                value={profile.notes ?? ''}
                onChange={(e) => setProfile(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                readOnly={!profileEditable}
                className={`w-full border rounded-lg px-3 py-2 text-sm outline-none resize-none ${profileEditable ? 'bg-[#0f1117] border-[#2a2f45]' : 'bg-[#0b0d14] border-[#1f2436] text-[#94a3b8]'}`}
              />
            </div>
          </div>
          <p className="text-xs text-[#6b7280] mt-3">Only the fields above can be edited. The full banker-uploaded CSV details are shown in the snapshot above.</p>
        </Card>
        <Card>
          <p className="font-semibold mb-3">Needs Analysis</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-[#6b7280] block mb-1.5">Purpose</label>
              <input value={needs.purpose} onChange={e => setNeeds(prev => ({ ...prev, purpose: e.target.value }))} className="w-full bg-[#0f1117] border border-[#2a2f45] rounded-lg px-3 py-2 text-sm outline-none" placeholder="Family protection, retirement, tax planning" />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#6b7280] block mb-1.5">Policy Term</label>
              <input value={needs.term} onChange={e => setNeeds(prev => ({ ...prev, term: e.target.value }))} className="w-full bg-[#0f1117] border border-[#2a2f45] rounded-lg px-3 py-2 text-sm outline-none" placeholder="20 years" />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#6b7280] block mb-1.5">Target Sum Assured</label>
              <input value={needs.sum_assured_goal} onChange={e => setNeeds(prev => ({ ...prev, sum_assured_goal: e.target.value }))} className="w-full bg-[#0f1117] border border-[#2a2f45] rounded-lg px-3 py-2 text-sm outline-none" placeholder="5000000" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-[#6b7280] block mb-1.5">Riders Needed</label>
              <input value={needs.riders_needed} onChange={e => setNeeds(prev => ({ ...prev, riders_needed: e.target.value }))} className="w-full bg-[#0f1117] border border-[#2a2f45] rounded-lg px-3 py-2 text-sm outline-none" placeholder="Critical illness, accidental death" />
            </div>
          </div>
          <Btn className="mt-5" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Profile & Needs'}</Btn>
        </Card>
      </div>
    </div>
  )
}

function CustomerQuotes() {
  const { user } = useSelector(s => s.auth)
  const [cases, setCases] = useState([])
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/cases/').then(r => {
      const ownCases = (r.data.cases || []).filter(c => c.customer_id === user?.id)
      setCases(ownCases)
      if (ownCases.length > 0) setSelectedCaseId(ownCases[0].id)
    }).finally(() => setLoading(false))
  }, [user])

  const loadQuotes = async (caseId) => {
    if (!caseId) return
    setQuoteLoading(true)
    setError(null)
    try {
      const { data } = await api.get(`/quotes/case/${caseId}`)
      setQuotes(data.quotes || [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load quote summary')
    } finally {
      setQuoteLoading(false)
    }
  }

  useEffect(() => { if (selectedCaseId) loadQuotes(selectedCaseId) }, [selectedCaseId])

  if (loading) return <Spinner />

  return (
    <div>
      <SectionHeader title="Quote Summary & Recommendation" subtitle="Review AI-ranked quotes and compare trade-offs" />
      {error && <Alert type="error" message={error} />}
      <Card className="mb-5">
        <label className="text-xs font-semibold text-[#6b7280] block mb-1.5">Select Case</label>
        <select value={selectedCaseId} onChange={e => setSelectedCaseId(e.target.value)} className="w-full bg-[#0f1117] border border-[#2a2f45] rounded-lg px-3 py-2 text-sm outline-none">
          <option value="">Choose a case…</option>
          {cases.map(c => <option key={c.id} value={c.id}>{c.case_number} — {c.current_stage}</option>)}
        </select>
      </Card>
      {quoteLoading ? <Spinner /> : quotes.length === 0 ? (
        <Card className="text-center py-12 text-[#6b7280]">No quotes available yet. Ask your banker to fetch them.</Card>
      ) : (
        <div className="space-y-4">
          {quotes.map((quote, index) => (
            <Card key={quote.id} className={index === 0 ? 'border-[#6366f1]' : ''}>
              <div className="flex justify-between items-start gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <p className="font-bold text-lg">{quote.insurer_name}</p>
                    {index === 0 && <Badge label="AI Recommended" />}
                  </div>
                  <p className="text-sm text-[#6b7280]">{quote.product_name}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-[#22c55e] text-lg">₹{quote.annual_premium?.toLocaleString()}/yr</p>
                  <p className="text-xs text-[#6b7280]">Rank #{quote.ai_rank} · Score {((quote.ai_score || 0) * 100).toFixed(0)}%</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-sm">
                <div className="rounded-lg border border-[#2a2f45] bg-[#0f1117] p-3"><p className="text-xs text-[#6b7280]">Sum Assured</p><p className="font-semibold">₹{quote.sum_assured?.toLocaleString()}</p></div>
                <div className="rounded-lg border border-[#2a2f45] bg-[#0f1117] p-3"><p className="text-xs text-[#6b7280]">Tenure</p><p className="font-semibold">{quote.policy_tenure} yrs</p></div>
                <div className="rounded-lg border border-[#2a2f45] bg-[#0f1117] p-3"><p className="text-xs text-[#6b7280]">Coverage</p><p className="font-semibold">{quote.coverage_details ? 'Available' : 'Basic'}</p></div>
                <div className="rounded-lg border border-[#2a2f45] bg-[#0f1117] p-3"><p className="text-xs text-[#6b7280]">Riders</p><p className="font-semibold">{Array.isArray(quote.riders) ? quote.riders.length : 0}</p></div>
              </div>
              <div className="rounded-lg border border-[#2a2f45] bg-[#0f1117] p-4 text-sm">
                <p className="text-xs font-semibold text-[#6b7280] mb-2">Trade-off Narrative</p>
                <p>{quote.ai_recommendation_text || findBestTradeOffText(quote)}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function CustomerMedical() {
  const { user } = useSelector(s => s.auth)
  const [requests, setRequests] = useState([])
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.get('/cases/'), api.get('/medical/customer/requests')]).then(([casesRes, reqRes]) => {
      setCases((casesRes.data.cases || []).filter(c => c.customer_id === user?.id))
      setRequests(reqRes.data.requests || [])
    }).finally(() => setLoading(false))
  }, [user])

  if (loading) return <Spinner />

  return (
    <div>
      <SectionHeader title="Medical / Inspection Coordination" subtitle="Track medical requests and prepare for scheduled tests or inspections" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <StatCard title="Cases" value={cases.length} icon={CalendarClock} />
        <StatCard title="Requests" value={requests.length} color="#22c55e" icon={ClipboardList} />
        <StatCard title="Open" value={requests.filter(r => r.status === 'PENDING').length} color="#f59e0b" icon={Stethoscope} />
      </div>
      <Card>
        <DataTable
          columns={[
            { key: 'case_id', label: 'Case', render: r => r.case_id.slice(0, 8) + '…' },
            { key: 'status', label: 'Status', render: r => <Badge label={r.status} /> },
            { key: 'requirements', label: 'Requirements', render: r => (r.requirements || []).join(', ') },
            { key: 'created_at', label: 'Created', render: r => r.created_at ? new Date(r.created_at).toLocaleString() : '—' },
          ]}
          rows={requests}
          emptyText="No medical requests yet."
        />
      </Card>
      <Card className="mt-5 text-sm text-[#6b7280]">
        If a request is marked pending, complete the required uploads from the Documents page and wait for the ops team to confirm the schedule.
      </Card>
    </div>
  )
}

function OTPConsentPage() {
  const [otp, setOtp] = useState(Array(6).fill(''))
  const [caseId, setCaseId] = useState('')
  const [cases, setCases] = useState([])
  const [status, setStatus] = useState('idle')
  const [err, setErr] = useState(null)

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
    if (val && i < 5) document.getElementById(`otp-${i + 1}`)?.focus()
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
                      onKeyDown={e => e.key === 'Backspace' && !d && i > 0 && document.getElementById(`otp-${i - 1}`)?.focus()}
                      className="w-11 h-13 text-center text-xl font-bold rounded-lg border outline-none transition-colors"
                      style={{
                        background: '#0f1117', height: 52,
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

function CustomerDocuments() {
  const { user } = useSelector(s => s.auth)
  const [cases, setCases] = useState([])
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [requests, setRequests] = useState([])
  const [activeRequest, setActiveRequest] = useState(null)
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [submitting, setSubmitting] = useState({})
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [profileUpdateText, setProfileUpdateText] = useState('')
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [casesRes, reqRes] = await Promise.all([
        api.get('/cases/'),
        api.get('/medical/customer/requests'),
      ])
      const customerCases = (casesRes.data.cases || []).filter(c => c.customer_id === user?.id)
      setCases(customerCases)
      setRequests(reqRes.data.requests || [])
      if (!selectedCaseId && customerCases.length > 0) setSelectedCaseId(customerCases[0].id)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load customer documents')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [user])

  useEffect(() => {
    const request = requests.find(r => r.case_id === selectedCaseId) || null
    setActiveRequest(request)
    if (request) {
      api.get(`/documents/medical-request/${request.id}`)
        .then(r => setDocs(r.data.documents || []))
        .catch(() => setDocs([]))
    } else {
      setDocs([])
    }
  }, [requests, selectedCaseId])

  const createRequest = async () => {
    if (!selectedCaseId) {
      setError('Please choose a case first.')
      return
    }
    setCreating(true)
    setError(null)
    setMessage(null)
    try {
      const { data } = await api.post('/medical/customer/request', {
        case_id: selectedCaseId,
        requirements: CUSTOMER_DOC_TYPES.map(d => d.key),
      })
      setMessage(data.message || 'Document request created')
      await loadData()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to create document request')
    } finally {
      setCreating(false)
    }
  }

  const uploadDoc = async (documentType, file) => {
    if (!activeRequest || !file) return
    setSubmitting(prev => ({ ...prev, [documentType]: true }))
    setError(null)
    setMessage(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('medical_request_id', activeRequest.id)
      fd.append('document_type', documentType)
      await api.post('/medical/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setMessage(`${documentType} uploaded successfully`)
      const docsRes = await api.get(`/documents/medical-request/${activeRequest.id}`)
      setDocs(docsRes.data.documents || [])
    } catch (e) {
      setError(e.response?.data?.detail || `Failed to upload ${documentType}`)
    } finally {
      setSubmitting(prev => ({ ...prev, [documentType]: false }))
    }
  }

  const uploadedCount = docs.length
  const allUploaded = CUSTOMER_DOC_TYPES.every(d => docs.some(doc => doc.document_type === d.key))

  const submitProfileUpdate = async () => {
    if (!selectedCaseId || !profileUpdateText.trim()) {
      setError('Enter the details you want to update.')
      return
    }
    setError(null)
    setMessage(null)
    try {
      const { data } = await api.post('/medical/customer/profile-update-request', {
        case_id: selectedCaseId,
        requested_changes: { notes: profileUpdateText.trim() },
      })
      setMessage(data.message || 'Profile update request submitted')
      await loadData()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to submit profile update request')
    }
  }

  const completeEsign = async () => {
    if (!selectedCaseId) return
    setError(null)
    setMessage(null)
    try {
      const { data } = await api.post('/medical/customer/esign', {
        case_id: selectedCaseId,
        consent_text: 'I consent to KYC review and policy processing.',
      })
      setMessage(data.message || 'Mock eSign completed')
      await loadData()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to complete eSign')
    }
  }

  return (
    <div>
      <SectionHeader title="KYC & Document Upload" subtitle="Upload PAN, address proof, selfie, and signature for review" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <StatCard title="Cases" value={cases.length} icon={FileText} />
        <StatCard title="Uploaded Docs" value={uploadedCount} color="#22c55e" icon={ShieldCheck} />
        <StatCard title="Complete" value={allUploaded ? 'Yes' : 'No'} color={allUploaded ? '#22c55e' : '#f59e0b'} icon={Clock} />
      </div>

      {error && <Alert type="error" message={error} />}
      {message && <Alert type="success" message={message} />}

      <Card className="mb-5">
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-[#6b7280] block mb-1.5">Select Case</label>
            <select value={selectedCaseId} onChange={e => setSelectedCaseId(e.target.value)}
              className="w-full bg-[#0f1117] border border-[#2a2f45] rounded-lg px-3 py-2 text-sm outline-none">
              <option value="">Choose a case…</option>
              {cases.map(c => <option key={c.id} value={c.id}>{c.case_number} — {c.current_stage}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn onClick={createRequest} disabled={!selectedCaseId || creating}>
              {creating ? 'Creating…' : 'Create Document Request'}
            </Btn>
            <Btn variant="secondary" onClick={loadData} disabled={loading}>Refresh</Btn>
          </div>
          <p className="text-xs text-[#6b7280]">Create a request once per case. Then upload the required KYC documents below.</p>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <p className="font-semibold mb-3">Document Checklist</p>
          <div className="space-y-3">
            {CUSTOMER_DOC_TYPES.map(docType => {
              const uploaded = docs.find(d => d.document_type === docType.key)
              return (
                <div key={docType.key} className="rounded-lg border border-[#2a2f45] bg-[#0f1117] p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-semibold text-sm">{docType.label}</p>
                      <p className="text-xs text-[#6b7280]">{uploaded ? `Uploaded: ${uploaded.file_name}` : 'Pending upload'}</p>
                    </div>
                    <Badge label={uploaded ? 'Uploaded' : 'Pending'} />
                  </div>
                  <input
                    type="file"
                    className="block w-full text-sm text-[#6b7280] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#6366f1] file:text-white file:text-xs file:font-semibold cursor-pointer"
                    onChange={(e) => uploadDoc(docType.key, e.target.files?.[0])}
                    disabled={!activeRequest || submitting[docType.key]}
                  />
                </div>
              )
            })}
          </div>
        </Card>

        <Card>
          <p className="font-semibold mb-3">Review & Consent Prep</p>
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-[#2a2f45] bg-[#0f1117] p-4">
              <p className="text-xs font-semibold text-[#6b7280] mb-2">Current Request</p>
              {activeRequest ? (
                <>
                  <p className="font-semibold">Request ID: {activeRequest.id}</p>
                  <p className="text-[#6b7280]">Status: {activeRequest.status}</p>
                  <p className="text-[#6b7280]">Requirements: {(activeRequest.requirements || []).join(', ')}</p>
                </>
              ) : (
                <p className="text-[#6b7280]">No request created yet for this case.</p>
              )}
            </div>
            <div className="rounded-lg border border-[#2a2f45] bg-[#0f1117] p-4">
              <p className="text-xs font-semibold text-[#6b7280] mb-2">Request Profile Update</p>
              <textarea
                value={profileUpdateText}
                onChange={(e) => setProfileUpdateText(e.target.value)}
                rows={4}
                className="w-full bg-[#111827] border border-[#2a2f45] rounded-lg px-3 py-2 text-sm outline-none resize-none mb-3"
                placeholder="Describe what needs to be corrected in the pre-filled profile..."
              />
              <Btn size="sm" variant="secondary" onClick={submitProfileUpdate} disabled={!profileUpdateText.trim()}>Request Update</Btn>
            </div>
            <div className="rounded-lg border border-[#2a2f45] bg-[#0f1117] p-4">
              <p className="text-xs font-semibold text-[#6b7280] mb-2">Uploaded Documents</p>
              {docs.length ? (
                <ul className="space-y-2">
                  {docs.map(doc => (
                    <li key={doc.id} className="flex justify-between gap-3 text-sm">
                      <span>{doc.document_type}</span>
                      <span className="text-[#6b7280]">{doc.file_name}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[#6b7280]">No documents uploaded yet.</p>
              )}
            </div>
            <div className="rounded-lg border border-[#2a2f45] bg-[#0f1117] p-4">
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="mt-1" />
                <span>I confirm that the above documents are true and I accept the Terms & Conditions for KYC and policy processing.</span>
              </label>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Btn onClick={() => window.location.assign('/dashboard/customer/consent')} disabled={!allUploaded || !termsAccepted}>
                Proceed to OTP Consent
              </Btn>
              <Btn onClick={completeEsign} disabled={!allUploaded || !termsAccepted}>
                Mock eSign
              </Btn>
              <Btn variant="secondary" onClick={() => window.location.assign('/dashboard/customer/policies')}>
                View Policies
              </Btn>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

function CustomerPolicies() {
  const { user } = useSelector(s => s.auth)
  const [policies, setP] = useState([])
  const [loading, setL] = useState(true)
  useEffect(() => {
    api.get(`/policies/customer/${user?.id}`).then(r => setP(r.data.policies)).finally(() => setL(false))
  }, [user])
  const cols = [
    { key: 'policy_number', label: 'Policy #' },
    { key: 'insurer_name', label: 'Insurer' },
    { key: 'product_name', label: 'Product' },
    { key: 'sum_assured', label: 'Sum Assured', render: r => `₹${r.sum_assured?.toLocaleString()}` },
    { key: 'annual_premium', label: 'Premium', render: r => `₹${r.annual_premium?.toLocaleString()}` },
    { key: 'status', label: 'Status', render: r => <Badge label={r.status} /> },
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
      <Route index element={<CustomerMyCases />} />
      <Route path="profile" element={<CustomerProfileNeeds />} />
      <Route path="quotes" element={<CustomerQuotes />} />
      <Route path="consent" element={<OTPConsentPage />} />
      <Route path="policies" element={<CustomerPolicies />} />
      <Route path="documents" element={<CustomerDocuments />} />
      <Route path="medical" element={<CustomerMedical />} />
    </Routes>
  )
}

// ════════════════════════════════════════════════════════════════════
// UNDERWRITER DASHBOARD
// ════════════════════════════════════════════════════════════════════

function UWQueue() {
  const [queue, setQueue] = useState([])
  const [loading, setL] = useState(true)
  const [modal, setModal] = useState(null)
  const [decision, setD] = useState('APPROVED')
  const [remarks, setR] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)
  const [ok, setOk] = useState(null)

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
    { key: 'case_number', label: 'Case #' },
    { key: 'current_stage', label: 'Stage', render: r => <Badge label={r.current_stage} /> },
    { key: 'sum_assured', label: 'Sum Assured', render: r => r.sum_assured ? `₹${r.sum_assured.toLocaleString()}` : '—' },
    { key: 'created_at', label: 'Created', render: r => r.created_at ? new Date(r.created_at).toLocaleDateString() : '—' },
    { key: 'actions', label: '', render: r => <Btn size="sm" onClick={() => setModal(r)}>Review</Btn> },
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
        <StatCard title="Compliance Score" value={`${stats.compliance_score}%`} color="#22c55e" icon={ShieldCheck} />
        <StatCard title="Total Policies" value={stats.total_policies} icon={FileText} />
        <StatCard title="Checked" value={stats.checked} color="#6366f1" icon={ShieldCheck} />
        <StatCard title="Exceptions" value={stats.exceptions} color="#f59e0b" icon={Bell} />
      </div>
    </div>
  )
}

function ComplianceExceptions() {
  const [items, setItems] = useState([])
  const [loading, setL] = useState(true)
  useEffect(() => { api.get('/compliance/exceptions').then(r => setItems(r.data.exceptions)).finally(() => setL(false)) }, [])
  const cols = [
    { key: 'policy_number', label: 'Policy #' },
    { key: 'insurer_name', label: 'Insurer' },
    { key: 'status', label: 'Status', render: r => <Badge label={r.status} /> },
    { key: 'compliance_remarks', label: 'Remarks' },
  ]
  return <div><SectionHeader title="Exception Reports" /><Card>{loading ? <Spinner /> : <DataTable columns={cols} rows={items} emptyText="No exceptions." />}</Card></div>
}

function ComplianceConsents() {
  const [items, setItems] = useState([])
  const [loading, setL] = useState(true)
  useEffect(() => { api.get('/compliance/consents').then(r => setItems(r.data.consents)).finally(() => setL(false)) }, [])
  const cols = [
    { key: 'id', label: 'ID', render: r => r.id.slice(0, 8) + '…' },
    { key: 'case_id', label: 'Case', render: r => r.case_id.slice(0, 8) + '…' },
    { key: 'consent_type', label: 'Type' },
    { key: 'consented_at', label: 'Date', render: r => r.consented_at ? new Date(r.consented_at).toLocaleDateString() : '—' },
  ]
  return <div><SectionHeader title="Consent Records" /><Card>{loading ? <Spinner /> : <DataTable columns={cols} rows={items} emptyText="No consent records." />}</Card></div>
}

export function ComplianceDashboard() {
  return (
    <Routes>
      <Route index element={<ComplianceOverview />} />
      <Route path="exceptions" element={<ComplianceExceptions />} />
      <Route path="consents" element={<ComplianceConsents />} />
      <Route path="audit" element={<Card className="text-center py-10 text-[#6b7280]">See Admin → Audit Logs for full trail.</Card>} />
    </Routes>
  )
}

// ════════════════════════════════════════════════════════════════════
// OPS ADMIN DASHBOARD
// ════════════════════════════════════════════════════════════════════

function MedicalQueue() {
  const [queue, setQueue] = useState([])
  const [loading, setL] = useState(true)
  const [completing, setC] = useState({})

  const load = () => {
    setL(true)
    api.get('/medical/queue').then(r => setQueue(r.data.queue)).finally(() => setL(false))
  }
  useEffect(load, [])

  const complete = async id => {
    setC(c => ({ ...c, [id]: true }))
    await api.patch(`/medical/${id}/complete`)
    setQueue(q => q.filter(x => x.id !== id))
    setC(c => ({ ...c, [id]: false }))
  }

  const cols = [
    { key: 'id', label: 'Request ID', render: r => r.id.slice(0, 8) + '…' },
    { key: 'case_id', label: 'Case ID', render: r => r.case_id.slice(0, 8) + '…' },
    { key: 'requirements', label: 'Requirements', render: r => (r.requirements || []).join(', ') },
    { key: 'status', label: 'Status', render: r => <Badge label={r.status?.toUpperCase()} /> },
    { key: 'created_at', label: 'Created', render: r => r.created_at ? new Date(r.created_at).toLocaleDateString() : '—' },
    { key: 'actions', label: '', render: r => <Btn size="sm" variant="success" onClick={() => complete(r.id)} disabled={completing[r.id]}>Mark Done</Btn> },
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
    { key: 'case_id', label: 'Case', render: r => r.case_id.slice(0, 8) + '…' },
    { key: 'level', label: 'Level', render: r => <Badge label={r.level} /> },
    { key: 'stage', label: 'Stage' },
    { key: 'assigned_to_role', label: 'Role' },
    { key: 'created_at', label: 'Time', render: r => r.created_at ? new Date(r.created_at).toLocaleDateString() : '—' },
  ]
  return <div><SectionHeader title="Active Escalations" /><Card>{loading ? <Spinner /> : <DataTable columns={cols} rows={escs} emptyText="No escalations." />}</Card></div>
}

export function OpsAdminDashboard() {
  return (
    <Routes>
      <Route index element={<MedicalQueue />} />
      <Route path="escalations" element={<OpsEscalations />} />
      <Route path="sla" element={<OpsEscalations />} />
    </Routes>
  )
}
