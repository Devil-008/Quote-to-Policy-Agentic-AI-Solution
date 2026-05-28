import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchCases } from '../../store/slices/casesSlice'
import { StatCard, DataTable, Badge, Card, SectionHeader, Btn, Input, Alert, Spinner, Modal } from '../../components/common'
import { Briefcase, Clock, CheckCircle, FileText, Bell, Upload, Search } from 'lucide-react'
import api from '../../services/api'

const STAGES = [
  'CUSTOMER_INTAKE', 'NEEDS_ANALYSIS', 'SUITABILITY_VALIDATION', 'QUOTE_RETRIEVAL',
  'QUOTE_COMPARISON', 'RECOMMENDATION', 'BANKER_APPROVAL', 'OTP_CONSENT',
  'PROPOSAL_GENERATION', 'MEDICAL_COORDINATION', 'UNDERWRITING', 'POLICY_ISSUANCE',
  'EXCEPTION_HANDLING', 'ESCALATION', 'COMPLETED'
]

// ── Case List ─────────────────────────────────────────────────────────
function CaseList() {
  const dispatch = useDispatch()
  const { list: cases, loading } = useSelector(s => s.cases)
  const [selected, setSelected] = useState(null)
  const [quotes, setQuotes] = useState([])
  const [qLoading, setQL] = useState(false)

  useEffect(() => { dispatch(fetchCases()) }, [dispatch])

  const fetchQuotes = async caseId => {
    setQL(true)
    try {
      const { data } = await api.get(`/quotes/case/${caseId}`)
      setQuotes(data.quotes)
    } finally { setQL(false) }
  }

  const triggerFetch = async caseId => {
    await api.post(`/quotes/case/${caseId}/fetch`)
    fetchQuotes(caseId)
  }

  const approve = async caseId => {
    await api.post(`/cases/${caseId}/banker-approve`, { remarks: 'Approved by banker' })
    dispatch(fetchCases())
  }

  const triggerWorkflow = async caseId => {
    await api.post(`/workflow/case/${caseId}/run`)
    dispatch(fetchCases())
  }

  const cols = [
    { key: 'case_number', label: 'Case #' },
    { key: 'current_stage', label: 'Stage', render: r => <Badge label={r.current_stage} /> },
    { key: 'status', label: 'Status', render: r => <Badge label={r.status} /> },
    { key: 'sum_assured', label: 'Sum Assured', render: r => r.sum_assured ? `₹${r.sum_assured.toLocaleString()}` : '—' },
    { key: 'banker_approved', label: 'Approved', render: r => r.banker_approved ? '✅' : '⏳' },
    { key: 'created_at', label: 'Created', render: r => r.created_at ? new Date(r.created_at).toLocaleDateString() : '—' },
    {
      key: 'actions', label: '',
      render: r => (
        <div className="flex gap-2">
          <Btn size="sm" onClick={() => { setSelected(r); fetchQuotes(r.id) }}>View</Btn>
          {!r.banker_approved && r.current_stage === 'BANKER_APPROVAL' &&
            <Btn size="sm" variant="success" onClick={() => approve(r.id)}>Approve</Btn>}
        </div>
      )
    },
  ]

  const active = cases.filter(c => c.status === 'ACTIVE').length
  const pending = cases.filter(c => c.status === 'PENDING').length
  const completed = cases.filter(c => c.status === 'COMPLETED').length
  const stageIdx = selected ? STAGES.indexOf(selected.current_stage) : 0

  return (
    <div>
      <SectionHeader title="My Cases" subtitle="All insurance cases assigned to you" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Cases" value={cases.length} icon={Briefcase} />
        <StatCard title="Active" value={active} color="#22c55e" icon={Clock} />
        <StatCard title="Pending" value={pending} color="#f59e0b" icon={FileText} />
        <StatCard title="Completed" value={completed} color="#6366f1" icon={CheckCircle} />
      </div>
      <Card>
        {loading ? <Spinner /> : <DataTable columns={cols} rows={cases} emptyText="No cases yet. Create your first case." />}
      </Card>

      {/* Case Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Case: ${selected?.case_number}`}>
        {selected && (
          <div>
            {/* Stage Progress */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-[#6b7280] mb-2">Workflow Progress</p>
              <div className="flex flex-wrap gap-1">
                {STAGES.map((s, i) => (
                  <span key={s} className="text-xs px-2 py-0.5 rounded"
                    style={{
                      background: i < stageIdx ? '#22c55e22' : i === stageIdx ? '#6366f122' : '#1e2235',
                      color: i < stageIdx ? '#22c55e' : i === stageIdx ? '#6366f1' : '#6b7280',
                      border: `1px solid ${i <= stageIdx ? (i < stageIdx ? '#22c55e44' : '#6366f144') : '#2a2f45'}`
                    }}>
                    {i + 1}. {s.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mb-5 flex-wrap">
              <Btn size="sm" onClick={() => triggerWorkflow(selected.id)}>▶ Run AI Workflow</Btn>
              <Btn size="sm" variant="secondary" onClick={() => triggerFetch(selected.id)}>📊 Fetch Quotes</Btn>
              {!selected.banker_approved && <Btn size="sm" variant="success" onClick={() => approve(selected.id)}>✅ Approve</Btn>}
            </div>

            {/* Quotes */}
            {qLoading ? <Spinner /> : quotes.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#6b7280] mb-3">Quotes ({quotes.length})</p>
                <div className="space-y-3">
                  {quotes.map(q => (
                    <div key={q.id} className="bg-[#0f1117] border border-[#2a2f45] rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-sm">{q.insurer_name}</p>
                          <p className="text-xs text-[#6b7280]">{q.product_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-[#22c55e] text-sm">₹{q.annual_premium?.toLocaleString()}/yr</p>
                          <p className="text-xs text-[#6b7280]">Rank #{q.ai_rank} · Score {((q.ai_score || 0) * 100).toFixed(0)}%</p>
                        </div>
                      </div>
                      {q.ai_recommendation_text && (
                        <p className="text-xs text-[#2dd4bf] bg-[#2dd4bf]/10 rounded px-2 py-1 mt-2">{q.ai_recommendation_text.slice(0, 120)}…</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

// ── New Case Form ─────────────────────────────────────────────────────
function NewCaseForm() {
  const { user } = useSelector(s => s.auth)
  const [customers, setCustomers] = useState([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [csvFile, setCsvFile] = useState(null)
  const [csvUploading, setCsvUploading] = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [form, setForm] = useState({
    sum_assured: '', premium_budget: '', policy_tenure: '20', purpose: '',
  })
  const [loading, setL] = useState(false)
  const [err, setErr] = useState(null)
  const [ok, setOk] = useState(false)
  const set = k => v => setForm(f => ({ ...f, [k]: v }))

  const selectedCustomer = customers.find((customer) => customer.user_id === selectedCustomerId) || null

  const filteredCustomers = customers.filter((customer) => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return true
    return [customer.name, customer.email, customer.phone]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query))
  })

  const buildCustomerProfile = (customer) => {
    const profile = customer?.normalized_payload || {}
    return {
      ...profile,
      name: customer?.name || profile.name || '',
      email: customer?.email || profile.email || '',
      phone: customer?.phone || profile.phone || '',
      dob: profile.date_of_birth || profile.dob || '',
      annual_income: Number(profile.annual_income) || 0,
      dependents: Number(profile.dependents) || 0,
      risk_appetite: profile.risk_appetite || '',
      kyc_status: profile.kyc_status || '',
    }
  }

  const loadCustomers = async () => {
    setLoadingCustomers(true)
    try {
      const { data } = await api.get('/banker/customers')
      setCustomers(data.customers || [])
    } catch (error) {
      setErr(error.response?.data?.detail || 'Failed to load customers')
    } finally {
      setLoadingCustomers(false)
    }
  }

  useEffect(() => { loadCustomers() }, [])

  const submit = async () => {
    if (!selectedCustomer) {
      setErr('Please select a customer from the list below first.')
      return
    }
    setL(true); setErr(null)
    try {
      await api.post('/cases/', {
        customer_id: selectedCustomer.user_id || user?.id,
        customer_profile: buildCustomerProfile(selectedCustomer),
        sum_assured: parseFloat(form.sum_assured) || 0,
        premium_budget: parseFloat(form.premium_budget) || 0,
        policy_tenure: parseInt(form.policy_tenure) || 20,
        needs_analysis: { purpose: form.purpose },
      })
      setOk(true)
    } catch (e) { setErr(e.response?.data?.detail || 'Failed to create case') }
    finally { setL(false) }
  }

  if (ok) return (
    <Card className="text-center py-12">
      <div className="text-5xl mb-4">✅</div>
      <h3 className="text-lg font-bold mb-2">Case Created!</h3>
      <p className="text-sm text-[#6b7280] mb-6">AI workflow has been triggered.</p>
      <Btn onClick={() => setOk(false)}>Create Another</Btn>
    </Card>
  )

  const uploadCsv = async () => {
    if (!csvFile) return
    setCsvUploading(true)
    setErr(null)
    setOk(null)
    try {
      const fd = new FormData()
      fd.append('file', csvFile)
      await api.post('/banker/customers/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setOk('CSV import started. Customers will receive their user ID and default password 852456 by email.')
      setCsvFile(null)
      await loadCustomers()
    } catch (error) {
      setErr(error.response?.data?.detail || 'CSV import failed')
    } finally {
      setCsvUploading(false)
    }
  }

  const previewCsv = async () => {
    if (!csvFile) return
    setCsvUploading(true)
    setPreviewData(null)
    try {
      const fd = new FormData()
      fd.append('file', csvFile)
      const { data } = await api.post('/banker/customers/import/preview', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setPreviewData(data.preview || [])
      setPreviewOpen(true)
    } catch (error) {
      setErr(error.response?.data?.detail || 'CSV preview failed')
    } finally {
      setCsvUploading(false)
    }
  }

  const customerCols = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'source_type', label: 'Source', render: (row) => <Badge label={row.source_type} /> },
    { key: 'created_at', label: 'Added', render: (row) => row.created_at ? new Date(row.created_at).toLocaleString() : '—' },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <Btn
          size="sm"
          variant={row.user_id === selectedCustomerId ? 'success' : 'secondary'}
          onClick={() => setSelectedCustomerId(row.user_id)}
        >
          {row.user_id === selectedCustomerId ? 'Selected' : 'Select'}
        </Btn>
      ),
    },
  ]

  return (
    <div>
      <SectionHeader title="New Case" subtitle="Upload customers by CSV, pick one below, then create the case" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Upload size={16} />
            <p className="font-semibold">CSV Customer Upload</p>
          </div>
          <p className="text-sm text-[#6b7280] mb-4">Upload customer rows to create logins automatically. Each imported customer receives the default password 852456 and will be required to change it on first login. See repository docs for CSV format.</p>
          {err && <Alert type="error" message={err} />}
          {ok && <Alert type="success" message={ok} />}
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-[#6b7280] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#6366f1] file:text-white file:text-xs file:font-semibold cursor-pointer mb-4"
          />
          <div className="flex gap-2">
            <Btn onClick={previewCsv} disabled={!csvFile || csvUploading || previewOpen}>
              {csvUploading ? 'Processing…' : 'Preview CSV'}
            </Btn>
            <Btn onClick={uploadCsv} disabled={!csvFile || csvUploading}>
              {csvUploading ? 'Importing…' : 'Import CSV'}
            </Btn>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Briefcase size={16} />
            <p className="font-semibold">Case Details</p>
          </div>
          <div className="mb-4 rounded-lg border border-[#2a2f45] bg-[#0f1117] p-4">
            <p className="text-xs font-semibold text-[#6b7280] mb-2">Selected customer</p>
            {selectedCustomer ? (
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-[#e8eaf0]">{selectedCustomer.name}</p>
                <p className="text-[#6b7280]">{selectedCustomer.email}</p>
                <p className="text-[#6b7280]">{selectedCustomer.phone || '—'}</p>
                <p className="text-xs text-[#6b7280]">User ID: {selectedCustomer.user_id}</p>
              </div>
            ) : (
              <p className="text-sm text-[#6b7280]">Pick a customer from the list below to continue.</p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Sum Assured (₹)" value={form.sum_assured} onChange={set('sum_assured')} placeholder="5000000" />
            <Input label="Premium Budget/yr (₹)" value={form.premium_budget} onChange={set('premium_budget')} placeholder="60000" />
            <Input label="Policy Tenure (years)" value={form.policy_tenure} onChange={set('policy_tenure')} placeholder="20" />
            <Input label="Insurance Purpose" value={form.purpose} onChange={set('purpose')} placeholder="Family protection, tax saving…" className="sm:col-span-2" />
          </div>
          <Btn onClick={submit} disabled={loading || !selectedCustomer} className="mt-5 w-full">
            {loading ? 'Creating…' : 'Create Case & Trigger Workflow'}
          </Btn>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col gap-4">
          <SectionHeader title="Customers" subtitle="Search by name, email, or phone" />
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280]" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search customers by name, email, or phone"
              className="w-full bg-[#0f1117] border border-[#2a2f45] rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-[#6366f1]"
            />
          </div>
          {loadingCustomers ? (
            <Spinner />
          ) : (
            <DataTable columns={customerCols} rows={filteredCustomers} emptyText="No customers match your search." />
          )}
        </div>
      </Card>

      {/* CSV Preview Modal */}
      {previewOpen && (
        <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title={`CSV Preview (${previewData?.length || 0} rows)`}>
          <div className="space-y-3">
            {previewData?.length ? (
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-[#6b7280]"><th className="p-2">#</th><th className="p-2">Name</th><th className="p-2">Email</th><th className="p-2">Phone</th><th className="p-2">Normalized JSON</th></tr>
                  </thead>
                  <tbody>
                    {previewData.map((r, i) => (
                      <tr key={i} className="border-t border-[#2a2f45]"><td className="p-2 align-top">{i + 1}</td>
                        <td className="p-2 align-top">{r.normalized.name || r.raw.name || '—'}</td>
                        <td className="p-2 align-top">{r.normalized.email || r.raw.email || '—'}</td>
                        <td className="p-2 align-top">{r.normalized.phone || r.raw.phone || '—'}</td>
                        <td className="p-2 align-top"><pre className="text-xs">{JSON.stringify(r.normalized, null, 2)}</pre></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-[#6b7280]">No rows parsed.</p>
            )}
            <div className="flex gap-2 mt-4">
              <Btn onClick={() => { setPreviewOpen(false); setPreviewData(null) }}>Close</Btn>
              <Btn variant="success" onClick={() => { setPreviewOpen(false); uploadCsv() }}>Import CSV</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Quote Comparison ──────────────────────────────────────────────────
function QuoteComparison() {
  const { list: cases } = useSelector(s => s.cases)
  const [caseId, setCaseId] = useState('')
  const [quotes, setQuotes] = useState([])
  const [loading, setL] = useState(false)

  const load = async id => {
    setL(true)
    try { const { data } = await api.get(`/quotes/case/${id}`); setQuotes(data.quotes) }
    finally { setL(false) }
  }

  return (
    <div>
      <SectionHeader title="Quote Comparison" />
      <div className="flex gap-3 mb-5 flex-wrap">
        <select value={caseId} onChange={e => setCaseId(e.target.value)}
          className="bg-[#0f1117] border border-[#2a2f45] rounded-lg px-3 py-2 text-sm outline-none flex-1 min-w-48">
          <option value="">Select a case…</option>
          {cases.map(c => <option key={c.id} value={c.id}>{c.case_number} — {c.current_stage}</option>)}
        </select>
        <Btn onClick={() => load(caseId)} disabled={!caseId || loading}>Load Quotes</Btn>
        <Btn variant="secondary" onClick={async () => { if (!caseId) return; await api.post(`/quotes/case/${caseId}/fetch`); load(caseId) }}>
          Fetch New
        </Btn>
      </div>
      {loading ? <Spinner /> : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {quotes.map((q, i) => (
            <Card key={q.id} className={`relative ${i === 0 ? 'border-[#6366f1]' : ''}`}>
              {i === 0 && <span className="absolute -top-3 left-4 bg-[#6366f1] text-white text-xs px-3 py-0.5 rounded-full font-bold">AI Recommended</span>}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="font-bold text-sm">{q.insurer_name}</p>
                  <p className="text-xs text-[#6b7280]">{q.product_name}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-[#22c55e]">₹{q.annual_premium?.toLocaleString()}</p>
                  <p className="text-xs text-[#6b7280]">per year</p>
                </div>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-[#6b7280]">Sum Assured</span><span>₹{q.sum_assured?.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-[#6b7280]">Tenure</span><span>{q.policy_tenure} yrs</span></div>
                <div className="flex justify-between"><span className="text-[#6b7280]">AI Score</span>
                  <span className="text-[#2dd4bf] font-bold">{((q.ai_score || 0) * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between"><span className="text-[#6b7280]">Rank</span><span>#{q.ai_rank}</span></div>
              </div>
              {q.ai_recommendation_text && (
                <p className="text-xs text-[#2dd4bf] bg-[#2dd4bf]/10 rounded p-2 mt-3 leading-relaxed">{q.ai_recommendation_text.slice(0, 150)}…</p>
              )}
            </Card>
          ))}
          {!loading && quotes.length === 0 && caseId && (
            <p className="text-[#6b7280] text-sm col-span-3 text-center py-10">No quotes yet. Click "Fetch New" to retrieve.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Banker Approvals ──────────────────────────────────────────────────
function BankerApprovals() {
  const dispatch = useDispatch()
  const { list: cases, loading } = useSelector(s => s.cases)
  const [loading2, setL2] = useState({})
  const pending = cases.filter(c => c.current_stage === 'BANKER_APPROVAL' && !c.banker_approved)

  useEffect(() => { dispatch(fetchCases()) }, [dispatch])

  const approve = async id => {
    setL2(l => ({ ...l, [id]: true }))
    try { await api.post(`/cases/${id}/banker-approve`, { remarks: 'Approved' }); dispatch(fetchCases()) }
    finally { setL2(l => ({ ...l, [id]: false })) }
  }

  return (
    <div>
      <SectionHeader title="Pending Approvals" subtitle="Cases awaiting your approval before OTP consent" />
      {loading ? <Spinner /> : pending.length === 0
        ? <Card className="text-center py-12 text-[#6b7280]">No cases pending approval 🎉</Card>
        : pending.map(c => (
          <Card key={c.id} className="mb-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-bold">{c.case_number}</p>
                <Badge label={c.current_stage} />
              </div>
              <p className="text-sm font-bold text-[#22c55e]">₹{c.sum_assured?.toLocaleString()}</p>
            </div>
            <div className="flex gap-3 mt-3">
              <Btn onClick={() => approve(c.id)} disabled={loading2[c.id]} variant="success" size="sm">
                {loading2[c.id] ? 'Approving…' : '✅ Approve'}
              </Btn>
              <Btn variant="danger" size="sm">❌ Reject</Btn>
            </div>
          </Card>
        ))
      }
    </div>
  )
}

// ── RAG Chat (Banker) ─────────────────────────────────────────────────
function RAGChatBanker() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [loading, setL] = useState(false)

  const send = async () => {
    if (!input.trim()) return
    setMessages(m => [...m, { role: 'user', content: input }])
    setInput(''); setL(true)
    try {
      const { data } = await api.post('/rag/chat', { message: input, session_id: sessionId })
      setSessionId(data.session_id)
      setMessages(m => [...m, { role: 'assistant', content: data.response, sources: data.sources }])
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: 'Error: could not get response' }])
    } finally { setL(false) }
  }

  return (
    <div>
      <SectionHeader title="Insurance Knowledge Chat" subtitle="Ask about products, rules, or procedures" />
      <Card className="flex flex-col" style={{ height: '60vh' }}>
        <div className="flex-1 overflow-y-auto space-y-3 mb-4">
          {messages.length === 0 && <p className="text-center text-[#6b7280] text-sm mt-10">Start asking about insurance knowledge…</p>}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-xl px-4 py-3 text-sm ${m.role === 'user' ? 'bg-[#6366f1] text-white' : 'bg-[#1e2235] border border-[#2a2f45]'}`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && <div className="flex justify-start"><div className="bg-[#1e2235] border border-[#2a2f45] rounded-xl px-4 py-3 text-sm text-[#6b7280]">Thinking…</div></div>}
        </div>
        <div className="flex gap-3">
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="What is the difference between HDFC and LIC term plans?"
            className="flex-1 bg-[#0f1117] border border-[#2a2f45] rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#6366f1]" />
          <Btn onClick={send} disabled={loading || !input.trim()}>Send</Btn>
        </div>
      </Card>
    </div>
  )
}

function CustomerIntake() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [ok, setOk] = useState(null)
  const [csvFile, setCsvFile] = useState(null)
  const [csvUploading, setCsvUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    annual_income: '',
    dependents: '',
    risk_appetite: 'MEDIUM',
    kyc_status: 'PENDING',
    financial_goals: '',
    notes: '',
  })

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/banker/customers')
      setCustomers(data.customers || [])
    } catch (e) {
      setErr(e.response?.data?.detail || 'Failed to load customers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const update = (key) => (value) => setForm((current) => ({ ...current, [key]: value }))

  const submitManual = async () => {
    setSaving(true)
    setErr(null)
    setOk(null)
    try {
      await api.post('/banker/customers/manual', {
        ...form,
        annual_income: form.annual_income ? Number(form.annual_income) : null,
        dependents: form.dependents ? Number(form.dependents) : null,
        financial_goals: form.financial_goals
          ? form.financial_goals.split(',').map((item) => item.trim()).filter(Boolean)
          : [],
      })
      setOk('Customer profile saved and invitation sent.')
      setForm({
        name: '', email: '', phone: '', date_of_birth: '', annual_income: '', dependents: '',
        risk_appetite: 'MEDIUM', kyc_status: 'PENDING', financial_goals: '', notes: '',
      })
      load()
    } catch (e) {
      setErr(e.response?.data?.detail || 'Failed to save customer')
    } finally {
      setSaving(false)
    }
  }

  const uploadCsv = async () => {
    if (!csvFile) return
    setCsvUploading(true)
    setErr(null)
    setOk(null)
    try {
      const fd = new FormData()
      fd.append('file', csvFile)
      await api.post('/banker/customers/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setOk('CSV import completed and notifications were sent.')
      setCsvFile(null)
      load()
    } catch (e) {
      setErr(e.response?.data?.detail || 'CSV import failed')
    } finally {
      setCsvUploading(false)
    }
  }

  const cols = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'source_type', label: 'Source', render: (row) => <Badge label={row.source_type} /> },
    { key: 'status', label: 'Status', render: (row) => <Badge label={row.status} /> },
    { key: 'created_at', label: 'Added', render: (row) => row.created_at ? new Date(row.created_at).toLocaleString() : '—' },
  ]

  return (
    <div>
      <SectionHeader title="Customer Intake" subtitle="Upload CSV or add customers manually for case onboarding" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Upload size={16} />
            <p className="font-semibold">CSV Import</p>
          </div>
          <p className="text-sm text-[#6b7280] mb-4">Columns like name, email, phone, dob, annual_income, dependents, risk_appetite, kyc_status work well.</p>
          {err && <Alert type="error" message={err} />}
          {ok && <Alert type="success" message={ok} />}
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-[#6b7280] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#6366f1] file:text-white file:text-xs file:font-semibold cursor-pointer mb-4"
          />
          <Btn onClick={uploadCsv} disabled={!csvFile || csvUploading}>
            {csvUploading ? 'Importing…' : 'Import CSV'}
          </Btn>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} />
            <p className="font-semibold">Manual Add</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Name" value={form.name} onChange={update('name')} placeholder="Rahul Kumar" />
            <Input label="Email" value={form.email} onChange={update('email')} placeholder="rahul@email.com" />
            <Input label="Phone" value={form.phone} onChange={update('phone')} placeholder="+91 9876543210" />
            <Input label="Date of Birth" value={form.date_of_birth} onChange={update('date_of_birth')} placeholder="1990-05-15" />
            <Input label="Annual Income" value={form.annual_income} onChange={update('annual_income')} placeholder="1200000" />
            <Input label="Dependents" value={form.dependents} onChange={update('dependents')} placeholder="2" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="text-xs font-semibold text-[#6b7280] block mb-1.5">Risk Appetite</label>
              <select value={form.risk_appetite} onChange={(e) => update('risk_appetite')(e.target.value)} className="w-full bg-[#0f1117] border border-[#2a2f45] rounded-lg px-3 py-2 text-sm outline-none">
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[#6b7280] block mb-1.5">KYC Status</label>
              <select value={form.kyc_status} onChange={(e) => update('kyc_status')(e.target.value)} className="w-full bg-[#0f1117] border border-[#2a2f45] rounded-lg px-3 py-2 text-sm outline-none">
                <option value="PENDING">PENDING</option>
                <option value="VERIFIED">VERIFIED</option>
                <option value="REVIEW">REVIEW</option>
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="text-xs font-semibold text-[#6b7280] block mb-1.5">Financial Goals</label>
            <textarea value={form.financial_goals} onChange={(e) => update('financial_goals')(e.target.value)} rows={3}
              placeholder="Family protection, retirement, tax savings"
              className="w-full bg-[#0f1117] border border-[#2a2f45] rounded-lg px-3 py-2 text-sm outline-none resize-none" />
          </div>
          <div className="mt-3">
            <label className="text-xs font-semibold text-[#6b7280] block mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={(e) => update('notes')(e.target.value)} rows={3}
              placeholder="KYC notes or special requirements"
              className="w-full bg-[#0f1117] border border-[#2a2f45] rounded-lg px-3 py-2 text-sm outline-none resize-none" />
          </div>
          <Btn onClick={submitManual} disabled={saving} className="mt-4 w-full">
            {saving ? 'Saving…' : 'Save Customer'}
          </Btn>
        </Card>
      </div>

      <Card>
        <SectionHeader title="Customer List" subtitle="Imported and manually added customers" />
        {loading ? <Spinner /> : <DataTable columns={cols} rows={customers} emptyText="No customers added yet." />}
      </Card>
    </div>
  )
}

function NotificationFeed() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/notifications/mine').then(({ data }) => setItems(data.notifications || [])).finally(() => setLoading(false))
  }, [])

  const cols = [
    { key: 'subject', label: 'Subject' },
    { key: 'reference_type', label: 'Type' },
    { key: 'status', label: 'Status', render: (row) => <Badge label={row.status} /> },
    { key: 'created_at', label: 'Time', render: (row) => row.created_at ? new Date(row.created_at).toLocaleString() : '—' },
  ]

  return (
    <div>
      <SectionHeader title="Notifications" subtitle="Notifications and email events for your account" />
      <Card>{loading ? <Spinner /> : <DataTable columns={cols} rows={items} emptyText="No notifications yet." />}</Card>
    </div>
  )
}

export default function BankerDashboard() {
  return (
    <Routes>
      <Route index element={<CaseList />} />
      <Route path="new" element={<NewCaseForm />} />
      <Route path="customers" element={<CustomerIntake />} />
      <Route path="quotes" element={<QuoteComparison />} />
      <Route path="approvals" element={<BankerApprovals />} />
      <Route path="rag-chat" element={<RAGChatBanker />} />
      <Route path="notifications" element={<NotificationFeed />} />
    </Routes>
  )
}
