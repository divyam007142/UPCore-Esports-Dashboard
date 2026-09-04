import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  ClipboardList,
  Database,
  Clock3,
  Command,
  FileText,
  Hash,
  LayoutDashboard,
  LifeBuoy,
  LogIn,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Server,
  Settings2,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Ticket as TicketIcon,
  Users,
  X,
  Zap,
} from 'lucide-react';
import {
  useCreateModerationCase,
  useGetCommandAnalytics,
  useGetDashboardActivity,
  useGetDashboardSummary,
  useGetGuildSettings,
  useGetMemberActivity,
  useAuthSession,
  useBotHealth,
  useListStaffActivity,
  getBotHealthQueryKey,
  useListModerationCases,
  useListTickets,
  useUpdateGuildSettings,
  useUpdateTicket,
  getGetCommandAnalyticsQueryKey,
  getGetDashboardActivityQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetGuildSettingsQueryKey,
  getGetMemberActivityQueryKey,
  getListModerationCasesQueryKey,
  getListTicketsQueryKey,
  getStaffActivityQueryKey,
  getDiscordLoginUrl,
  getDiscordLogoutUrl,
  ApiError,
  type AuthSession,
  type ManagedGuild,
  type StaffActivityCategory,
  type StaffActivityEvent,
  type HealthStatus,
  type ActivityEvent,
  type CommandMetric,
  type DashboardSummary,
  type GuildSettings,
  type ModerationCase,
  type ModerationCaseInputAction,
  type MemberActivity,
  type Ticket,
  type TicketStatus,
} from './api';
import { ErrorBoundary } from './components/error-boundary';
import NotFound from './pages/not-found';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import type { ReactNode } from 'react';

const queryClient = new QueryClient();
type IconType = typeof LayoutDashboard;

const navItems: { href: string; label: string; icon: IconType; hint: string }[] = [
  { href: '/', label: 'Command center', icon: LayoutDashboard, hint: 'Overview' },
  { href: '/tickets', label: 'Ticket desk', icon: TicketIcon, hint: 'Support queue' },
  { href: '/moderation', label: 'Moderation', icon: ShieldAlert, hint: 'Case review' },
  { href: '/staff-activity', label: 'Staff activity', icon: ClipboardList, hint: 'Audit timeline' },
  { href: '/analytics', label: 'Analytics', icon: BarChart3, hint: 'Command pulse' },
  { href: '/stats', label: 'Member stats', icon: Users, hint: 'Community pulse' },
  { href: '/bot-health', label: 'Bot health', icon: Server, hint: 'Gateway status' },
  { href: '/settings', label: 'Guild settings', icon: Settings2, hint: 'Bot controls' },
];

type DashboardContextValue = {
  session: AuthSession;
  selectedGuild: ManagedGuild;
  selectGuild: (guildId: string) => void;
  signOut: () => void;
  guildParams: { guildId: string };
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

function useDashboard() {
  const value = useContext(DashboardContext);
  if (!value) throw new Error('Dashboard context is unavailable');
  return value;
}

function initials(name = 'UP') {
  return String(name).split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'UP';
}

function displayValue(value: unknown, fallback = '—') {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const record = value as { globalName?: unknown; username?: unknown; name?: unknown; id?: unknown };
    for (const candidate of [record.globalName, record.username, record.name, record.id]) {
      if (typeof candidate === 'string' && candidate.trim()) return candidate;
    }
  }
  return fallback;
}

function relativeTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diff = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function fullDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function formatUptime(seconds?: number) {
  if (seconds === undefined || seconds === null) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
}

function QueryLoading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" data-testid="status-loading">
      {Array.from({ length: rows }).map((_, index) => <div key={index} className="h-14 animate-pulse rounded-sm bg-secondary/70" />)}
    </div>
  );
}

function QueryError({ onRetry, label = 'This feed is unavailable.' }: { onRetry?: () => void; label?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-sm border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground" data-testid="status-error">
      <span className="flex items-center gap-2"><AlertTriangle className="size-4" /> {label}</span>
      {onRetry && <button data-testid="button-retry" onClick={onRetry} className="inline-flex items-center gap-1.5 font-semibold text-destructive hover:underline"><RefreshCw className="size-3.5" /> Retry</button>}
    </div>
  );
}

function EmptyState({ icon: Icon, title, detail }: { icon: IconType; title: string; detail: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center px-6 text-center" data-testid="status-empty">
      <div className="mb-3 flex size-10 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary"><Icon className="size-5" /></div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const [, setLocation] = useLocation();
  const { session, selectedGuild, selectGuild, signOut } = useDashboard();
  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-border/70 bg-background/90 px-4 backdrop-blur-xl md:px-8">
      <div className="flex items-center gap-3">
        <button data-testid="button-open-menu" onClick={onMenu} className="rounded-sm border border-border p-2 text-muted-foreground md:hidden"><Menu className="size-5" /></button>
        <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><span className="mono-font uppercase tracking-[.16em]">Ops /</span><span className="text-foreground">Live desk</span></div>
        <div className="flex items-center gap-2 sm:hidden"><span className="font-black tracking-tight text-foreground">UP<span className="text-primary">.</span></span><span className="mono-font text-[10px] uppercase tracking-[.15em] text-muted-foreground">Live desk</span></div>
      </div>
      <div className="flex items-center gap-2.5">
        <div className="hidden items-center gap-2 rounded-sm border border-border bg-card px-2 py-1.5 lg:flex"><span className="flex size-2 rounded-full bg-primary pulse-dot" /><select aria-label="Select server" value={selectedGuild.id} onChange={(event) => selectGuild(event.target.value)} className="max-w-44 bg-transparent px-1 py-0.5 mono-font text-[10px] uppercase tracking-[.13em] text-muted-foreground outline-none">{session.guilds.map((guild) => <option key={guild.id} value={guild.id}>{guild.name}</option>)}</select><ChevronDown className="size-3.5 text-muted-foreground" /></div>
        <button data-testid="button-notifications" className="relative rounded-sm border border-border bg-card p-2 text-muted-foreground transition-colors hover:text-foreground"><Bell className="size-4" /><span className="absolute -right-1 -top-1 size-2 rounded-full bg-accent ring-2 ring-background" /></button>
        <button data-testid="button-user-menu" onClick={() => setLocation('/settings')} className="flex items-center gap-2 rounded-sm border border-border bg-card py-1.5 pl-1.5 pr-2 transition-colors hover:border-primary/50"><span className="flex size-7 items-center justify-center rounded-sm bg-primary font-bold text-primary-foreground">{initials(session.user.globalName ?? session.user.username)}</span><span className="hidden text-xs font-semibold sm:inline">{session.user.globalName ?? session.user.username}</span></button>
        <button aria-label="Sign out" title="Sign out" onClick={signOut} className="rounded-sm border border-border bg-card p-2 text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"><LogOut className="size-4" /></button>
      </div>
    </header>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [location] = useLocation();
  return (
    <>
      {open && <button data-testid="button-close-overlay" aria-label="Close menu" onClick={onClose} className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm md:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[252px] flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-300 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-[72px] items-center justify-between border-b border-sidebar-border px-6">
          <Link href="/" data-testid="link-brand" onClick={onClose} className="flex items-center gap-3">
            <span className="relative flex size-9 items-center justify-center overflow-hidden rounded-sm bg-primary font-black text-lg text-primary-foreground">U<span className="absolute -bottom-1 -right-1 text-[18px] text-accent">+</span></span>
            <span><span className="block text-[17px] font-extrabold tracking-[-.05em] text-sidebar-foreground">UPCORE</span><span className="mono-font block text-[9px] uppercase tracking-[.24em] text-primary">Esports / Ops</span></span>
          </Link>
          <button data-testid="button-close-menu" onClick={onClose} className="rounded-sm p-1.5 text-sidebar-foreground/60 hover:text-sidebar-foreground md:hidden"><X className="size-4" /></button>
        </div>
        <div className="px-4 pt-7">
          <p className="mono-font mb-2 px-3 text-[9px] uppercase tracking-[.22em] text-sidebar-foreground/40">Workspace</p>
          <nav className="space-y-1">
            {navItems.map(({ href, label, icon: Icon, hint }) => {
              const active = location === href;
              return <Link key={href} href={href} onClick={onClose} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`} className={`group flex items-center gap-3 rounded-sm border px-3 py-2.5 transition-all ${active ? 'border-primary/20 bg-primary/10 text-primary' : 'border-transparent text-sidebar-foreground/65 hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-foreground'}`}>
                <Icon className={`size-[17px] ${active ? 'text-primary' : 'text-sidebar-foreground/55 group-hover:text-sidebar-foreground'}`} />
                <span className="flex-1 text-[12px] font-bold tracking-wide">{label}</span>
                {active ? <span className="size-1.5 rounded-full bg-primary" /> : <span className="hidden text-[9px] text-sidebar-foreground/35 group-hover:inline">{hint}</span>}
              </Link>;
            })}
          </nav>
        </div>
        <div className="mt-auto p-4">
          <div className="relative overflow-hidden rounded-sm border border-primary/15 bg-primary/5 p-4 scanline">
            <div className="relative z-10">
              <div className="mb-3 flex items-center justify-between"><span className="mono-font text-[9px] uppercase tracking-[.18em] text-primary">Bot status</span><span className="flex size-2 rounded-full bg-primary pulse-dot" /></div>
              <p className="text-sm font-bold text-sidebar-foreground">All systems operational</p>
              <p className="mt-1 text-[11px] leading-4 text-sidebar-foreground/45">Connected to Discord gateway</p>
              <div className="mt-4 flex items-center justify-between border-t border-primary/10 pt-3"><span className="mono-font text-[9px] text-sidebar-foreground/45">UPTIME</span><span className="mono-font text-[10px] text-primary">99.98%</span></div>
            </div>
          </div>
          <p className="mono-font mt-5 text-center text-[9px] tracking-[.13em] text-sidebar-foreground/25">UPCORE CONTROL / V1.4.2</p>
        </div>
      </aside>
    </>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { selectedGuild } = useDashboard();
  return <div className="min-h-[100dvh] bg-background"><Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} /><div className="min-h-[100dvh] md:pl-[252px]"><TopBar onMenu={() => setMenuOpen(true)} /><main className="mx-auto max-w-[1560px] p-4 md:p-8"><div className="mb-5 flex items-center gap-2 text-[10px] text-muted-foreground"><Server className="size-3.5 text-primary" /><span className="mono-font uppercase tracking-[.13em]">Managing</span><span className="font-semibold text-foreground">{selectedGuild.name}</span></div>{children}</main></div></div>;
}

function PageHeader({ eyebrow, title, detail, action }: { eyebrow: string; title: ReactNode; detail: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mono-font mb-2 text-[10px] uppercase tracking-[.24em] text-primary">{eyebrow}</p><h1 className="display-font text-5xl font-bold uppercase leading-[.85] tracking-[-.025em] text-foreground sm:text-6xl">{title}</h1><p className="mt-3 max-w-xl text-sm text-muted-foreground">{detail}</p></div>{action}</div>;
}

function StatCard({ label, value, meta, icon: Icon, tone = 'lime' }: { label: string; value: string | number; meta: string; icon: IconType; tone?: 'lime' | 'orange' | 'blue' | 'red' }) {
  const colors = { lime: 'text-primary bg-primary/10 border-primary/20', orange: 'text-accent bg-accent/10 border-accent/20', blue: 'text-chart-3 bg-chart-3/10 border-chart-3/20', red: 'text-destructive bg-destructive/10 border-destructive/20' };
  return <div className="group relative overflow-hidden rounded-sm border border-card-border bg-card p-5 transition-transform duration-300 hover:-translate-y-0.5" data-testid={`card-stat-${label.toLowerCase().replaceAll(' ', '-')}`}><div className="flex items-start justify-between"><span className="mono-font text-[10px] uppercase tracking-[.18em] text-muted-foreground">{label}</span><span className={`flex size-8 items-center justify-center rounded-sm border ${colors[tone]}`}><Icon className="size-4" /></span></div><p className="display-font mt-5 text-4xl font-bold tracking-tight">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{meta}</p><div className={`absolute -bottom-7 -right-2 size-20 rounded-full blur-2xl opacity-10 ${tone === 'lime' ? 'bg-primary' : tone === 'orange' ? 'bg-accent' : 'bg-chart-3'}`} /></div>;
}

function Panel({ title, eyebrow, children, className = '', action }: { title: string; eyebrow?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return <section className={`overflow-hidden rounded-sm border border-card-border bg-card ${className}`}><div className="flex items-center justify-between border-b border-card-border px-5 py-4"><div>{eyebrow && <p className="mono-font mb-1 text-[9px] uppercase tracking-[.2em] text-primary">{eyebrow}</p>}<h2 className="text-sm font-extrabold tracking-tight">{title}</h2></div>{action}</div>{children}</section>;
}

function EventRow({ event }: { event: ActivityEvent }) {
  const eventIcon = event.type === 'ticket' ? TicketIcon : event.type === 'moderation' ? ShieldAlert : event.type === 'member' ? Users : event.type === 'settings' ? Settings2 : Bot;
  const Icon = eventIcon;
  const tone = event.severity === 'critical' ? 'text-destructive bg-destructive/10' : event.severity === 'warning' ? 'text-accent bg-accent/10' : event.severity === 'positive' ? 'text-primary bg-primary/10' : 'text-chart-3 bg-chart-3/10';
  return <div className="group flex gap-3 border-b border-card-border/70 px-5 py-4 last:border-0" data-testid={`row-activity-${displayValue(event.id, 'activity')}`}><div className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-sm ${tone}`}><Icon className="size-4" /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><p className="truncate text-xs font-bold">{displayValue(event.title, 'Activity update')}</p><span className="mono-font shrink-0 text-[9px] text-muted-foreground">{relativeTime(event.occurredAt)}</span></div><p className="mt-1 truncate text-[11px] text-muted-foreground">{displayValue(event.detail)}</p><p className="mt-2 text-[10px] text-muted-foreground/65">by <span className="text-foreground/70">{displayValue(event.actor, 'UPCore Bot')}</span></p></div></div>;
}

function Home() {
  const { guildParams } = useDashboard();
  const summaryQuery = useGetDashboardSummary(guildParams, { query: { queryKey: getGetDashboardSummaryQueryKey(guildParams), refetchInterval: 30000 } });
  const activityQuery = useGetDashboardActivity({ ...guildParams, limit: 8 }, { query: { queryKey: getGetDashboardActivityQueryKey({ ...guildParams, limit: 8 }), refetchInterval: 30000 } });
  const healthQuery = useBotHealth(guildParams, { query: { queryKey: getBotHealthQueryKey(guildParams), refetchInterval: 30000 } });
  const summary = summaryQuery.data as DashboardSummary | undefined;
  const activity = Array.isArray(activityQuery.data) ? activityQuery.data as ActivityEvent[] : [];
  const guildName = summary?.guildName ?? 'UPCore Esports';
  return <Shell><PageHeader eyebrow="Live operations / 00:00 UTC" title={<>Command<br /><span className="text-primary">center.</span></>} detail={`A live pulse of ${guildName}. Keep the queue moving, catch the edge cases, and stay ahead of your community.`} action={<div className="flex items-center gap-2 rounded-sm border border-primary/20 bg-primary/5 px-3 py-2.5"><span className="flex size-2 rounded-full bg-primary pulse-dot" /><span className="mono-font text-[10px] uppercase tracking-[.14em] text-primary">Live connection</span><span className="text-[10px] text-muted-foreground">{healthQuery.data?.status ?? 'checking'}</span></div>} />
    <div className="space-y-5">
      {summaryQuery.isLoading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><QueryLoading rows={4} /></div> : summaryQuery.isError ? <QueryError onRetry={() => summaryQuery.refetch()} label="Summary metrics could not be loaded." /> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 animate-rise"><StatCard label="Members online" value={summary?.onlineMembers ?? '—'} meta={`${summary?.memberCount ?? '—'} total members`} icon={Users} /><StatCard label="Open tickets" value={summary?.openTickets ?? '—'} meta={summary?.deltaLabel ?? 'Current queue'} icon={TicketIcon} tone="orange" /><StatCard label="Unresolved cases" value={summary?.unresolvedCases ?? '—'} meta="Needs staff review" icon={ShieldAlert} tone="red" /><StatCard label="Command success" value={summary ? `${summary.commandSuccessRate}%` : '—'} meta={`Uptime ${summary?.uptime ?? '—'}`} icon={Zap} tone="blue" /></div>}
       <div className="grid gap-5 xl:grid-cols-[1.4fr_.8fr]">
        <Panel title="Recent activity" eyebrow="Signal feed" action={<Link href="/tickets" data-testid="link-view-all-activity" className="mono-font flex items-center gap-1 text-[9px] uppercase tracking-[.15em] text-muted-foreground hover:text-primary">View desk <ChevronRight className="size-3" /></Link>}>
          {activityQuery.isLoading ? <div className="p-5"><QueryLoading rows={5} /></div> : activityQuery.isError ? <div className="p-5"><QueryError onRetry={() => activityQuery.refetch()} /></div> : activity.length ? activity.map((event) => <EventRow key={event.id} event={event} />) : <EmptyState icon={Activity} title="No activity in the signal feed" detail="New ticket, member, and moderation events will land here." />}
        </Panel>
        <Panel title="Operational readout" eyebrow="At a glance">
          <div className="space-y-1 p-5">
             <ReadoutRow label="Gateway status" value={healthQuery.data?.status ?? (healthQuery.isLoading ? 'checking' : 'unknown')} tone={healthQuery.data?.status === 'ok' ? 'good' : 'neutral'} />
             <ReadoutRow label="Bot uptime" value={formatUptime(healthQuery.data?.uptimeSeconds)} tone="good" />
            <ReadoutRow label="Members online" value={summary ? `${summary.onlineMembers} / ${summary.memberCount}` : '—'} />
            <ReadoutRow label="Tickets needing reply" value={summary?.openTickets ?? '—'} tone="warn" />
            <ReadoutRow label="Active cases" value={summary?.unresolvedCases ?? '—'} tone="alert" />
            <div className="mt-5 border-t border-card-border pt-5"><div className="mb-2 flex justify-between"><span className="mono-font text-[9px] uppercase tracking-[.16em] text-muted-foreground">Community pulse</span><span className="mono-font text-[10px] text-primary">NOMINAL</span></div><div className="flex h-12 items-end gap-1">{[38, 56, 43, 72, 61, 86, 68, 94, 78, 100, 82, 90].map((height, index) => <div key={index} className="flex-1 rounded-t-[2px] bg-primary/70 transition-all duration-300 hover:bg-primary" style={{ height: `${height}%` }} />)}</div><div className="mt-2 flex justify-between text-[9px] text-muted-foreground"><span>12h ago</span><span>now</span></div></div>
          </div>
        </Panel>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        <Link href="/tickets" data-testid="link-quick-ticket-desk" className="group rounded-sm border border-card-border bg-card p-5 transition-colors hover:border-primary/50"><div className="mb-10 flex items-center justify-between"><TicketIcon className="size-5 text-accent" /><ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" /></div><p className="mono-font text-[9px] uppercase tracking-[.17em] text-muted-foreground">Quick action</p><p className="mt-1 text-lg font-extrabold">Open ticket desk</p><p className="mt-1 text-xs text-muted-foreground">Search, assign, and move the queue forward.</p></Link>
        <Link href="/moderation" data-testid="link-quick-moderation" className="group rounded-sm border border-card-border bg-card p-5 transition-colors hover:border-primary/50"><div className="mb-10 flex items-center justify-between"><ShieldAlert className="size-5 text-destructive" /><ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" /></div><p className="mono-font text-[9px] uppercase tracking-[.17em] text-muted-foreground">Quick action</p><p className="mt-1 text-lg font-extrabold">Review cases</p><p className="mt-1 text-xs text-muted-foreground">Keep the record clear and the community safe.</p></Link>
        <Link href="/settings" data-testid="link-quick-settings" className="group rounded-sm border border-card-border bg-card p-5 transition-colors hover:border-primary/50"><div className="mb-10 flex items-center justify-between"><SlidersHorizontal className="size-5 text-chart-3" /><ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" /></div><p className="mono-font text-[9px] uppercase tracking-[.17em] text-muted-foreground">Quick action</p><p className="mt-1 text-lg font-extrabold">Tune automations</p><p className="mt-1 text-xs text-muted-foreground">Make the bot work the way your staff works.</p></Link>
      </div>
    </div>
  </Shell>;
}

function ReadoutRow({ label, value, tone = 'neutral' }: { label: string; value: string | number; tone?: 'neutral' | 'good' | 'warn' | 'alert' }) {
  const dot = tone === 'good' ? 'bg-primary' : tone === 'warn' ? 'bg-accent' : tone === 'alert' ? 'bg-destructive' : 'bg-chart-3';
  return <div className="flex items-center justify-between border-b border-card-border/60 py-3 last:border-0"><span className="flex items-center gap-2 text-xs text-muted-foreground"><span className={`size-1.5 rounded-full ${dot}`} />{label}</span><span className="mono-font text-[11px] font-medium text-foreground">{value}</span></div>;
}

function TicketDesk() {
  const { guildParams } = useDashboard();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | TicketStatus>('all');
  const params = useMemo(() => ({ ...guildParams, ...(search ? { search } : {}), ...(status !== 'all' ? { status } : {}) }), [guildParams, search, status]);
  const query = useListTickets(params, { query: { queryKey: getListTicketsQueryKey(params) } });
  const update = useUpdateTicket();
  const client = useQueryClient();
  const [notice, setNotice] = useState('');
  const tickets = (query.data as Ticket[] | undefined) ?? [];
  const changeStatus = (ticket: Ticket, nextStatus: TicketStatus) => {
    update.mutate({ ticketId: ticket.id, guildId: guildParams.guildId, data: { status: nextStatus } }, { onSuccess: () => { setNotice(`Ticket ${ticket.ticketId} moved to ${nextStatus}.`); client.invalidateQueries({ queryKey: getListTicketsQueryKey(params) }); } });
  };
  const changeAssignee = (ticket: Ticket, assignee: string) => {
    update.mutate({ ticketId: ticket.id, guildId: guildParams.guildId, data: { assignee: assignee.trim() || null } }, { onSuccess: () => { setNotice(`${ticket.ticketId} assignment updated.`); client.invalidateQueries({ queryKey: getListTicketsQueryKey(params) }); } });
  };
  return <Shell><PageHeader eyebrow="Support operations / Queue" title={<>Ticket<br /><span className="text-primary">desk.</span></>} detail="One queue, every conversation. Search the community's open loops and move them to resolution." action={<div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="flex size-2 rounded-full bg-accent" /><span className="mono-font text-[10px] uppercase tracking-[.15em]">Queue sync live</span></div>} />
    <div className="space-y-5">
      {notice && <div className="flex items-center justify-between rounded-sm border border-primary/20 bg-primary/10 px-4 py-3 text-xs text-primary" data-testid="status-ticket-update"><span className="flex items-center gap-2"><Check className="size-4" />{notice}</span><button data-testid="button-dismiss-notice" onClick={() => setNotice('')}><X className="size-4" /></button></div>}
      <div className="flex flex-col gap-3 rounded-sm border border-card-border bg-card p-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input data-testid="input-ticket-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search subject, requester, or ticket ID" className="h-10 w-full rounded-sm border border-input bg-background px-10 text-sm outline-none ring-primary/30 transition focus:ring-2" /></div><div className="relative"><select data-testid="select-ticket-status" value={status} onChange={(event) => setStatus(event.target.value as 'all' | TicketStatus)} className="h-10 w-full appearance-none rounded-sm border border-input bg-background px-3 pr-9 text-xs font-semibold capitalize outline-none sm:w-40"><option value="all">All statuses</option><option value="open">Open</option><option value="pending">Pending</option><option value="escalated">Escalated</option><option value="closed">Closed</option></select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /></div><button data-testid="button-refresh-tickets" onClick={() => query.refetch()} className="flex h-10 items-center justify-center gap-2 rounded-sm border border-input px-3 text-xs font-bold text-muted-foreground transition hover:border-primary/50 hover:text-foreground"><RefreshCw className={`size-3.5 ${query.isFetching ? 'animate-spin' : ''}`} /> Refresh</button></div>
      <Panel title={`${tickets.length} tickets in view`} eyebrow="Support queue" action={<span className="mono-font text-[9px] uppercase tracking-[.15em] text-muted-foreground">Sorted by activity</span>}>
        {query.isLoading ? <div className="p-5"><QueryLoading rows={6} /></div> : query.isError ? <div className="p-5"><QueryError onRetry={() => query.refetch()} label="Ticket queue could not be loaded." /></div> : tickets.length === 0 ? <EmptyState icon={TicketIcon} title="No tickets match this view" detail={search ? 'Try a broader search or clear the filter.' : 'The support queue is clear. Nice work.'} /> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead><tr className="border-b border-card-border text-[9px] uppercase tracking-[.16em] text-muted-foreground"><th className="px-5 py-3 font-medium">Ticket</th><th className="px-5 py-3 font-medium">Requester</th><th className="px-5 py-3 font-medium">Assignee</th><th className="px-5 py-3 font-medium">Priority</th><th className="px-5 py-3 font-medium">Activity</th><th className="px-5 py-3 font-medium">Status</th></tr></thead><tbody>{tickets.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} pending={update.isPending} onStatus={(value) => changeStatus(ticket, value)} onAssignee={(value) => changeAssignee(ticket, value)} />)}</tbody></table></div>}
      </Panel>
    </div>
  </Shell>;
}

function TicketRow({ ticket, pending, onStatus, onAssignee }: { ticket: Ticket; pending: boolean; onStatus: (status: TicketStatus) => void; onAssignee: (assignee: string) => void }) {
  const [assignee, setAssignee] = useState(ticket.assignee ?? '');
  const priorityTone = ticket.priority === 'urgent' ? 'text-destructive bg-destructive/10' : ticket.priority === 'high' ? 'text-accent bg-accent/10' : 'text-muted-foreground bg-secondary';
  return <tr className="group border-b border-card-border/60 transition-colors hover:bg-secondary/35 last:border-0" data-testid={`row-ticket-${ticket.id}`}><td className="px-5 py-4"><div className="flex items-center gap-3"><span className={`flex size-8 items-center justify-center rounded-sm ${ticket.category === 'tournament' ? 'bg-chart-3/10 text-chart-3' : 'bg-primary/10 text-primary'}`}><MessageSquare className="size-4" /></span><div><p className="max-w-[260px] truncate text-xs font-bold">{ticket.subject}</p><p className="mono-font mt-1 text-[9px] tracking-wide text-muted-foreground">{ticket.ticketId} · {ticket.category}</p></div></div></td><td className="px-5 py-4"><p className="text-xs font-semibold">{ticket.requester}</p><p className="mono-font mt-1 text-[9px] text-muted-foreground">{ticket.requesterTag ?? 'member'}</p></td><td className="px-5 py-4"><div className="flex items-center gap-1"><input aria-label={`Assignee for ${ticket.ticketId}`} data-testid={`input-ticket-assignee-${ticket.id}`} value={assignee} onChange={(event) => setAssignee(event.target.value)} placeholder="Unassigned" className="h-8 w-24 rounded-sm border border-input bg-background px-2 text-[10px] outline-none focus:border-primary" /><button data-testid={`button-save-assignee-${ticket.id}`} disabled={pending || assignee === (ticket.assignee ?? '')} onClick={() => onAssignee(assignee)} className="flex size-8 items-center justify-center rounded-sm border border-input text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-35"><Check className="size-3.5" /></button></div></td><td className="px-5 py-4"><span className={`rounded-sm px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${priorityTone}`}>{ticket.priority}</span></td><td className="px-5 py-4"><p className="text-xs text-foreground">{relativeTime(ticket.lastActivity)}</p><p className="mono-font mt-1 text-[9px] text-muted-foreground">{ticket.messageCount ?? 0} messages</p></td><td className="px-5 py-4"><div className="relative inline-block"><select data-testid={`select-ticket-status-${ticket.id}`} disabled={pending} value={ticket.status} onChange={(event) => onStatus(event.target.value as TicketStatus)} className="h-8 appearance-none rounded-sm border border-input bg-background px-2 pr-7 text-[10px] font-bold capitalize outline-none focus:border-primary"><option value="open">Open</option><option value="pending">Pending</option><option value="escalated">Escalated</option><option value="closed">Closed</option></select><ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" /></div></td></tr>;
}

function Moderation() {
  const { guildParams } = useDashboard();
  const moderationParams = { ...guildParams, limit: 50 };
  const query = useListModerationCases(moderationParams, { query: { queryKey: getListModerationCasesQueryKey(moderationParams) } });
  const create = useCreateModerationCase(guildParams.guildId);
  const client = useQueryClient();
  const [modal, setModal] = useState(false);
  const [action, setAction] = useState<ModerationCaseInputAction>('warn');
  const [user, setUser] = useState('');
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState('');
  const cases = (query.data as ModerationCase[] | undefined) ?? [];
  const submit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (!user.trim() || !reason.trim()) return;
    create.mutate({ data: { action, user: user.trim(), reason: reason.trim() } }, { onSuccess: (created) => { setModal(false); setUser(''); setReason(''); setNotice(`Case #${created.caseNumber} recorded.`); client.invalidateQueries({ queryKey: getListModerationCasesQueryKey(moderationParams) }); } });
  };
  return <Shell><PageHeader eyebrow="Trust & safety / Casebook" title={<>Moderation<br /><span className="text-primary">watch.</span></>} detail="Review the paper trail, document decisive action, and keep every call accountable." action={<button data-testid="button-new-case" onClick={() => setModal(true)} className="flex items-center justify-center gap-2 rounded-sm bg-primary px-4 py-3 text-xs font-extrabold text-primary-foreground transition hover:brightness-105"><Plus className="size-4" /> New case</button>} />
    <div className="space-y-5">
       {notice && <div className="flex items-center justify-between rounded-sm border border-primary/20 bg-primary/10 px-4 py-3 text-xs text-primary" data-testid="status-case-created"><span className="flex items-center gap-2"><Check className="size-4" />{notice}</span><button data-testid="button-dismiss-case-notice" onClick={() => setNotice('')}><X className="size-4" /></button></div>}
      <div className="grid gap-3 sm:grid-cols-3"><StatCard label="Cases this month" value={cases.length} meta="Across all actions" icon={FileText} /><StatCard label="Active restrictions" value={cases.filter((item) => item.status === 'active' && ['mute', 'ban'].includes(item.action)).length} meta="Requires attention" icon={ShieldAlert} tone="red" /><StatCard label="Record health" value="Clear" meta="No overdue reviews" icon={Check} tone="blue" /></div>
      <Panel title="Case log" eyebrow="Latest decisions" action={<span className="mono-font text-[9px] uppercase tracking-[.15em] text-muted-foreground">Newest first</span>}>
        {query.isLoading ? <div className="p-5"><QueryLoading rows={6} /></div> : query.isError ? <div className="p-5"><QueryError onRetry={() => query.refetch()} label="Moderation records could not be loaded." /></div> : cases.length === 0 ? <EmptyState icon={ShieldAlert} title="The casebook is quiet" detail="New moderation records will appear here as staff document action." /> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-card-border text-[9px] uppercase tracking-[.16em] text-muted-foreground"><th className="px-5 py-3 font-medium">Case</th><th className="px-5 py-3 font-medium">Member</th><th className="px-5 py-3 font-medium">Action</th><th className="px-5 py-3 font-medium">Reason</th><th className="px-5 py-3 font-medium">Moderator</th><th className="px-5 py-3 font-medium">Status</th></tr></thead><tbody>{cases.map((item) => <ModerationRow key={item.id} item={item} />)}</tbody></table></div>}
      </Panel>
    </div>
    {modal && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 p-4 backdrop-blur-md" data-testid="dialog-new-case"><div className="w-full max-w-lg rounded-sm border border-card-border bg-card shadow-2xl"><div className="flex items-center justify-between border-b border-card-border px-5 py-4"><div><p className="mono-font text-[9px] uppercase tracking-[.2em] text-primary">Casebook / New record</p><h2 className="mt-1 text-lg font-extrabold">Document a moderation case</h2></div><button data-testid="button-close-case-dialog" onClick={() => setModal(false)} className="rounded-sm p-1.5 text-muted-foreground hover:text-foreground"><X className="size-5" /></button></div><form onSubmit={submit} className="space-y-5 p-5"><label className="block"><span className="mono-font mb-2 block text-[9px] uppercase tracking-[.15em] text-muted-foreground">Action</span><select data-testid="select-case-action" value={action} onChange={(event) => setAction(event.target.value as ModerationCaseInputAction)} className="h-11 w-full rounded-sm border border-input bg-background px-3 text-sm capitalize outline-none focus:border-primary"><option value="warn">Warn</option><option value="mute">Mute</option><option value="kick">Kick</option><option value="ban">Ban</option><option value="unban">Unban</option><option value="note">Note</option></select></label><label className="block"><span className="mono-font mb-2 block text-[9px] uppercase tracking-[.15em] text-muted-foreground">Member username or ID</span><input data-testid="input-case-user" required value={user} onChange={(event) => setUser(event.target.value)} placeholder="@member or user ID" className="h-11 w-full rounded-sm border border-input bg-background px-3 text-sm outline-none focus:border-primary" /></label><label className="block"><span className="mono-font mb-2 block text-[9px] uppercase tracking-[.15em] text-muted-foreground">Reason</span><textarea data-testid="textarea-case-reason" required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="What happened? Keep the record specific." rows={4} className="w-full resize-none rounded-sm border border-input bg-background px-3 py-3 text-sm outline-none focus:border-primary" /></label><div className="flex justify-end gap-2 border-t border-card-border pt-4"><button type="button" data-testid="button-cancel-case" onClick={() => setModal(false)} className="rounded-sm border border-input px-4 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground">Cancel</button><button type="submit" data-testid="button-submit-case" disabled={create.isPending || !user.trim() || !reason.trim()} className="flex items-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-xs font-extrabold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">{create.isPending ? 'Recording…' : 'Record case'}<ChevronRight className="size-3.5" /></button></div></form></div></div>}
  </Shell>;
}

function ModerationRow({ item }: { item: ModerationCase }) {
  const tone = item.action === 'ban' || item.action === 'kick' ? 'text-destructive bg-destructive/10' : item.action === 'mute' ? 'text-accent bg-accent/10' : 'text-chart-3 bg-chart-3/10';
  return <tr className="border-b border-card-border/60 last:border-0 hover:bg-secondary/35" data-testid={`row-case-${item.id}`}><td className="px-5 py-4"><span className="mono-font text-xs font-medium text-primary">#{String(item.caseNumber).padStart(4, '0')}</span><p className="mt-1 text-[10px] text-muted-foreground">{fullDate(item.createdAt)}</p></td><td className="px-5 py-4"><p className="text-xs font-bold">{item.user}</p><p className="mono-font mt-1 text-[9px] text-muted-foreground">{item.userTag ?? 'member'}</p></td><td className="px-5 py-4"><span className={`rounded-sm px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${tone}`}>{item.action}</span></td><td className="max-w-[280px] px-5 py-4 text-xs text-muted-foreground"><p className="truncate">{item.reason}</p></td><td className="px-5 py-4 text-xs text-muted-foreground">{item.moderator}</td><td className="px-5 py-4"><span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold capitalize ${item.status === 'active' ? 'text-primary' : 'text-muted-foreground'}`}><span className={`size-1.5 rounded-full ${item.status === 'active' ? 'bg-primary' : 'bg-muted-foreground'}`} />{item.status}</span></td></tr>;
}

function Settings() {
  const { guildParams } = useDashboard();
  const query = useGetGuildSettings(guildParams, { query: { queryKey: getGetGuildSettingsQueryKey(guildParams) } });
  const update = useUpdateGuildSettings(guildParams.guildId);
  const client = useQueryClient();
  const [draft, setDraft] = useState<Partial<GuildSettings>>({});
  const [notice, setNotice] = useState('');
  useEffect(() => { if (query.data) setDraft(query.data as GuildSettings); }, [query.data]);
  const settings = draft as GuildSettings;
  const setToggle = (key: 'automodEnabled' | 'welcomeEnabled' | 'translationEnabled', value: boolean) => {
    setDraft((current) => ({ ...current, [key]: value }));
    update.mutate({ data: { [key]: value } }, { onSuccess: (result) => { setDraft(result as GuildSettings); setNotice('Automation settings saved.'); client.invalidateQueries({ queryKey: getGetGuildSettingsQueryKey(guildParams) }); } });
  };
  const saveChannel = () => { if (!settings.logChannel?.trim()) return; update.mutate({ data: { logChannel: settings.logChannel.trim() } }, { onSuccess: (result) => { setDraft(result as GuildSettings); setNotice('Log channel saved.'); client.invalidateQueries({ queryKey: getGetGuildSettingsQueryKey(guildParams) }); } }); };
  return <Shell><PageHeader eyebrow="Configuration / Guild controls" title={<>Guild<br /><span className="text-primary">settings.</span></>} detail="Shape the way UPCore shows up for your community. Changes apply to the bot immediately." action={<div className="flex items-center gap-2 text-xs text-muted-foreground"><Settings2 className="size-4 text-chart-3" /><span className="mono-font text-[10px] uppercase tracking-[.15em]">Admin access</span></div>} />
    <div className="space-y-5">
      {notice && <div className="flex items-center justify-between rounded-sm border border-primary/20 bg-primary/10 px-4 py-3 text-xs text-primary" data-testid="status-settings-update"><span className="flex items-center gap-2"><Check className="size-4" />{notice}</span><button data-testid="button-dismiss-settings-notice" onClick={() => setNotice('')}><X className="size-4" /></button></div>}
      {query.isLoading ? <QueryLoading rows={4} /> : query.isError ? <QueryError onRetry={() => query.refetch()} label="Guild settings could not be loaded." /> : <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><div className="space-y-5"><Panel title="Automation switches" eyebrow="Bot behavior"><div className="divide-y divide-card-border/70"><ToggleRow label="Auto moderation" detail="Catch common abuse patterns before staff need to step in." enabled={Boolean(settings.automodEnabled)} pending={update.isPending} onChange={(value) => setToggle('automodEnabled', value)} testId="automod" /><ToggleRow label="Welcome messages" detail="Greet new members and point them toward the right channels." enabled={Boolean(settings.welcomeEnabled)} pending={update.isPending} onChange={(value) => setToggle('welcomeEnabled', value)} testId="welcome" /><ToggleRow label="Translation assist" detail="Offer automatic translation when conversations cross language lines." enabled={Boolean(settings.translationEnabled)} pending={update.isPending} onChange={(value) => setToggle('translationEnabled', value)} testId="translation" /></div></Panel><Panel title="Ticket routing" eyebrow="Support desk"><div className="grid gap-5 p-5 sm:grid-cols-2"><div><p className="mono-font text-[9px] uppercase tracking-[.15em] text-muted-foreground">Active categories</p><p className="display-font mt-2 text-4xl font-bold text-primary">{settings.ticketCategories ?? '—'}</p><p className="mt-1 text-xs text-muted-foreground">Configured in Discord</p></div><div><label className="mono-font block text-[9px] uppercase tracking-[.15em] text-muted-foreground" htmlFor="log-channel">Log channel</label><div className="mt-2 flex gap-2"><input id="log-channel" data-testid="input-log-channel" value={settings.logChannel ?? ''} onChange={(event) => setDraft((current) => ({ ...current, logChannel: event.target.value }))} className="h-10 min-w-0 flex-1 rounded-sm border border-input bg-background px-3 text-sm outline-none focus:border-primary" /><button data-testid="button-save-log-channel" onClick={saveChannel} disabled={update.isPending} className="rounded-sm bg-primary px-3 text-xs font-extrabold text-primary-foreground disabled:opacity-50">Save</button></div><p className="mt-2 text-[10px] text-muted-foreground">Where bot events are recorded.</p></div></div></Panel></div><div className="space-y-5"><div className="rounded-sm border border-primary/20 bg-primary/10 p-5"><div className="flex items-center gap-2 text-primary"><Radio className="size-4" /><span className="mono-font text-[9px] uppercase tracking-[.17em]">Guild identity</span></div><p className="display-font mt-6 text-4xl font-bold uppercase">{settings.guildName ?? 'UPCore Esports'}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Selected guild is resolved by the connected bot adapter. Staff changes are scoped to this community.</p><div className="mt-6 flex items-center gap-2 border-t border-primary/15 pt-4 text-[10px] text-primary"><span className="size-1.5 rounded-full bg-primary" />Changes sync instantly</div></div><Panel title="Configuration notes" eyebrow="Staff reference"><div className="space-y-4 p-5 text-xs leading-5 text-muted-foreground"><p className="flex gap-3"><Hash className="mt-0.5 size-4 shrink-0 text-chart-3" />Ticket categories are managed through your Discord channel structure.</p><p className="flex gap-3"><Clock3 className="mt-0.5 size-4 shrink-0 text-accent" />Automation changes take effect on the next gateway event.</p><p className="flex gap-3"><LifeBuoy className="mt-0.5 size-4 shrink-0 text-primary" />Need help? Open a staff support ticket from the ticket desk.</p></div></Panel></div></div>}
    </div>
  </Shell>;
}

function ToggleRow({ label, detail, enabled, pending, onChange, testId }: { label: string; detail: string; enabled: boolean; pending: boolean; onChange: (value: boolean) => void; testId: string }) {
  return <div className="flex items-center justify-between gap-5 px-5 py-5"><div><p className="text-sm font-bold">{label}</p><p className="mt-1 max-w-lg text-xs leading-5 text-muted-foreground">{detail}</p></div><button type="button" data-testid={`switch-${testId}`} aria-pressed={enabled} disabled={pending} onClick={() => onChange(!enabled)} className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${enabled ? 'border-primary bg-primary' : 'border-input bg-secondary'} disabled:opacity-60`}><span className={`absolute top-1 size-4 rounded-full transition-transform ${enabled ? 'translate-x-5 bg-primary-foreground' : 'translate-x-1 bg-muted-foreground'}`} /></button></div>;
}

function Analytics() {
  const { guildParams } = useDashboard();
  const query = useGetCommandAnalytics(guildParams, { query: { queryKey: getGetCommandAnalyticsQueryKey(guildParams) } });
  const metrics = (query.data as CommandMetric[] | undefined) ?? [];
  const totalUses = metrics.reduce((sum, item) => sum + item.uses, 0);
  const averageSuccess = metrics.length ? metrics.reduce((sum, item) => sum + item.successRate, 0) / metrics.length : 0;
  const maxUses = Math.max(...metrics.map((item) => item.uses), 1);
  return <Shell><PageHeader eyebrow="Performance / Command telemetry" title={<>Usage<br /><span className="text-primary">analytics.</span></>} detail="Understand which commands carry the community, where friction shows up, and what your staff reaches for next." action={<div className="flex items-center gap-2 rounded-sm border border-border bg-card px-3 py-2.5"><Activity className="size-4 text-chart-3" /><span className="mono-font text-[10px] uppercase tracking-[.15em] text-muted-foreground">Rolling 30 days</span></div>} />
    <div className="space-y-5">
      {query.isLoading ? <QueryLoading rows={5} /> : query.isError ? <QueryError onRetry={() => query.refetch()} label="Command analytics could not be loaded." /> : metrics.length === 0 ? <Panel title="Command telemetry" eyebrow="Usage signal"><EmptyState icon={BarChart3} title="No command data yet" detail="Usage will appear as the UPCore bot handles commands in your guild." /></Panel> : <><div className="grid gap-3 sm:grid-cols-3"><StatCard label="Total command uses" value={totalUses.toLocaleString()} meta="Across tracked commands" icon={Command} /><StatCard label="Average success" value={`${averageSuccess.toFixed(1)}%`} meta="Successful command responses" icon={Check} tone="blue" /><StatCard label="Top command" value={`/${metrics[0].command.replace('/', '')}`} meta={`${metrics[0].uses.toLocaleString()} uses`} icon={Sparkles} tone="orange" /></div><div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><Panel title="Command volume" eyebrow="Usage by command"><div className="space-y-5 p-5">{metrics.map((metric) => <MetricBar key={metric.command} metric={metric} maxUses={maxUses} />)}</div></Panel><Panel title="Signal notes" eyebrow="Read the room"><div className="space-y-4 p-5"><div className="rounded-sm border border-chart-3/20 bg-chart-3/10 p-4"><p className="mono-font text-[9px] uppercase tracking-[.15em] text-chart-3">Most reached</p><p className="mt-2 text-sm font-extrabold">{metrics[0].command}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">This is the command your community relies on most. Keep its response path sharp.</p></div><div className="rounded-sm border border-primary/20 bg-primary/10 p-4"><p className="mono-font text-[9px] uppercase tracking-[.15em] text-primary">Trend watch</p><p className="mt-2 text-sm font-extrabold">{metrics.filter((item) => item.trend > 0).length} commands gaining traction</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Compare usage momentum with support volume to spot the next operational win.</p></div></div></Panel></div></>}
    </div>
  </Shell>;
}

function Stats() {
  const { guildParams } = useDashboard();
  const query = useGetMemberActivity(guildParams, { query: { queryKey: getGetMemberActivityQueryKey(guildParams), refetchInterval: 60_000 } });
  const stats = query.data;
  const leaderboard = stats?.leaderboard ?? [];
  const topMessages = leaderboard[0];
  const topVoice = [...leaderboard].sort((first, second) => second.voiceTimeSeconds - first.voiceTimeSeconds)[0];

  return <Shell><PageHeader eyebrow="Community / Member intelligence" title={<>Member<br /><span className="text-primary">stats.</span></>} detail="See who keeps the server moving, how much they contribute, and where the community spends its time." action={<div className="flex items-center gap-2 rounded-sm border border-border bg-card px-3 py-2.5"><Users className="size-4 text-chart-3" /><span className="mono-font text-[10px] uppercase tracking-[.15em] text-muted-foreground">Live member pulse</span></div>} />
    <div className="space-y-5">
      {query.isLoading ? <QueryLoading rows={6} /> : query.isError ? <QueryError onRetry={() => query.refetch()} label="Member statistics could not be loaded." /> : !stats ? <EmptyState icon={Users} title="No member data yet" detail="Member activity will appear after the bot starts recording message and voice events." /> : <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total members" value={stats.totalMembers.toLocaleString()} meta="Current guild size" icon={Users} />
          <StatCard label="Online now" value={stats.onlineMembers.toLocaleString()} meta={`${((stats.onlineMembers / Math.max(stats.totalMembers, 1)) * 100).toFixed(1)}% of the guild`} icon={Radio} tone="blue" />
          <StatCard label="In voice" value={stats.membersInVoice.toLocaleString()} meta="Members connected right now" icon={Clock3} tone="orange" />
          <StatCard label="Messages tracked" value={stats.totalMessages.toLocaleString()} meta={`${stats.trackedMembers.toLocaleString()} active members`} icon={MessageSquare} />
        </div>
        <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
          <Panel title="Community leaderboard" eyebrow="Messages + voice presence" action={<span className="mono-font text-[9px] uppercase tracking-[.15em] text-muted-foreground">Top 25 members</span>}>
            {leaderboard.length === 0 ? <EmptyState icon={Users} title="No activity recorded" detail="The bot will populate this leaderboard as members talk and join voice." /> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead><tr className="border-b border-card-border text-[9px] uppercase tracking-[.16em] text-muted-foreground"><th className="px-5 py-3 font-medium">Rank</th><th className="px-5 py-3 font-medium">Member</th><th className="px-5 py-3 text-right font-medium">Messages</th><th className="px-5 py-3 text-right font-medium">Voice time</th><th className="px-5 py-3 text-right font-medium">Presence</th></tr></thead><tbody>{leaderboard.map((member, index) => <MemberStatsRow key={member.userId} member={member} rank={index + 1} />)}</tbody></table></div>}
          </Panel>
          <div className="space-y-5">
            <Panel title="Activity signals" eyebrow="Who is carrying the room">
              <div className="space-y-4 p-5">
                {topMessages && <div className="rounded-sm border border-primary/20 bg-primary/10 p-4"><div className="flex items-center gap-2 text-primary"><MessageSquare className="size-4" /><span className="mono-font text-[9px] uppercase tracking-[.15em]">Most messages</span></div><p className="mt-3 text-base font-extrabold">{topMessages.displayName}</p><p className="mt-1 text-xs text-muted-foreground">{topMessages.messageCount.toLocaleString()} messages recorded</p></div>}
                {topVoice && <div className="rounded-sm border border-chart-3/20 bg-chart-3/10 p-4"><div className="flex items-center gap-2 text-chart-3"><Clock3 className="size-4" /><span className="mono-font text-[9px] uppercase tracking-[.15em]">Most voice time</span></div><p className="mt-3 text-base font-extrabold">{topVoice.displayName}</p><p className="mt-1 text-xs text-muted-foreground">{topVoice.voiceTimeFormatted} spent in voice channels</p></div>}
              </div>
            </Panel>
            <Panel title="How this works" eyebrow="Tracking boundary"><div className="space-y-3 p-5 text-xs leading-5 text-muted-foreground"><p>Only message counts and voice session durations are stored. Message content is never saved for this dashboard.</p><p>Historical tracking begins when the bot-side activity model is installed. Existing Discord history cannot be reconstructed reliably.</p></div></Panel>
          </div>
        </div>
      </>}
    </div>
  </Shell>;
}

function MemberStatsRow({ member, rank }: { member: MemberActivity; rank: number }) {
  return <tr className="border-b border-card-border/60 last:border-0 hover:bg-secondary/35" data-testid={`row-member-${member.userId}`}><td className="px-5 py-4"><span className={`display-font text-xl font-bold ${rank === 1 ? 'text-primary' : 'text-muted-foreground'}`}>{String(rank).padStart(2, '0')}</span></td><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-full border border-border bg-secondary text-xs font-extrabold text-primary">{initials(member.displayName)}</div><div><p className="text-xs font-bold">{member.displayName}</p><p className="mono-font mt-1 text-[9px] text-muted-foreground">{member.userTag}</p></div></div></td><td className="px-5 py-4 text-right"><p className="mono-font text-xs font-medium">{member.messageCount.toLocaleString()}</p><p className="mt-1 text-[10px] text-muted-foreground">messages</p></td><td className="px-5 py-4 text-right"><p className="mono-font text-xs font-medium">{member.voiceTimeFormatted}</p><p className="mt-1 text-[10px] text-muted-foreground">{Math.round(member.voiceTimeSeconds / 60).toLocaleString()} minutes</p></td><td className="px-5 py-4 text-right"><span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold ${member.inVoice ? 'text-chart-3' : member.isOnline ? 'text-primary' : 'text-muted-foreground'}`}><span className={`size-1.5 rounded-full ${member.inVoice ? 'bg-chart-3' : member.isOnline ? 'bg-primary' : 'bg-muted-foreground'}`} />{member.inVoice ? 'In voice' : member.isOnline ? 'Online' : 'Offline'}</span></td></tr>;
}

function MetricBar({ metric, maxUses }: { metric: CommandMetric; maxUses: number }) {
  const positive = metric.trend >= 0;
  return <div data-testid={`row-command-${metric.command.replace('/', '')}`}><div className="mb-2 flex items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="flex size-8 items-center justify-center rounded-sm bg-secondary text-primary"><Command className="size-4" /></span><div><p className="mono-font text-xs font-medium">{metric.command}</p><p className="mt-1 text-[10px] text-muted-foreground">{metric.successRate}% success</p></div></div><div className="text-right"><p className="mono-font text-xs">{metric.uses.toLocaleString()}</p><p className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${positive ? 'text-primary' : 'text-destructive'}`}>{positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{Math.abs(metric.trend)}%</p></div></div><div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${Math.max(3, (metric.uses / maxUses) * 100)}%` }} /></div></div>;
}

function StaffActivityRow({ event }: { event: StaffActivityEvent }) {
  const icon = event.category === 'moderation' ? ShieldAlert : event.category === 'tickets' ? TicketIcon : event.category === 'settings' ? Settings2 : Bot;
  const Icon = icon;
  const tone = event.category === 'moderation' ? 'text-destructive bg-destructive/10' : event.category === 'tickets' ? 'text-accent bg-accent/10' : event.category === 'settings' ? 'text-chart-3 bg-chart-3/10' : 'text-primary bg-primary/10';
  return <div className="flex gap-3 border-b border-card-border/70 px-5 py-4 last:border-0" data-testid={`row-staff-activity-${event.id}`}><div className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-sm ${tone}`}><Icon className="size-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold">{event.title}</p><p className="mono-font mt-1 text-[9px] uppercase tracking-[.12em] text-muted-foreground">{event.category} · {event.action}</p></div><span className="mono-font shrink-0 text-[9px] text-muted-foreground">{fullDate(event.occurredAt)}</span></div><p className="mt-2 text-[11px] text-muted-foreground">{event.detail}</p><p className="mt-2 text-[10px] text-muted-foreground/65">by <span className="font-semibold text-foreground/75">{event.actor.username}</span></p></div></div>;
}

function StaffActivity() {
  const { guildParams } = useDashboard();
  const [category, setCategory] = useState<'all' | StaffActivityCategory>('all');
  const [staffId, setStaffId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const params = useMemo(() => ({ ...guildParams, category, ...(staffId ? { staffId } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), limit: 100 }), [guildParams, category, staffId, from, to]);
  const query = useListStaffActivity(params, { query: { queryKey: getStaffActivityQueryKey(params) } });
  const events = (query.data as StaffActivityEvent[] | undefined) ?? [];
  const staff = Array.from(new Map(events.map((event) => [event.actor.id, event.actor])).values());
  return <Shell><PageHeader eyebrow="Accountability / Audit trail" title={<>Staff<br /><span className="text-primary">activity.</span></>} detail="One complete timeline for every staff action across moderation, tickets, settings, and bot operations." action={<div className="flex items-center gap-2 rounded-sm border border-border bg-card px-3 py-2.5"><ClipboardList className="size-4 text-primary" /><span className="mono-font text-[10px] uppercase tracking-[.15em] text-muted-foreground">Audit history</span></div>} />
    <div className="space-y-5">
      <div className="grid gap-3 rounded-sm border border-card-border bg-card p-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]">
        <label className="space-y-2"><span className="mono-font block text-[9px] uppercase tracking-[.16em] text-muted-foreground">Activity type</span><select data-testid="select-staff-activity-category" value={category} onChange={(event) => setCategory(event.target.value as 'all' | StaffActivityCategory)} className="h-10 w-full rounded-sm border border-input bg-background px-3 text-xs font-semibold capitalize outline-none focus:border-primary"><option value="all">All activity</option><option value="moderation">Moderation</option><option value="tickets">Tickets</option><option value="settings">Settings</option><option value="bot">Bot actions</option></select></label>
        <label className="space-y-2"><span className="mono-font block text-[9px] uppercase tracking-[.16em] text-muted-foreground">Staff member</span><select data-testid="select-staff-activity-member" value={staffId} onChange={(event) => setStaffId(event.target.value)} className="h-10 w-full rounded-sm border border-input bg-background px-3 text-xs font-semibold outline-none focus:border-primary"><option value="">Everyone</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.username}</option>)}</select></label>
        <label className="space-y-2"><span className="mono-font flex items-center gap-1 text-[9px] uppercase tracking-[.16em] text-muted-foreground"><CalendarDays className="size-3" /> From</span><input data-testid="input-staff-activity-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-10 w-full rounded-sm border border-input bg-background px-3 text-xs outline-none focus:border-primary" /></label>
        <label className="space-y-2"><span className="mono-font flex items-center gap-1 text-[9px] uppercase tracking-[.16em] text-muted-foreground"><CalendarDays className="size-3" /> To</span><input data-testid="input-staff-activity-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-10 w-full rounded-sm border border-input bg-background px-3 text-xs outline-none focus:border-primary" /></label>
        <button data-testid="button-refresh-staff-activity" onClick={() => query.refetch()} className="mt-auto flex h-10 items-center justify-center gap-2 rounded-sm border border-input px-3 text-xs font-bold text-muted-foreground transition hover:border-primary/50 hover:text-foreground"><RefreshCw className={`size-3.5 ${query.isFetching ? 'animate-spin' : ''}`} /> Refresh</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3"><StatCard label="Events in view" value={events.length} meta="After active filters" icon={ClipboardList} /><StatCard label="Moderation actions" value={events.filter((event) => event.category === 'moderation').length} meta="Warnings, mutes, kicks, bans" icon={ShieldAlert} tone="red" /><StatCard label="Staff members" value={staff.length} meta="Contributors in this view" icon={Users} tone="blue" /></div>
      <Panel title="Complete staff timeline" eyebrow="Newest first" action={<span className="mono-font text-[9px] uppercase tracking-[.15em] text-muted-foreground">Immutable audit feed</span>}>
        {query.isLoading ? <div className="p-5"><QueryLoading rows={7} /></div> : query.isError ? <div className="p-5"><QueryError onRetry={() => query.refetch()} label="Staff activity could not be loaded." /></div> : events.length ? events.map((event) => <StaffActivityRow key={event.id} event={event} />) : <EmptyState icon={ClipboardList} title="No staff activity matches" detail="Try clearing a filter or choose a wider date range." />}
      </Panel>
    </div>
  </Shell>;
}

function BotHealth() {
  const { guildParams } = useDashboard();
  const query = useBotHealth(guildParams, { query: { queryKey: getBotHealthQueryKey(guildParams), refetchInterval: 30000 } });
  const health = query.data as HealthStatus | undefined;
  const statusGood = health?.status === 'ok' || health?.status === 'healthy';
  return <Shell><PageHeader eyebrow="Infrastructure / Discord gateway" title={<>Bot<br /><span className="text-primary">health.</span></>} detail="Monitor gateway readiness, uptime, database connectivity, and the heartbeat behind this server." action={<button onClick={() => query.refetch()} className="flex items-center gap-2 rounded-sm border border-border bg-card px-3 py-2.5 text-xs font-bold text-muted-foreground hover:border-primary/50 hover:text-foreground"><RefreshCw className={`size-3.5 ${query.isFetching ? 'animate-spin' : ''}`} /> Refresh</button>} />
    <div className="space-y-5">
      {query.isLoading ? <QueryLoading rows={5} /> : query.isError ? <QueryError onRetry={() => query.refetch()} label="Bot health could not be loaded." /> : <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Gateway" value={statusGood ? 'Online' : health?.status ?? 'Unknown'} meta={health?.botReady === false ? 'Bot is not ready' : 'Connection responding'} icon={Radio} tone={statusGood ? 'lime' : 'red'} /><StatCard label="Bot uptime" value={formatUptime(health?.uptimeSeconds)} meta="Since last process restart" icon={Clock3} tone="blue" /><StatCard label="API latency" value={health?.latencyMs !== undefined ? `${health.latencyMs}ms` : '—'} meta="Latest health response" icon={Zap} tone="orange" /><StatCard label="Database" value={health?.database ?? 'Unknown'} meta="Persistence connection" icon={Database} tone={health?.database === 'connected' ? 'lime' : 'red'} /></div>
        <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><Panel title="Service readout" eyebrow="Live diagnostics"><div className="space-y-1 p-5"><ReadoutRow label="Bot identity" value={health?.botUser ?? '—'} /><ReadoutRow label="Selected guild" value={health?.guildId ?? guildParams.guildId} /><ReadoutRow label="Gateway status" value={health?.status ?? '—'} tone={statusGood ? 'good' : 'alert'} /><ReadoutRow label="Bot readiness" value={health?.botReady === false ? 'not ready' : 'ready'} tone={health?.botReady === false ? 'alert' : 'good'} /><ReadoutRow label="Last heartbeat" value={fullDate(health?.lastHeartbeatAt)} /></div></Panel><Panel title="Operational guidance" eyebrow="Keep it healthy"><div className="space-y-4 p-5 text-xs leading-5 text-muted-foreground"><p className="flex gap-3"><CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" />The API should report health without requiring a dashboard session so uptime checks can monitor it.</p><p className="flex gap-3"><Database className="mt-0.5 size-4 shrink-0 text-chart-3" />Database status reflects the same connection used for tickets, moderation cases, and the audit timeline.</p><p className="flex gap-3"><Clock3 className="mt-0.5 size-4 shrink-0 text-accent" />Refreshes automatically every 30 seconds while this page is open.</p></div></Panel></div>
      </>}
    </div>
  </Shell>;
}

function StaffAccessLoading() {
  return (
    <div className="access-screen relative isolate grid min-h-[100dvh] place-items-center overflow-hidden bg-background px-5 py-10" role="status" aria-live="polite">
      <div className="access-grid pointer-events-none absolute inset-0 opacity-50" />
      <div className="access-orbit access-orbit-one pointer-events-none absolute -right-24 -top-28 size-80 rounded-full border border-primary/10" />
      <div className="access-orbit access-orbit-two pointer-events-none absolute -bottom-40 -left-32 size-96 rounded-full border border-accent/10" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-sm bg-primary text-lg font-black text-primary-foreground shadow-[0_0_28px_hsl(var(--primary)/.22)]">
              U<span className="text-accent">+</span>
            </span>
            <div>
              <p className="text-base font-extrabold tracking-[-.04em]">UPCORE</p>
              <p className="mono-font mt-0.5 text-[8px] uppercase tracking-[.24em] text-primary">Esports / Ops</p>
            </div>
          </div>
          <span className="mono-font rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-[9px] uppercase tracking-[.16em] text-primary">Secure gateway</span>
        </div>
        <div className="mb-6 flex items-center gap-2">
          <span className="access-pulse size-2 rounded-full bg-primary" />
          <span className="mono-font text-[10px] uppercase tracking-[.2em] text-primary/80">Access check / in progress</span>
        </div>
        <h1 className="display-font text-6xl font-bold uppercase leading-[.84] tracking-[-.025em] sm:text-7xl">
          Checking
          <br />
          <span className="text-primary">staff access.</span>
        </h1>
        <p className="mt-6 max-w-sm text-sm leading-6 text-muted-foreground">
          Verifying your Discord session and available server permissions.
        </p>
        <div className="mt-8 rounded-sm border border-card-border bg-card/75 p-4 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-sm bg-secondary text-primary">
                <ShieldAlert className="size-4" />
              </span>
              <div>
                <p className="text-xs font-bold text-foreground">Authenticating workspace</p>
                <p className="mt-1 text-[11px] text-muted-foreground">This usually takes a moment.</p>
              </div>
            </div>
            <RefreshCw className="access-spin size-4 shrink-0 text-primary" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-1.5" aria-hidden="true">
            <span className="access-bar h-1 rounded-full bg-primary" />
            <span className="access-bar access-bar-two h-1 rounded-full bg-primary/70" />
            <span className="access-bar access-bar-three h-1 rounded-full bg-primary/40" />
          </div>
        </div>
        <p className="mono-font mt-5 text-center text-[9px] uppercase tracking-[.16em] text-muted-foreground/60">Private staff dashboard · UPCore Esports</p>
      </div>
    </div>
  );
}

function LoginScreen({ onRetry, setupError }: { onRetry?: () => void; setupError?: Error }) {
  const [oauthError] = useState(() => typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('error') : null);
  const login = () => { window.location.href = getDiscordLoginUrl(); };
  const authRouteUnavailable = setupError instanceof ApiError && setupError.status === 404;
  const authRequestTimedOut = setupError instanceof ApiError && setupError.status === 408;
  return (
    <div className="access-screen relative isolate grid min-h-[100dvh] place-items-center overflow-hidden bg-background px-5 py-10">
      <div className="access-grid pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative w-full max-w-lg">
        <div className="mb-7 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-sm bg-primary text-lg font-black text-primary-foreground shadow-[0_0_28px_hsl(var(--primary)/.22)]">U<span className="text-accent">+</span></span>
            <div><p className="text-base font-extrabold tracking-[-.04em]">UPCORE</p><p className="mono-font mt-0.5 text-[8px] uppercase tracking-[.24em] text-primary">Esports / Ops</p></div>
          </div>
          <span className={`mono-font rounded-full border px-3 py-1.5 text-[9px] uppercase tracking-[.16em] ${setupError ? 'border-accent/25 bg-accent/5 text-accent' : 'border-primary/20 bg-primary/5 text-primary'}`}>{setupError ? 'Gateway paused' : 'Staff only'}</span>
        </div>
        <div className="rounded-sm border border-card-border bg-card/85 p-6 shadow-2xl backdrop-blur-xl md:p-9">
          <p className="mono-font text-[10px] uppercase tracking-[.22em] text-primary">Staff access / Secure gateway</p>
          <h1 className="display-font mt-4 text-6xl font-bold uppercase leading-[.84] tracking-[-.02em]">Control<br /><span className="text-primary">starts here.</span></h1>
          <p className="mt-6 text-sm leading-6 text-muted-foreground">Sign in with Discord to see every server where you have staff access. Your selected server scopes tickets, moderation, settings, and audit history.</p>
          {oauthError && <div className="mt-6 flex gap-3 rounded-sm border border-destructive/25 bg-destructive/10 p-4 text-xs leading-5 text-destructive-foreground"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><span>Discord sign-in was not completed. Nothing changed on your account—please try again.</span></div>}
          {setupError && <div className="mt-6 rounded-sm border border-accent/25 bg-accent/10 p-4">
            <div className="flex gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-accent/15 text-accent"><Server className="size-4" /></span>
              <div>
                <p className="text-sm font-bold text-accent">{authRouteUnavailable ? 'Access service is not connected yet.' : authRequestTimedOut ? 'Access service timed out.' : 'Couldn’t verify staff access.'}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{authRouteUnavailable ? 'The dashboard is online, but the Render API has not exposed its Discord session routes. Sign-in will be available once the API is redeployed with them.' : authRequestTimedOut ? 'The dashboard could not reach the API in time. Check the API deployment and try again.' : 'The access service returned an unexpected response. Please try again in a moment.'}</p>
              </div>
            </div>
            {setupError?.message && <p className="mt-3 rounded-sm bg-background/60 px-3 py-2 font-mono text-[10px] leading-5 text-muted-foreground">Diagnostic: {setupError.message}</p>}
            {onRetry && <button type="button" onClick={onRetry} className="mt-4 inline-flex items-center gap-2 rounded-sm border border-accent/30 px-3 py-2 text-xs font-bold text-foreground transition hover:border-accent hover:bg-accent/10"><RefreshCw className="size-3.5" /> Check connection again</button>}
          </div>}
          {!setupError && <button data-testid="button-discord-login" type="button" onClick={login} className="mt-7 flex h-12 w-full items-center justify-center gap-3 rounded-sm bg-[#5865F2] text-sm font-extrabold text-white shadow-[0_10px_30px_rgba(88,101,242,.22)] transition hover:brightness-110"><LogIn className="size-4" /> Continue with Discord</button>}
          <div className="mt-7 flex items-start gap-3 border-t border-card-border pt-5 text-[11px] leading-5 text-muted-foreground"><ShieldAlert className="mt-0.5 size-4 shrink-0 text-primary" /><span>Only Discord servers where you have Manage Guild or Administrator access are shown. The bot must also be present to load server data.</span></div>
        </div>
        <p className="mono-font mt-5 text-center text-[9px] uppercase tracking-[.16em] text-muted-foreground/60">Private staff dashboard · UPCore Esports</p>
      </div>
    </div>
  );
}

function AccessDenied({ session }: { session: AuthSession }) {
  return <div className="grid min-h-[100dvh] place-items-center bg-background p-5"><div className="w-full max-w-lg rounded-sm border border-card-border bg-card p-8 text-center"><Server className="mx-auto size-8 text-accent" /><h1 className="display-font mt-5 text-4xl font-bold uppercase">No managed servers.</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Discord signed you in as {session.user.globalName ?? session.user.username}, but no server matched the staff access rules or has the bot installed.</p><button onClick={() => { window.location.href = getDiscordLogoutUrl(); }} className="mt-6 rounded-sm border border-border px-4 py-3 text-xs font-bold text-muted-foreground hover:border-primary/50 hover:text-foreground"><LogOut className="mr-2 inline size-3.5" /> Sign out</button></div></div>;
}

function Router() {
  return <RoutedErrorBoundary><Switch><Route path="/" component={Home} /><Route path="/tickets" component={TicketDesk} /><Route path="/moderation" component={Moderation} /><Route path="/staff-activity" component={StaffActivity} /><Route path="/bot-health" component={BotHealth} /><Route path="/settings" component={Settings} /><Route path="/analytics" component={Analytics} /><Route path="/stats" component={Stats} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function DashboardRoot() {
  const authQuery = useAuthSession();
  const [selectedGuildId, setSelectedGuildId] = useState(() => typeof window === 'undefined' ? '' : window.localStorage.getItem('upcore-selected-guild') ?? '');
  useEffect(() => {
    const guilds = authQuery.data?.guilds ?? [];
    if (guilds.length && !guilds.some((guild) => guild.id === selectedGuildId)) {
      setSelectedGuildId(guilds[0].id);
      window.localStorage.setItem('upcore-selected-guild', guilds[0].id);
    }
  }, [authQuery.data, selectedGuildId]);
  if (authQuery.isLoading) return <StaffAccessLoading />;
  if (authQuery.isError) return <LoginScreen onRetry={() => authQuery.refetch()} setupError={authQuery.error} />;
  if (!authQuery.data) return <LoginScreen />;
  if (!authQuery.data.guilds.length) return <AccessDenied session={authQuery.data} />;
  const selectedGuild = authQuery.data.guilds.find((guild) => guild.id === selectedGuildId) ?? authQuery.data.guilds[0];
  const selectGuild = (guildId: string) => { setSelectedGuildId(guildId); window.localStorage.setItem('upcore-selected-guild', guildId); };
  const signOut = () => { window.location.href = `${getDiscordLogoutUrl()}?returnTo=${encodeURIComponent(window.location.origin)}`; };
  return <DashboardContext.Provider value={{ session: authQuery.data, selectedGuild, selectGuild, signOut, guildParams: { guildId: selectedGuild.id } }}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter></DashboardContext.Provider>;
}

function App() {
  return <QueryClientProvider client={queryClient}><DashboardRoot /></QueryClientProvider>;
}

export default App;
