import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { logout } from '../../store/slices/authSlice'
import { toggleSidebar } from '../../store/slices/uiSlice'
import {
  LayoutDashboard, Users, FileText, ShieldCheck, Stethoscope,
  BookOpen, Bell, LogOut, Menu, MessageSquare, ClipboardList,
  Briefcase, Scale, CheckCircle, Home, UserRound, BarChart3, CalendarClock,
  Send,
} from 'lucide-react'
import api from '../../services/api'

const NAV = {
  SUPER_ADMIN: [
    { label: 'Overview', icon: LayoutDashboard, to: '/dashboard/admin' },
    { label: 'User Mgmt', icon: Users, to: '/dashboard/admin/users' },
    { label: 'Audit Logs', icon: ClipboardList, to: '/dashboard/admin/audit' },
    { label: 'Escalations', icon: Bell, to: '/dashboard/admin/escalations' },
    { label: 'Knowledge Base', icon: BookOpen, to: '/dashboard/admin/kb' },
    { label: 'RAG Chat', icon: MessageSquare, to: '/dashboard/admin/rag-chat' },
  ],
  BANKER: [
    { label: 'My Cases', icon: Briefcase, to: '/dashboard/banker' },
    { label: 'New Case', icon: FileText, to: '/dashboard/banker/new' },
    { label: 'Quotes', icon: Scale, to: '/dashboard/banker/quotes' },
    { label: 'Approvals', icon: CheckCircle, to: '/dashboard/banker/approvals' },
    { label: 'Notifications', icon: Bell, to: '/dashboard/banker/notifications' },
    { label: 'Knowledge Base', icon: BookOpen, to: '/dashboard/banker/kb' },
    { label: 'RAG Chat', icon: MessageSquare, to: '/dashboard/banker/rag-chat' },
  ],
  CUSTOMER: [
    { label: 'My Cases', icon: Home, to: '/dashboard/customer' },
    { label: 'Profile & Needs', icon: UserRound, to: '/dashboard/customer/profile' },
    { label: 'Quotes', icon: BarChart3, to: '/dashboard/customer/quotes' },
    { label: 'OTP Consent', icon: ShieldCheck, to: '/dashboard/customer/consent' },
    { label: 'My Policies', icon: FileText, to: '/dashboard/customer/policies' },
    { label: 'Notifications', icon: Bell, to: '/dashboard/customer/notifications' },
    { label: 'RAG Chat', icon: MessageSquare, to: '/dashboard/customer/rag-chat' },
  ],
  UNDERWRITER: [
    { label: 'UW Queue', icon: ClipboardList, to: '/dashboard/underwriter' },
    { label: 'KYC / Documents', icon: ShieldCheck, to: '/dashboard/underwriter/kyc' },
    { label: 'Medical', icon: Stethoscope, to: '/dashboard/underwriter/medical' },
    { label: 'Knowledge Base', icon: BookOpen, to: '/dashboard/underwriter/kb' },
    { label: 'RAG Chat', icon: MessageSquare, to: '/dashboard/underwriter/rag-chat' },
  ],
  COMPLIANCE: [
    { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard/compliance' },
    { label: 'Exceptions', icon: Bell, to: '/dashboard/compliance/exceptions' },
    { label: 'Consents', icon: ShieldCheck, to: '/dashboard/compliance/consents' },
    { label: 'Audit Logs', icon: ClipboardList, to: '/dashboard/compliance/audit' },
    { label: 'Knowledge Base', icon: BookOpen, to: '/dashboard/compliance/kb' },
    { label: 'RAG Chat', icon: MessageSquare, to: '/dashboard/compliance/rag-chat' },
  ],
  OPS_ADMIN: [
    { label: 'Medical Queue', icon: Stethoscope, to: '/dashboard/ops' },
    { label: 'Escalations', icon: Bell, to: '/dashboard/ops/escalations' },
    { label: 'SLA Monitor', icon: ClipboardList, to: '/dashboard/ops/sla' },
    { label: 'Knowledge Base', icon: BookOpen, to: '/dashboard/ops/kb' },
    { label: 'RAG Chat', icon: MessageSquare, to: '/dashboard/ops/rag-chat' },
  ],
}

// Strip HTML tags and decode basic HTML entities to plain text
function stripHtml(html) {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, ' ')      // remove tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')          // collapse whitespace
    .trim()
}

function BellDropdown({ onClose }) {
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)
  const ref = useRef(null)

  useEffect(() => {
    api.get('/notifications/mine').then(r => setNotifs(r.data.notifications || [])).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const markAllRead = async () => {
    await api.post('/notifications/mark-all-read')
    setNotifs(prev => prev.map(n => ({ ...n, status: 'SENT' })))
  }

  return (
    <div ref={ref} className="absolute right-0 top-10 w-80 bg-[#161b2e] border border-[#2a2f45] rounded-xl shadow-2xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2f45]">
        <span className="font-bold text-sm">Notifications</span>
        {notifs.some(n => n.status === 'PENDING') && (
          <button onClick={markAllRead} className="text-xs text-[#6366f1] hover:underline cursor-pointer">Mark all read</button>
        )}
      </div>
      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-xs text-[#6b7280]">Loading…</div>
        ) : notifs.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#6b7280]">No notifications yet</div>
        ) : notifs.slice(0, 10).map(n => (
          <div key={n.id} className={`px-4 py-3 border-b border-[#2a2f45] last:border-0 ${n.status === 'PENDING' ? 'bg-[#6366f1]/5' : ''}`}>
            <div className="flex items-start gap-2">
              {n.status === 'PENDING' && <div className="w-1.5 h-1.5 rounded-full bg-[#6366f1] mt-1.5 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{n.subject}</p>
                <p className="text-xs text-[#6b7280] mt-0.5 line-clamp-2">{stripHtml(n.body) || n.notification_type}</p>
                <p className="text-[10px] text-[#6b7280] mt-1">{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DashboardShell() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { user } = useSelector(s => s.auth)
  const { sidebarOpen } = useSelector(s => s.ui)
  const navItems = NAV[user?.role] || []

  const [unreadCount, setUnreadCount] = useState(0)
  const [bellOpen, setBellOpen] = useState(false)

  useEffect(() => {
    const fetch = () => {
      api.get('/notifications/unread-count').then(r => setUnreadCount(r.data.count || 0)).catch(() => {})
    }
    fetch()
    const interval = setInterval(fetch, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside className={`flex flex-col flex-shrink-0 transition-all duration-200 border-r border-[#2a2f45]`}
        style={{ width: sidebarOpen ? 240 : 64, background: 'var(--surface)' }}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-[#2a2f45]">
          <div className="w-8 h-8 rounded-lg bg-[#6366f1] flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
            Q2P
          </div>
          {sidebarOpen && <span className="font-bold text-sm font-display whitespace-nowrap">Q2P Platform</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {navItems.map(({ label, icon: Icon, to }) => (
            <NavLink key={to} to={to} end={to.split('/').length <= 3}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm transition-colors no-underline
                 ${isActive ? 'bg-[#6366f1]/15 text-[#6366f1] font-semibold' : 'text-[#6b7280] hover:text-white hover:bg-[#1e2235]'}`
              }>
              <Icon size={17} className="flex-shrink-0" />
              {sidebarOpen && <span className="whitespace-nowrap">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-[#2a2f45] p-3">
          {sidebarOpen && (
            <div className="mb-2 px-2">
              <p className="text-xs font-semibold truncate">{user?.name || user?.id?.slice(0, 8)}</p>
              <p className="text-xs text-[#6b7280]">{user?.role}</p>
            </div>
          )}
          <button onClick={() => { dispatch(logout()); navigate('/login') }}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-[#6b7280] hover:text-red-400 hover:bg-[#1e2235] transition-colors cursor-pointer">
            <LogOut size={15} />
            {sidebarOpen && 'Sign out'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center gap-4 px-5 h-14 border-b border-[#2a2f45] flex-shrink-0" style={{ background: 'var(--surface)' }}>
          <button onClick={() => dispatch(toggleSidebar())} className="text-[#6b7280] hover:text-white cursor-pointer">
            <Menu size={20} />
          </button>
          <div className="flex-1" />

          {/* Bell with unread badge */}
          <div className="relative">
            <button onClick={() => setBellOpen(v => !v)} className="relative text-[#6b7280] hover:text-white cursor-pointer p-1">
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#6366f1] text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {bellOpen && <BellDropdown onClose={() => { setBellOpen(false); api.get('/notifications/unread-count').then(r => setUnreadCount(r.data.count || 0)) }} />}
          </div>

          <div className="w-8 h-8 rounded-full bg-[#6366f1] flex items-center justify-center text-white text-xs font-bold">
            {(user?.name || user?.role || 'U')[0].toUpperCase()}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6 fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
