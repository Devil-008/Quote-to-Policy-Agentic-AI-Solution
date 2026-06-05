import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { StatCard, DataTable, Badge, Card, SectionHeader, Btn, Alert, Spinner } from '../../components/common'
import { Home, FileText, ShieldCheck, Clock, ClipboardList, Stethoscope, Bell, UserRound, BarChart3, CalendarClock } from 'lucide-react'
import api from '../../services/api'
import { KnowledgeBase, RAGChat } from '../../components/common/RAGComponents'

// Strip HTML tags and decode basic HTML entities to plain text
function stripHtml(html) {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}


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
  const [needsOpen, setNeedsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  // Ordered profile fields — display name + key
  const PROFILE_FIELDS = [
    { key: 'customer_id',     label: 'Customer ID',           readOnly: true },
    { key: 'name',            label: 'Full Name' },
    { key: 'email',           label: 'Email Address' },
    { key: 'phone',           label: 'Phone Number' },
    { key: 'date_of_birth',   label: 'Date of Birth' },
    { key: 'gender',          label: 'Gender' },
    { key: 'marital_status',  label: 'Marital Status' },
    { key: 'occupation',      label: 'Occupation' },
    { key: 'smoker',          label: 'Smoker' },
    { key: 'annual_income',   label: 'Annual Income (₹)' },
    { key: 'dependents',      label: 'Number of Dependents' },
    { key: 'city',            label: 'City' },
    { key: 'pan_number',      label: 'PAN Number' },
    { key: 'aadhaar_number',  label: 'Aadhaar Last 4 Digits' },
    { key: 'medical_history', label: 'Medical History', fullWidth: true },
  ]

  useEffect(() => {
    api.get('/cases/').then(r => {
      const ownCases = (r.data.cases || []).filter(c => c.customer_id === user?.id)
      setCases(ownCases)
      if (ownCases.length > 0) setSelectedCaseId(ownCases[0].id)
    }).finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    const selected = cases.find(c => c.id === selectedCaseId)
    if (!selected) return
    const cp = selected.customer_profile || {}
    const cn = selected.needs_analysis || {}
    setProfileEditable(false)
    setProfile({
      customer_id:    cp.customer_id    || cp['Customer ID'] || cp.id || selectedCase?.id || '',
      name:           cp.name           || cp['Name']        || user?.name  || '',
      email:          cp.email          || cp['Email']       || user?.email || '',
      phone:          cp.phone          || cp['Phone']       || '',
      date_of_birth:  cp.date_of_birth  || cp.dob            || cp['DOB']   || '',
      gender:         cp.gender         || cp['Gender']      || '',
      marital_status: cp.marital_status || cp['Marital_Status'] || cp['Marital Status'] || '',
      occupation:     cp.occupation     || cp['Occupation']  || '',
      smoker:         cp.smoker         !== undefined ? String(cp.smoker) : (cp['Smoker'] || ''),
      annual_income:  cp.annual_income  || cp['Annual Income'] || '',
      dependents:     cp.dependents     !== undefined ? cp.dependents : (cp['Dependents'] || ''),
      city:           cp.city           || cp['City']        || '',
      state:          cp.state          || cp['State']       || '',
      pincode:        cp.pincode        || cp['Pincode']     || '',
      pan_number:     cp.pan_number     || cp['PAN_Number']  || cp['PAN']    || cp['Pan'] || '',
      aadhaar_number: cp.aadhaar_number || cp['Aadhaar_Last4']|| cp['Aadhaar']|| cp['Aadhar'] || '',
      medical_history:cp.medical_history|| cp['Medical_History'] || cp['Medical History'] || '',
      notes:          cp.notes          || '',
    })
    setNeeds({
      purpose:          cn.purpose           || '',
      term:             cn.term              || '',
      sum_assured_goal: cn.sum_assured_goal  || '',
      riders_needed:    Array.isArray(cn.riders_needed)
                          ? cn.riders_needed.join(', ')
                          : (cn.riders_needed || ''),
    })
  }, [cases, selectedCaseId, user])

  const save = async () => {
    if (!selectedCaseId) return
    setSaving(true); setMessage(null); setError(null)
    try {
      await api.post(`/cases/${selectedCaseId}/customer-intake`, {
        customer_profile: {
          ...profile,
          annual_income: profile.annual_income ? Number(profile.annual_income) : null,
          dependents:    profile.dependents    ? Number(profile.dependents)    : null,
        },
        needs_analysis: {
          purpose:          needs.purpose,
          term:             needs.term,
          sum_assured_goal: needs.sum_assured_goal,
          riders_needed:    needs.riders_needed.split(',').map(x => x.trim()).filter(Boolean),
        },
      })
      setMessage('Profile & needs saved successfully')
      setProfileEditable(false)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save')
    } finally { setSaving(false) }
  }

  if (loading) return <Spinner />

  const selectedCase = cases.find(c => c.id === selectedCaseId)

  const Field = ({ fieldKey, label, alwaysReadOnly }) => (
    <div>
      <label className="text-xs font-semibold text-[#6b7280] block mb-1.5">{label}</label>
      <input
        value={String(profile[fieldKey] ?? '')}
        onChange={e => setProfile(prev => ({ ...prev, [fieldKey]: e.target.value }))}
        readOnly={!profileEditable || alwaysReadOnly}
        className={`w-full rounded-lg px-3 py-2 text-sm outline-none border transition-colors
          ${(profileEditable && !alwaysReadOnly)
            ? 'bg-[#0f1117] border-[#6366f1]/50 focus:border-[#6366f1] text-[#e8eaf0]'
            : 'bg-[#0b0d14] border-[#1f2436] text-[#94a3b8] cursor-default'
          }`}
        placeholder={profileEditable && !alwaysReadOnly ? label : '—'}
      />
      {alwaysReadOnly && <p className="text-[10px] text-[#6b7280] mt-0.5">System generated — not editable</p>}
    </div>
  )

  return (
    <div>
      <SectionHeader title="Profile & Needs" subtitle="Review and update your personal details and insurance needs" />
      {error   && <Alert type="error"   message={error}   />}
      {message && <Alert type="success" message={message} />}

      {/* Case selector */}
      {cases.length > 1 && (
        <Card className="mb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs font-semibold text-[#6b7280] block mb-1.5">Select Case</label>
              <select value={selectedCaseId} onChange={e => setSelectedCaseId(e.target.value)}
                className="w-full bg-[#0f1117] border border-[#2a2f45] rounded-lg px-3 py-2 text-sm outline-none">
                {cases.map(c => <option key={c.id} value={c.id}>{c.case_number}</option>)}
              </select>
            </div>
            {selectedCase && (
              <div className="flex gap-2 items-center pt-4">
                <Badge label={selectedCase.current_stage} />
                <Badge label={selectedCase.kyc_status || 'PENDING_KYC'} />
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── Profile Card (full-width) ── */}
      <Card className="mb-4">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <p className="font-bold text-base">Personal Profile</p>
            <p className="text-xs text-[#6b7280] mt-0.5">
              {profileEditable ? 'Edit mode — fields are now editable' : 'Read-only — click Edit to make changes'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {profileEditable && (
              <Btn onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </Btn>
            )}
            <Btn
              variant="secondary"
              onClick={() => { setProfileEditable(v => !v); setMessage(null); setError(null) }}
            >
              {profileEditable ? 'Cancel' : 'Edit Profile'}
            </Btn>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PROFILE_FIELDS.map(f => (
            <div key={f.key} className={f.fullWidth ? 'col-span-1 sm:col-span-2 lg:col-span-3' : ''}>
              {f.fullWidth ? (
                <div>
                  <label className="text-xs font-semibold text-[#6b7280] block mb-1.5">{f.label}</label>
                  <textarea
                    value={String(profile[f.key] ?? '')}
                    onChange={e => setProfile(prev => ({ ...prev, [f.key]: e.target.value }))}
                    readOnly={!profileEditable}
                    rows={2}
                    className={`w-full rounded-lg px-3 py-2 text-sm outline-none resize-none border transition-colors
                      ${profileEditable
                        ? 'bg-[#0f1117] border-[#6366f1]/50 focus:border-[#6366f1] text-[#e8eaf0]'
                        : 'bg-[#0b0d14] border-[#1f2436] text-[#94a3b8] cursor-default'
                      }`}
                    placeholder={profileEditable ? f.label : '—'}
                  />
                </div>
              ) : (
                <Field fieldKey={f.key} label={f.label} alwaysReadOnly={f.readOnly} />
              )}
            </div>
          ))}
        </div>

        {/* Notes — full width */}
        <div className="mt-4">
          <label className="text-xs font-semibold text-[#6b7280] block mb-1.5">Notes / Additional Info</label>
          <textarea
            value={profile.notes ?? ''}
            onChange={e => setProfile(prev => ({ ...prev, notes: e.target.value }))}
            rows={2}
            readOnly={!profileEditable}
            className={`w-full rounded-lg px-3 py-2 text-sm outline-none resize-none border transition-colors
              ${profileEditable
                ? 'bg-[#0f1117] border-[#6366f1]/50 focus:border-[#6366f1] text-[#e8eaf0]'
                : 'bg-[#0b0d14] border-[#1f2436] text-[#94a3b8] cursor-default'
              }`}
            placeholder={profileEditable ? 'Any additional notes…' : '—'}
          />
        </div>
      </Card>

      {/* ── Needs Analysis (collapsible) ── */}
      <Card>
        <button
          onClick={() => setNeedsOpen(v => !v)}
          className="w-full flex items-center justify-between gap-3 cursor-pointer"
        >
          <div className="text-left">
            <p className="font-bold text-base">Needs Analysis</p>
            <p className="text-xs text-[#6b7280] mt-0.5">Insurance goals, tenure, sum assured target, riders</p>
          </div>
          <div className={`text-[#6b7280] text-lg transition-transform duration-200 ${needsOpen ? 'rotate-180' : ''}`}>
            ▾
          </div>
        </button>

        {needsOpen && (
          <div className="mt-5 pt-5 border-t border-[#2a2f45]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-[#6b7280] block mb-1.5">Purpose</label>
                <input value={needs.purpose}
                  onChange={e => setNeeds(prev => ({ ...prev, purpose: e.target.value }))}
                  className="w-full bg-[#0f1117] border border-[#2a2f45] rounded-lg px-3 py-2 text-sm outline-none"
                  placeholder="Family protection, retirement, tax planning…" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#6b7280] block mb-1.5">Policy Term</label>
                <input value={needs.term}
                  onChange={e => setNeeds(prev => ({ ...prev, term: e.target.value }))}
                  className="w-full bg-[#0f1117] border border-[#2a2f45] rounded-lg px-3 py-2 text-sm outline-none"
                  placeholder="e.g. 20 years" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#6b7280] block mb-1.5">Target Sum Assured (₹)</label>
                <input value={needs.sum_assured_goal}
                  onChange={e => setNeeds(prev => ({ ...prev, sum_assured_goal: e.target.value }))}
                  className="w-full bg-[#0f1117] border border-[#2a2f45] rounded-lg px-3 py-2 text-sm outline-none"
                  placeholder="e.g. 5000000" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-[#6b7280] block mb-1.5">Riders Needed</label>
                <input value={needs.riders_needed}
                  onChange={e => setNeeds(prev => ({ ...prev, riders_needed: e.target.value }))}
                  className="w-full bg-[#0f1117] border border-[#2a2f45] rounded-lg px-3 py-2 text-sm outline-none"
                  placeholder="Critical illness, accidental death (comma separated)" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Needs'}</Btn>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}


// ── Quote Card ────────────────────────────────────────────────────────

function QuoteCard({ q, isTop }) {
  const [expanded, setExpanded] = useState(false)
  const coverage = q.coverage_details || {}
  const riders = q.riders || []
  const exclusions = q.exclusions || []
  const uwDocs = q.underwriting_requirements || []
  const medicals = q.medical_requirements || []

  return (
    <Card 
      onClick={() => setExpanded(!expanded)} 
      className={`relative flex flex-col justify-between cursor-pointer hover:border-[#6366f1] transition-all duration-200 ${isTop ? 'border-[#6366f1]' : ''}`}
    >
      {isTop && (
        <span className="absolute -top-3 left-4 bg-[#6366f1] text-white text-[10px] px-3 py-0.5 rounded-full font-bold">
          AI Recommended
        </span>
      )}
      <div>
        <div className="flex justify-between items-start gap-4 mb-4">
          <div>
            <p className="font-bold text-base text-[#e8eaf0]">{q.insurer_name}</p>
            <p className="text-xs text-[#6b7280]">{q.product_name}</p>
          </div>
          <div className="text-right min-w-max">
            <p className="font-bold text-[#22c55e] text-base">₹{q.annual_premium?.toLocaleString()}</p>
            <p className="text-[10px] text-[#6b7280]">per year</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
          <div className="bg-[#0f1117] border border-[#2a2f45] rounded-lg p-2.5">
            <p className="text-[10px] text-[#6b7280]">Sum Assured</p>
            <p className="font-bold text-[#e8eaf0]">₹{q.sum_assured?.toLocaleString()}</p>
          </div>
          <div className="bg-[#0f1117] border border-[#2a2f45] rounded-lg p-2.5">
            <p className="text-[10px] text-[#6b7280]">Tenure</p>
            <p className="font-bold text-[#e8eaf0]">{q.policy_tenure} yrs</p>
          </div>
          <div className="bg-[#0f1117] border border-[#2a2f45] rounded-lg p-2.5">
            <p className="text-[10px] text-[#6b7280]">AI Score</p>
            <p className="font-bold text-[#2dd4bf]">{((q.ai_score || 0) * 100).toFixed(0)}%</p>
          </div>
          <div className="bg-[#0f1117] border border-[#2a2f45] rounded-lg p-2.5">
            <p className="text-[10px] text-[#6b7280]">Rank</p>
            <p className="font-bold text-[#e8eaf0]">#{q.ai_rank}</p>
          </div>
        </div>

        {q.ai_recommendation_text && (
          <div className="text-xs text-[#2dd4bf] bg-[#2dd4bf]/10 rounded-lg p-3 mb-3 leading-relaxed whitespace-pre-wrap">
            {q.ai_recommendation_text}
          </div>
        )}

        {expanded && (
          <div className="space-y-4 pt-3 border-t border-[#2a2f45] text-xs">
            {/* Benefit Coverages */}
            {Object.keys(coverage).length > 0 && (
              <div>
                <p className="text-[#6b7280] font-semibold mb-2">Benefit Coverages</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(coverage).map(([key, val]) => {
                    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    return (
                      <span key={key} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] ${val ? 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20' : 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20'}`}>
                        {val ? '✓' : '✗'} {label}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Waiting Period */}
            {q.waiting_period_days !== undefined && q.waiting_period_days !== null && (
              <div className="flex justify-between items-center bg-[#0f1117] border border-[#2a2f45] rounded-lg p-2.5">
                <span className="text-[#6b7280]">Waiting Period</span>
                <span className="font-semibold text-[#e8eaf0]">{q.waiting_period_days} days</span>
              </div>
            )}

            {/* Riders */}
            {riders.length > 0 && (
              <div>
                <p className="text-[#6b7280] font-semibold mb-1.5">Optional Add-ons / Riders</p>
                <ul className="space-y-1 pl-4 list-disc text-[#e8eaf0]">
                  {riders.map((r, i) => {
                    const rName = r.name || r.rider_name || "";
                    const cost = r.annual_cost || r.annual_premium || r.premium_per_year;
                    return (
                      <li key={i}>
                        <span>{rName}</span>
                        {cost !== undefined && cost !== null && <span className="text-[#22c55e] font-semibold"> (+₹{cost.toLocaleString()}/yr)</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Exclusions */}
            {exclusions.length > 0 && (
              <div>
                <p className="text-[#6b7280] font-semibold mb-1.5">Policy Exclusions</p>
                <ul className="space-y-1 pl-4 list-disc text-[#ef4444]">
                  {exclusions.map((exc, i) => (
                    <li key={i}>{exc}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Requirements */}
            {(uwDocs.length > 0 || medicals.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {uwDocs.length > 0 && (
                  <div>
                    <p className="text-[#6b7280] font-semibold mb-1.5">Required Docs</p>
                    <ul className="space-y-1.5 pl-4 list-disc text-[#e8eaf0]">
                      {uwDocs.map((doc, i) => <li key={i}>{doc}</li>)}
                    </ul>
                  </div>
                )}
                {medicals.length > 0 && (
                  <div>
                    <p className="text-[#6b7280] font-semibold mb-1.5">Medical Tests</p>
                    <ul className="space-y-1.5 pl-4 list-disc text-[#e8eaf0]">
                      {medicals.map((test, i) => <li key={i}>{test}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4">
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="w-full text-center py-2 px-3 rounded-lg border border-[#2a2f45] bg-[#15192a] hover:bg-[#1a1f36] text-xs font-semibold text-[#e8eaf0] transition-colors"
        >
          {expanded ? 'Hide Details' : 'Show Details'}
        </button>
      </div>
    </Card>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {quotes.map((quote, index) => (
            <QuoteCard key={quote.id} q={quote} isTop={index === 0} />
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
  const [quotes, setQuotes] = useState([])
  const [selectedQuoteId, setSelectedQuoteId] = useState('')
  const [loadingQuotes, setLoadingQuotes] = useState(false)

  const loadQuotes = async (cId) => {
    if (!cId) {
      setQuotes([])
      setSelectedQuoteId('')
      return
    }
    setLoadingQuotes(true)
    try {
      const { data } = await api.get(`/quotes/case/${cId}`)
      const retrievedQuotes = data.quotes || []
      setQuotes(retrievedQuotes)
      if (retrievedQuotes.length > 0) {
        setSelectedQuoteId(retrievedQuotes[0].id)
      } else {
        setSelectedQuoteId('')
      }
    } catch (e) {
      setQuotes([])
      setSelectedQuoteId('')
    } finally {
      setLoadingQuotes(false)
    }
  }

  useEffect(() => {
    api.get('/cases/').then(r => {
      const otpCases = r.data.cases.filter(c => c.current_stage === 'OTP_CONSENT')
      setCases(otpCases)
      if (otpCases.length > 0) {
        setCaseId(otpCases[0].id)
        loadQuotes(otpCases[0].id)
      }
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
      await api.post('/otp/verify', {
        case_id: caseId,
        otp_code: otp.join(''),
        selected_quote_id: selectedQuoteId
      })
      setStatus('success')
    } catch (e) { setErr(e.response?.data?.detail || 'Invalid OTP'); setStatus('sent') }
  }

  return (
    <div>
      <SectionHeader title="OTP Consent" subtitle="Provide your consent via OTP for policy issuance" />
      <Card className="max-w-4xl">
        {status === 'success' ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-lg font-bold text-[#22c55e] mb-2">Consent Verified!</h3>
            <p className="text-sm text-[#6b7280]">Your policy is being processed.</p>
          </div>
        ) : cases.length === 0 ? (
          <div className="text-center py-12 text-[#6b7280]">
            <p className="text-base font-semibold text-[#e8eaf0] mb-2">No Cases Pending Consent</p>
            <p className="text-sm max-w-md mx-auto">There are currently no cases waiting for your OTP consent. Please wait for your banker to approve the quote recommendation from their dashboard first.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                {cases.length > 0 && (
                  <div className="mb-5">
                    <label className="text-xs font-semibold text-[#6b7280] block mb-1.5">Select Case</label>
                    <select value={caseId} onChange={e => { setCaseId(e.target.value); loadQuotes(e.target.value); }}
                      className="w-full bg-[#0f1117] border border-[#2a2f45] rounded-lg px-3 py-2 text-sm outline-none">
                      {cases.map(c => <option key={c.id} value={c.id}>{c.case_number}</option>)}
                    </select>
                  </div>
                )}

                {err && <Alert type="error" message={err} />}

                {status === 'idle' && (
                  <div className="text-center py-4">
                    <p className="text-sm text-[#6b7280] mb-5">Click below to receive an OTP on your registered email.</p>
                    <Btn onClick={sendOTP} className="w-full">Send OTP to Email</Btn>
                  </div>
                )}

                {(status === 'sent' || status === 'verifying') && (
                  <div className="py-2">
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
                  </div>
                )}
              </div>

              <div>
                {quotes.length > 0 && (
                  <div className="mb-4">
                    <label className="text-xs font-semibold text-[#6b7280] block mb-3">Choose Quotation to Issue</label>
                    {loadingQuotes ? <Spinner /> : (
                      <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-1">
                        {quotes.map(q => {
                          const isSelected = selectedQuoteId === q.id
                          return (
                            <div
                              key={q.id}
                              onClick={() => setSelectedQuoteId(q.id)}
                              className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 bg-[linear-gradient(180deg,#15192a_0%,#101423_100%)] flex items-start gap-3 ${isSelected ? 'border-[#6366f1] ring-1 ring-[#6366f1]' : 'border-[#2a2f45] hover:border-[#4f46e5]'}`}
                            >
                              <input
                                type="radio"
                                name="selected_quote"
                                checked={isSelected}
                                onChange={() => setSelectedQuoteId(q.id)}
                                className="mt-1 accent-[#6366f1] cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <p className="font-semibold text-sm text-[#e8eaf0]">{q.insurer_name}</p>
                                  {q.ai_rank === 1 && (
                                    <span className="bg-[#6366f1]/25 text-[#7c83ff] text-[9px] px-2 py-0.5 rounded-full font-bold">
                                      AI Recommended
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-[#6b7280] mt-0.5">{q.product_name}</p>

                                <div className="grid grid-cols-3 gap-2 mt-3 text-[11px] bg-[#0f1117] border border-[#2a2f45]/50 rounded-lg p-2">
                                  <div>
                                    <p className="text-[9px] text-[#6b7280]">Premium</p>
                                    <p className="font-bold text-[#22c55e]">₹{q.annual_premium?.toLocaleString()}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] text-[#6b7280]">Sum Assured</p>
                                    <p className="font-semibold text-[#e8eaf0]">₹{q.sum_assured?.toLocaleString()}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] text-[#6b7280]">AI Score</p>
                                    <p className="font-semibold text-[#2dd4bf]">{((q.ai_score || 0) * 100).toFixed(0)}%</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
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

function CustomerNotifications() {
  const [notifs, setNotifs] = useState([])
  const [loading, setL] = useState(true)

  const load = () => {
    api.get('/notifications/mine').then(r => setNotifs(r.data.notifications || [])).finally(() => setL(false))
  }

  useEffect(() => { load() }, [])

  const markAllRead = async () => {
    await api.post('/notifications/mark-all-read')
    load()
  }

  return (
    <div>
      <SectionHeader title="Notifications" subtitle="Messages and updates from your banker or underwriter" />
      <div className="flex justify-end mb-4">
        {notifs.some(n => n.status === 'PENDING') && (
          <Btn variant="secondary" onClick={markAllRead}>Mark all as read</Btn>
        )}
      </div>
      {loading ? <Spinner /> : notifs.length === 0 ? (
        <Card className="text-center py-12 text-[#6b7280]">No notifications yet.</Card>
      ) : (
        <div className="flex flex-col gap-3">
          {notifs.map(n => (
            <Card key={n.id} className={n.status === 'PENDING' ? 'border-[#6366f1]/40' : ''}>
              <div className="flex items-start gap-3">
                {n.status === 'PENDING' && <div className="w-2 h-2 rounded-full bg-[#6366f1] mt-1.5 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="font-semibold text-sm">{n.subject}</p>
                    <p className="text-xs text-[#6b7280]">{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</p>
                  </div>
                  <p className="text-sm text-[#9ca3af] mt-1">{stripHtml(n.body)}</p>
                  {n.reference_id && (
                    <p className="text-xs text-[#6b7280] mt-1">Case ref: {n.reference_id.slice(0, 8)}…</p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
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
      <Route path="notifications" element={<CustomerNotifications />} />
      <Route path="rag-chat" element={<RAGChat title="Customer RAG Helpdesk" placeholder="Ask questions about your coverages, rules, or claims..." />} />
    </Routes>
  )
}


// ─── UW: KYC / Document Review page ─────────────────────────────────
function UWKYCDocs() {
  const [cases, setCases] = useState([])
  const [loading, setL] = useState(true)
  const [selectedCase, setSelectedCase] = useState(null)
  const [docs, setDocs] = useState([])
  const [docsLoading, setDL] = useState(false)
  const [notifCaseId, setNotifCaseId] = useState('')
  const [notifCustomerId, setNotifCustomerId] = useState('')
  const [notifSubject, setNotifSubject] = useState('')
  const [notifMsg, setNotifMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [ok, setOk] = useState(null)
  const [err, setErr] = useState(null)
  const [verifying, setVerifying] = useState({})

  const loadCases = () => {
    setL(true)
    api.get('/medical/cases-for-uw').then(r => setCases(r.data.cases || [])).finally(() => setL(false))
  }

  useEffect(() => { loadCases() }, [])

  const selectCase = async (c) => {
    setSelectedCase(c)
    setNotifCaseId(c.id)
    setNotifCustomerId(c.customer_id)
    setErr(null); setOk(null)
    if (c.medical_requests?.length > 0) {
      setDL(true)
      try {
        const res = await api.get(`/documents/medical-request/${c.medical_requests[0].id}`)
        setDocs(res.data.documents || [])
      } catch { setDocs([]) } finally { setDL(false) }
    } else {
      setDocs([])
    }
  }

  const verifyDoc = async (docId) => {
    setVerifying(p => ({ ...p, [docId]: true }))
    try {
      await api.patch(`/documents/${docId}/verify`)
      setOk('Document verified!')
      if (selectedCase?.medical_requests?.[0]) {
        const res = await api.get(`/documents/medical-request/${selectedCase.medical_requests[0].id}`)
        setDocs(res.data.documents || [])
      }
    } catch (e) { setErr(e.response?.data?.detail || 'Failed') }
    finally { setVerifying(p => ({ ...p, [docId]: false })) }
  }

  const sendNotif = async () => {
    if (!notifCaseId || !notifCustomerId || !notifSubject || !notifMsg) {
      setErr('Fill all notification fields'); return
    }
    setSending(true); setErr(null); setOk(null)
    try {
      await api.post('/notifications/send', {
        case_id: notifCaseId,
        customer_id: notifCustomerId,
        subject: notifSubject,
        message: notifMsg,
      })
      setOk('Notification sent to customer!')
      setNotifSubject(''); setNotifMsg('')
    } catch (e) { setErr(e.response?.data?.detail || 'Failed to send') }
    finally { setSending(false) }
  }

  return (
    <div>
      <SectionHeader title="KYC / Document Review" subtitle="Review KYC documents submitted by customers" />
      {err && <Alert type="error" message={err} />}
      {ok && <Alert type="success" message={ok} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Case list */}
        <div className="lg:col-span-1">
          <Card>
            <p className="font-semibold mb-3 text-sm">Cases Pending Review</p>
            {loading ? <Spinner /> : cases.length === 0 ? (
              <p className="text-xs text-[#6b7280] text-center py-6">No cases pending.</p>
            ) : cases.map(c => (
              <div key={c.id}
                onClick={() => selectCase(c)}
                className={`cursor-pointer rounded-lg border p-3 mb-2 transition-all ${
                  selectedCase?.id === c.id ? 'border-[#6366f1] bg-[#6366f1]/10' : 'border-[#2a2f45] hover:border-[#4f46e5] bg-[#0f1117]'
                }`}>
                <p className="text-xs font-bold">{c.case_number}</p>
                <p className="text-xs text-[#6b7280] mt-0.5">{c.current_stage}</p>
                <div className="flex gap-2 mt-1 flex-wrap">
                  <Badge label={c.kyc_status || 'PENDING_KYC'} />
                </div>
              </div>
            ))}
          </Card>
        </div>

        {/* Docs + Send Notification */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {!selectedCase ? (
            <Card className="text-center py-16 text-[#6b7280]">Select a case to review documents</Card>
          ) : (
            <>
              <Card>
                <p className="font-semibold mb-3 text-sm">Documents — {selectedCase.case_number}</p>
                {docsLoading ? <Spinner /> : docs.length === 0 ? (
                  <p className="text-xs text-[#6b7280]">No documents uploaded yet by the customer.</p>
                ) : (
                  <div className="space-y-2">
                    {docs.map(d => (
                      <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#2a2f45] bg-[#0f1117] px-3 py-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{d.document_type}</p>
                          <p className="text-xs text-[#6b7280] truncate">{d.file_name}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge label={d.verified ? 'Verified' : 'Pending'} />
                          {!d.verified && (
                            <Btn size="sm" onClick={() => verifyDoc(d.id)} disabled={verifying[d.id]}>
                              {verifying[d.id] ? '…' : 'Verify'}
                            </Btn>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Send Notification Panel */}
              <Card>
                <p className="font-semibold mb-3 text-sm">Send Notification to Customer</p>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[#6b7280] block mb-1.5">Subject</label>
                    <input value={notifSubject} onChange={e => setNotifSubject(e.target.value)}
                      className="w-full bg-[#0f1117] border border-[#2a2f45] rounded-lg px-3 py-2 text-sm outline-none"
                      placeholder="e.g. Additional documents required" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#6b7280] block mb-1.5">Message</label>
                    <textarea value={notifMsg} onChange={e => setNotifMsg(e.target.value)} rows={3}
                      className="w-full bg-[#0f1117] border border-[#2a2f45] rounded-lg px-3 py-2 text-sm outline-none resize-none"
                      placeholder="Write your message here…" />
                  </div>
                  <Btn onClick={sendNotif} disabled={sending}>
                    {sending ? 'Sending…' : 'Send Notification'}
                  </Btn>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── UW: Medical Queue page ────────────────────────────────────────
function UWMedical() {
  const [cases, setCases] = useState([])
  const [loading, setL] = useState(true)
  const [selectedCase, setSelectedCase] = useState(null)
  const [requirements, setReq] = useState('')
  const [creating, setCreating] = useState(false)
  const [completing, setCompleting] = useState({})
  const [ok, setOk] = useState(null)
  const [err, setErr] = useState(null)

  const load = () => {
    setL(true)
    api.get('/medical/cases-for-uw').then(r => setCases(r.data.cases || [])).finally(() => setL(false))
  }
  useEffect(() => { load() }, [])

  const createReq = async () => {
    if (!selectedCase) return
    setCreating(true); setErr(null); setOk(null)
    const reqs = requirements.split(',').map(s => s.trim()).filter(Boolean)
    try {
      await api.post('/medical/', {
        case_id: selectedCase.id,
        customer_id: selectedCase.customer_id,
        requirements: reqs.length > 0 ? reqs : ['General Medical Check-up'],
      })
      setOk('Medical request created — case moved to MEDICAL_COORDINATION')
      setReq('')
      load()
    } catch (e) { setErr(e.response?.data?.detail || 'Failed') }
    finally { setCreating(false) }
  }

  const completeReq = async (reqId) => {
    setCompleting(p => ({ ...p, [reqId]: true })); setErr(null); setOk(null)
    try {
      await api.patch(`/medical/${reqId}/complete`)
      setOk('Medical coordination complete — case moved to UNDERWRITING!')
      load()
    } catch (e) { setErr(e.response?.data?.detail || 'Failed') }
    finally { setCompleting(p => ({ ...p, [reqId]: false })) }
  }

  return (
    <div>
      <SectionHeader title="Medical Coordination" subtitle="Create and complete medical requests for cases" />
      {err && <Alert type="error" message={err} />}
      {ok && <Alert type="success" message={ok} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Create Medical Request */}
        <Card>
          <p className="font-semibold mb-3 text-sm">Create Medical Request</p>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-semibold text-[#6b7280] block mb-1.5">Select Case</label>
              <select value={selectedCase?.id || ''}
                onChange={e => setSelectedCase(cases.find(c => c.id === e.target.value) || null)}
                className="w-full bg-[#0f1117] border border-[#2a2f45] rounded-lg px-3 py-2 text-sm outline-none">
                <option value="">Choose a case…</option>
                {cases.filter(c => c.current_stage === 'PROPOSAL_GENERATION').map(c => (
                  <option key={c.id} value={c.id}>{c.case_number} — {c.current_stage}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[#6b7280] block mb-1.5">Requirements (comma separated)</label>
              <input value={requirements} onChange={e => setReq(e.target.value)}
                className="w-full bg-[#0f1117] border border-[#2a2f45] rounded-lg px-3 py-2 text-sm outline-none"
                placeholder="e.g. Blood test, ECG, Chest X-Ray" />
            </div>
            <Btn onClick={createReq} disabled={!selectedCase || creating}>
              {creating ? 'Creating…' : 'Create Medical Request'}
            </Btn>
          </div>
        </Card>

        {/* Pending Medical Requests */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-sm">Pending Medical Queue</p>
            <Btn variant="secondary" size="sm" onClick={load}>Refresh</Btn>
          </div>
          {loading ? <Spinner /> : (
            <div className="space-y-3">
              {cases.flatMap(c => (c.medical_requests || []).filter(mr => mr.status === 'PENDING').map(mr => (
                <div key={mr.id} className="rounded-lg border border-[#2a2f45] bg-[#0f1117] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold">{c.case_number}</p>
                      <p className="text-xs text-[#6b7280] mt-0.5">{(mr.requirements || []).join(', ')}</p>
                      <p className="text-xs text-[#6b7280] mt-0.5">{mr.created_at ? new Date(mr.created_at).toLocaleDateString() : ''}</p>
                    </div>
                    <div className="flex-shrink-0">
                      <Btn size="sm" onClick={() => completeReq(mr.id)} disabled={completing[mr.id]}>
                        {completing[mr.id] ? '…' : 'Mark Done'}
                      </Btn>
                    </div>
                  </div>
                </div>
              )))}
              {cases.flatMap(c => (c.medical_requests || []).filter(mr => mr.status === 'PENDING')).length === 0 && (
                <p className="text-xs text-[#6b7280] text-center py-4">No pending medical requests.</p>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

export function UnderwriterDashboard() {
  return (
    <Routes>
      <Route index element={<UWQueue />} />
      <Route path="decisions" element={<UWQueue />} />
      <Route path="kyc" element={<UWKYCDocs />} />
      <Route path="medical" element={<UWMedical />} />
      <Route path="kb" element={<KnowledgeBase />} />
      <Route path="rag-chat" element={<RAGChat title="Underwriting RAG Assistant" placeholder="Ask about guidelines, medical grids, financial limits..." />} />
    </Routes>
  )
}

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
      <Route path="kb" element={<KnowledgeBase />} />
      <Route path="rag-chat" element={<RAGChat title="Compliance RAG Auditor" placeholder="Ask about IRDAI regulations, KYC compliance checklist..." />} />
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
      <Route path="kb" element={<KnowledgeBase />} />
      <Route path="rag-chat" element={<RAGChat title="Operations RAG Helper" placeholder="Ask about SLA terms, coordination workflows..." />} />
    </Routes>
  )
}
