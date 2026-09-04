import {
  useMutation,
  useQuery,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

export type TicketStatus = 'open' | 'pending' | 'escalated' | 'closed';
export type ModerationCaseInputAction = 'warn' | 'mute' | 'kick' | 'ban' | 'unban' | 'note';

export type HealthStatus = {
  status: string;
  botReady?: boolean;
  botUser?: string;
  guildId?: string;
  uptimeSeconds?: number;
  database?: string;
  latencyMs?: number;
  lastHeartbeatAt?: string;
};
export type AuthUser = {
  id: string;
  username: string;
  globalName?: string | null;
  avatarUrl?: string | null;
};
export type ManagedGuild = {
  id: string;
  name: string;
  iconUrl?: string | null;
  permissions?: string;
  isBotPresent?: boolean;
};
export type AuthSession = {
  user: AuthUser;
  guilds: ManagedGuild[];
};
export type StaffActivityCategory = 'moderation' | 'tickets' | 'settings' | 'bot';
export type StaffActivityEvent = {
  id: string;
  category: StaffActivityCategory;
  action: string;
  title: string;
  detail: string;
  actor: AuthUser | { id: string; username: string };
  occurredAt: string;
  guildId?: string;
  metadata?: Record<string, unknown>;
};
export type DashboardSummary = {
  guildName: string;
  memberCount: number;
  onlineMembers: number;
  openTickets: number;
  unresolvedCases: number;
  uptime: string;
  commandSuccessRate: number;
  deltaLabel?: string;
};
export type ActivityEvent = {
  id: string;
  type: 'ticket' | 'moderation' | 'member' | 'bot' | 'settings';
  title: string;
  detail: string;
  actor: string;
  occurredAt: string;
  severity?: 'neutral' | 'positive' | 'warning' | 'critical';
};
export type Ticket = {
  id: string;
  ticketId: string;
  category: string;
  subject: string;
  requester: string;
  requesterTag?: string;
  assignee?: string | null;
  status: TicketStatus;
  openedAt: string;
  lastActivity: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  messageCount?: number;
};
export type ModerationCase = {
  id: string;
  caseNumber: number;
  action: ModerationCaseInputAction;
  user: string;
  userTag?: string;
  moderator: string;
  reason: string;
  createdAt: string;
  status: 'active' | 'expired' | 'dismissed';
};
export type ModerationCaseInput = {
  action: ModerationCaseInputAction;
  user: string;
  reason: string;
};
export type GuildSettings = {
  guildName: string;
  automodEnabled: boolean;
  welcomeEnabled: boolean;
  translationEnabled: boolean;
  ticketCategories: number;
  logChannel: string;
};
export type CommandMetric = {
  command: string;
  uses: number;
  successRate: number;
  trend: number;
};
export type MemberActivity = {
  userId: string;
  userTag: string;
  displayName: string;
  avatarUrl?: string;
  messageCount: number;
  voiceTimeSeconds: number;
  voiceTimeFormatted: string;
  isOnline: boolean;
  inVoice: boolean;
  lastSeenAt?: string;
};
export type MemberActivityResponse = {
  totalMembers: number;
  onlineMembers: number;
  membersInVoice: number;
  totalMessages: number;
  trackedMembers: number;
  leaderboard: MemberActivity[];
};

type DemoState = {
  summary: DashboardSummary;
  activity: ActivityEvent[];
  staffActivity: StaffActivityEvent[];
  tickets: Ticket[];
  cases: ModerationCase[];
  settings: GuildSettings;
  analytics: CommandMetric[];
  memberActivity: MemberActivityResponse;
};

const demoState: DemoState = {
  summary: {
    guildName: 'UPCore Esports HQ',
    memberCount: 12847,
    onlineMembers: 3812,
    openTickets: 18,
    unresolvedCases: 7,
    uptime: '14d 06h 22m',
    commandSuccessRate: 96.7,
    deltaLabel: '+12.4% this month',
  },
  activity: [
    { id: 'activity-1', type: 'ticket', title: 'Ticket #1048 opened', detail: 'Club Wars SESA registration question', actor: 'Aarav Sharma', occurredAt: '2026-09-02T08:42:00.000Z', severity: 'neutral' },
    { id: 'activity-2', type: 'moderation', title: 'Member timed out', detail: 'Rohan Das · 10 minutes', actor: 'Riya Mehta', occurredAt: '2026-09-02T08:06:00.000Z', severity: 'warning' },
    { id: 'activity-3', type: 'member', title: 'New member joined', detail: 'Welcome to UPCore Esports HQ', actor: 'Ishita Nair', occurredAt: '2026-09-02T07:54:00.000Z', severity: 'positive' },
    { id: 'activity-4', type: 'bot', title: 'Daily backup completed', detail: 'All systems operational', actor: 'UPCore Bot', occurredAt: '2026-09-02T06:00:00.000Z', severity: 'positive' },
    { id: 'activity-5', type: 'settings', title: 'Automod rule updated', detail: 'Added 3 blocked phrases', actor: 'Arjun Verma', occurredAt: '2026-09-01T21:13:00.000Z', severity: 'neutral' },
  ],
  staffActivity: [
    { id: 'staff-1', category: 'moderation', action: 'mute', title: 'Member muted', detail: 'Rohan Das · 10 minutes', actor: { id: 'staff-riya', username: 'Riya Mehta' }, occurredAt: '2026-09-02T08:06:00.000Z' },
    { id: 'staff-2', category: 'tickets', action: 'claim', title: 'Ticket claimed', detail: 'Ticket #1048 · Club Wars SESA registration question', actor: { id: 'staff-riya', username: 'Riya Mehta' }, occurredAt: '2026-09-02T07:58:00.000Z' },
    { id: 'staff-3', category: 'settings', action: 'update', title: 'Guild settings changed', detail: 'Translation assist enabled', actor: { id: 'staff-arjun', username: 'Arjun Verma' }, occurredAt: '2026-09-01T21:13:00.000Z' },
    { id: 'staff-4', category: 'tickets', action: 'escalate', title: 'Ticket escalated', detail: 'Ticket #1046 · Partnership deck follow-up', actor: { id: 'staff-ananya', username: 'Ananya Rao' }, occurredAt: '2026-09-01T20:42:00.000Z' },
    { id: 'staff-5', category: 'moderation', action: 'note', title: 'Case note added', detail: 'Approved for Club Wars SESA private qualifier', actor: { id: 'staff-ananya', username: 'Ananya Rao' }, occurredAt: '2026-09-01T18:20:00.000Z' },
    { id: 'staff-6', category: 'bot', action: 'backup', title: 'Daily backup completed', detail: 'All systems operational', actor: { id: 'bot', username: 'UPCore Bot' }, occurredAt: '2026-09-01T06:00:00.000Z' },
    { id: 'staff-7', category: 'tickets', action: 'close', title: 'Ticket closed', detail: 'Ticket #1044 · Feedback on the new support panel', actor: { id: 'staff-arjun', username: 'Arjun Verma' }, occurredAt: '2026-09-01T05:18:00.000Z' },
  ],
  tickets: [
    { id: 'ticket-1048', ticketId: '#1048', category: 'tournament', subject: 'Club Wars SESA registration question', requester: 'Aarav Sharma', requesterTag: 'aarav.s', assignee: 'Riya Mehta', status: 'open', openedAt: '2026-09-02T08:42:00.000Z', lastActivity: '2026-09-02T09:18:00.000Z', priority: 'high', messageCount: 12 },
    { id: 'ticket-1047', ticketId: '#1047', category: 'club-join', subject: 'Request to join the competitive roster', requester: 'Kunal Singh', requesterTag: 'kunal_07', assignee: 'Ananya Rao', status: 'pending', openedAt: '2026-09-02T07:31:00.000Z', lastActivity: '2026-09-02T08:55:00.000Z', priority: 'normal', messageCount: 8 },
    { id: 'ticket-1046', ticketId: '#1046', category: 'business', subject: 'Partnership deck follow-up', requester: 'Nisha Kapoor', requesterTag: 'nisha.k', assignee: null, status: 'escalated', openedAt: '2026-09-01T20:14:00.000Z', lastActivity: '2026-09-02T07:42:00.000Z', priority: 'urgent', messageCount: 24 },
    { id: 'ticket-1045', ticketId: '#1045', category: 'general', subject: 'Unable to see tournament channels', requester: 'Dev Patel', requesterTag: 'devp', assignee: 'Riya Mehta', status: 'open', openedAt: '2026-09-01T17:06:00.000Z', lastActivity: '2026-09-01T18:29:00.000Z', priority: 'normal', messageCount: 5 },
    { id: 'ticket-1044', ticketId: '#1044', category: 'others', subject: 'Feedback on the new support panel', requester: 'Maya Iyer', requesterTag: 'maya.iyer', assignee: 'Arjun Verma', status: 'closed', openedAt: '2026-09-01T14:27:00.000Z', lastActivity: '2026-09-01T15:18:00.000Z', priority: 'low', messageCount: 6 },
  ],
  cases: [
    { id: 'case-218', caseNumber: 218, action: 'mute', user: 'Rohan Das', userTag: 'rohan.d', moderator: 'Riya Mehta', reason: 'Repeated spam in tournament chat', createdAt: '2026-09-02T08:06:00.000Z', status: 'active' },
    { id: 'case-217', caseNumber: 217, action: 'warn', user: 'Vikram Joshi', userTag: 'vickyj', moderator: 'Arjun Verma', reason: 'Posting referral links outside partners channel', createdAt: '2026-09-01T22:34:00.000Z', status: 'active' },
    { id: 'case-216', caseNumber: 216, action: 'note', user: 'Ankit Verma', userTag: 'ankit.v', moderator: 'Ananya Rao', reason: 'Approved for Club Wars SESA private qualifier', createdAt: '2026-09-01T18:20:00.000Z', status: 'active' },
    { id: 'case-215', caseNumber: 215, action: 'kick', user: 'Sahil Khan', userTag: 'sahil_k', moderator: 'Riya Mehta', reason: 'Evading a previous timeout', createdAt: '2026-09-01T12:48:00.000Z', status: 'expired' },
  ],
  settings: { guildName: 'UPCore Esports HQ', automodEnabled: true, welcomeEnabled: true, translationEnabled: true, ticketCategories: 5, logChannel: '#mod-logs' },
  analytics: [
    { command: '/ticket', uses: 1284, successRate: 99.2, trend: 18.6 },
    { command: '/warn', uses: 346, successRate: 98.1, trend: 6.8 },
    { command: '/panel', uses: 214, successRate: 100, trend: 12.1 },
    { command: '/stats', uses: 189, successRate: 97.4, trend: -2.4 },
    { command: '/translate', uses: 162, successRate: 95.8, trend: 9.7 },
  ],
  memberActivity: {
    totalMembers: 12847,
    onlineMembers: 3812,
    membersInVoice: 46,
    totalMessages: 18492,
    trackedMembers: 614,
    leaderboard: [
      { userId: 'member-1', userTag: 'aarav.s', displayName: 'Aarav Sharma', messageCount: 842, voiceTimeSeconds: 18340, voiceTimeFormatted: '5h 05m', isOnline: true, inVoice: true, lastSeenAt: '2026-09-02T09:18:00.000Z' },
      { userId: 'member-2', userTag: 'riya.mehta', displayName: 'Riya Mehta', messageCount: 716, voiceTimeSeconds: 24120, voiceTimeFormatted: '6h 42m', isOnline: true, inVoice: false, lastSeenAt: '2026-09-02T09:12:00.000Z' },
      { userId: 'member-3', userTag: 'kunal_07', displayName: 'Kunal Singh', messageCount: 634, voiceTimeSeconds: 12960, voiceTimeFormatted: '3h 36m', isOnline: true, inVoice: true, lastSeenAt: '2026-09-02T09:03:00.000Z' },
      { userId: 'member-4', userTag: 'maya.iyer', displayName: 'Maya Iyer', messageCount: 588, voiceTimeSeconds: 10800, voiceTimeFormatted: '3h 00m', isOnline: false, inVoice: false, lastSeenAt: '2026-09-01T22:44:00.000Z' },
      { userId: 'member-5', userTag: 'devp', displayName: 'Dev Patel', messageCount: 491, voiceTimeSeconds: 9360, voiceTimeFormatted: '2h 36m', isOnline: true, inVoice: false, lastSeenAt: '2026-09-02T08:56:00.000Z' },
      { userId: 'member-6', userTag: 'ishita.nair', displayName: 'Ishita Nair', messageCount: 432, voiceTimeSeconds: 7920, voiceTimeFormatted: '2h 12m', isOnline: true, inVoice: true, lastSeenAt: '2026-09-02T08:41:00.000Z' },
    ],
  },
};

const storageKey = 'upcore-dashboard-demo-state';
export const isDemoMode = import.meta.env.VITE_DEMO_MODE !== 'false';
const configuredApiBase = String(import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
const isCloudflarePages = typeof window !== 'undefined' && window.location.hostname.endsWith('.pages.dev');
// Pages Functions proxy /api requests server-side, so the browser does not need
// CORS permission from the bot API. This also works when an old Pages build
// still has VITE_API_BASE_URL set to the Render URL.
const apiBase = isCloudflarePages ? '/api' : configuredApiBase;
const requestTimeoutMs = 15000;

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

function cloneState(): DemoState {
  if (typeof window !== 'undefined') {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved) as DemoState;
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }
  }
  return JSON.parse(JSON.stringify(demoState)) as DemoState;
}

function saveState(state: DemoState) {
  if (typeof window !== 'undefined') window.localStorage.setItem(storageKey, JSON.stringify(state));
}

async function request<T>(path: string, demo: () => T, init?: RequestInit): Promise<T> {
  if (isDemoMode) {
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    return demo();
  }
  const headers = new Headers(init?.headers);
  // Adding content-type to a GET makes the browser send a CORS preflight.
  // Only mutating requests with a JSON body need this header.
  if (init?.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (!headers.has('accept')) headers.set('accept', 'application/json');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(`${apiBase}${path}`, {
      credentials: 'include',
      cache: 'no-store',
      ...init,
      headers,
      signal: init?.signal ?? controller.signal,
    });
    if (!response.ok) throw new ApiError(`API request failed with status ${response.status}`, response.status);
    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError' && !init?.signal?.aborted) {
      throw new ApiError(`The API did not respond within ${requestTimeoutMs / 1000} seconds`, 408);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function withQuery(path: string, params?: Record<string, string | number | undefined>) {
  if (!params) return path;
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const suffix = query.toString();
  return suffix ? `${path}${path.includes('?') ? '&' : '?'}${suffix}` : path;
}

export function getDiscordLoginUrl() {
  const returnTo = typeof window === 'undefined' ? '/' : `${window.location.origin}${window.location.pathname}`;
  return `${apiBase}/auth/discord?returnTo=${encodeURIComponent(returnTo)}`;
}

export function getDiscordLogoutUrl() {
  return `${apiBase}/auth/logout`;
}

type HookOptions = { query?: { queryKey?: readonly unknown[]; refetchInterval?: number } };
const queryOptions = <T,>(options: HookOptions | undefined, fallbackKey: readonly unknown[]) => ({
  queryKey: options?.query?.queryKey ?? fallbackKey,
  refetchInterval: options?.query?.refetchInterval,
});

export const getHealthCheckQueryKey = () => ['healthz'];
export const getGetDashboardSummaryQueryKey = (params?: unknown) => ['dashboard-summary', params];
export const getGetDashboardActivityQueryKey = (params?: unknown) => ['dashboard-activity', params];
export const getListTicketsQueryKey = (params?: unknown) => ['tickets', params];
export const getListModerationCasesQueryKey = (params?: unknown) => ['moderation-cases', params];
export const getGetGuildSettingsQueryKey = (params?: unknown) => ['guild-settings', params];
export const getGetCommandAnalyticsQueryKey = (params?: unknown) => ['command-analytics', params];
export const getGetMemberActivityQueryKey = (params?: unknown) => ['member-activity', params];
export const getAuthSessionQueryKey = () => ['auth-session'];
export const getStaffActivityQueryKey = (params?: unknown) => ['staff-activity', params];
export const getBotHealthQueryKey = (params?: unknown) => ['bot-health', params];

export function useHealthCheck(options?: HookOptions): UseQueryResult<HealthStatus, Error> {
  return useQuery({ ...queryOptions(options, getHealthCheckQueryKey()), queryFn: () => request('/healthz', () => ({ status: 'ok' })) });
}

export function useAuthSession(): UseQueryResult<AuthSession | null, Error> {
  return useQuery({
    queryKey: getAuthSessionQueryKey(),
    retry: false,
    queryFn: async () => {
      try {
        const session = await request<AuthSession>('/auth/me', () => ({
          user: { id: 'demo-staff', username: 'UPCore Staff', globalName: 'UPCore Staff', avatarUrl: null },
          guilds: [{ id: 'demo-guild', name: 'UPCore Esports HQ', iconUrl: null, isBotPresent: true }],
        }));
        if (
          !session ||
          typeof session !== 'object' ||
          !session.user ||
          typeof session.user !== 'object' ||
          !Array.isArray(session.guilds)
        ) {
          throw new ApiError('The API returned an invalid authentication response', 502);
        }
        return session;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
  });
}

export function useGetDashboardSummary(_params?: unknown, options?: HookOptions): UseQueryResult<DashboardSummary, Error> {
  const params = _params as { guildId?: string } | undefined;
  return useQuery({ ...queryOptions(options, getGetDashboardSummaryQueryKey(_params)), queryFn: () => request(withQuery('/dashboard/summary', params), () => cloneState().summary) });
}

export function useGetDashboardActivity(params?: { guildId?: string; limit?: number }, options?: HookOptions): UseQueryResult<ActivityEvent[], Error> {
  return useQuery({ ...queryOptions(options, getGetDashboardActivityQueryKey(params)), queryFn: () => request(withQuery('/dashboard/activity', params), () => cloneState().activity.slice(0, params?.limit ?? 8)) });
}

export function useListTickets(params?: { guildId?: string; status?: TicketStatus; search?: string }, options?: HookOptions): UseQueryResult<Ticket[], Error> {
  return useQuery({
    ...queryOptions(options, getListTicketsQueryKey(params)),
    queryFn: () => request(withQuery('/tickets', params), () => {
      const state = cloneState();
      const needle = params?.search?.toLowerCase();
      return state.tickets.filter((ticket) => (!params?.status || ticket.status === params.status) && (!needle || [ticket.ticketId, ticket.subject, ticket.requester, ticket.requesterTag].some((value) => String(value ?? '').toLowerCase().includes(needle))));
    }),
  });
}

export function useUpdateTicket(): UseMutationResult<Ticket, Error, { ticketId: string; guildId?: string; data: { status?: TicketStatus; assignee?: string | null } }> {
  return useMutation({
    mutationFn: ({ ticketId, guildId, data }) => request(withQuery(`/tickets/${ticketId}`, { guildId }), () => {
      const state = cloneState();
      const ticket = state.tickets.find((item) => item.id === ticketId || item.ticketId === ticketId);
      if (!ticket) throw new Error('Ticket not found');
      Object.assign(ticket, data);
      state.summary.openTickets = state.tickets.filter((item) => item.status !== 'closed').length + 13;
      saveState(state);
      return ticket;
    }, { method: 'PATCH', body: JSON.stringify(data) }),
  });
}

export function useListModerationCases(params?: { guildId?: string; limit?: number }, options?: HookOptions): UseQueryResult<ModerationCase[], Error> {
  return useQuery({ ...queryOptions(options, getListModerationCasesQueryKey(params)), queryFn: () => request(withQuery('/moderation/cases', params), () => cloneState().cases.slice(0, params?.limit ?? 10)) });
}

export function useCreateModerationCase(guildId?: string): UseMutationResult<ModerationCase, Error, { data: ModerationCaseInput }> {
  return useMutation({
    mutationFn: ({ data }) => request(withQuery('/moderation/cases', { guildId }), () => {
      const state = cloneState();
      const caseNumber = Math.max(...state.cases.map((item) => item.caseNumber), 0) + 1;
      const created: ModerationCase = { id: `case-${caseNumber}`, caseNumber, ...data, userTag: data.user, moderator: 'Dashboard operator', createdAt: new Date().toISOString(), status: 'active' };
      state.cases.unshift(created);
      state.summary.unresolvedCases += 1;
      saveState(state);
      return created;
    }, { method: 'POST', body: JSON.stringify(data) }),
  });
}

export function useGetGuildSettings(_params?: unknown, options?: HookOptions): UseQueryResult<GuildSettings, Error> {
  const params = _params as { guildId?: string } | undefined;
  return useQuery({ ...queryOptions(options, getGetGuildSettingsQueryKey(_params)), queryFn: () => request(withQuery('/guild/settings', params), () => cloneState().settings) });
}

export function useUpdateGuildSettings(guildId?: string): UseMutationResult<GuildSettings, Error, { data: Partial<GuildSettings> }> {
  return useMutation({
    mutationFn: ({ data }) => request(withQuery('/guild/settings', { guildId }), () => {
      const state = cloneState();
      state.settings = { ...state.settings, ...data };
      saveState(state);
      return state.settings;
    }, { method: 'PATCH', body: JSON.stringify(data) }),
  });
}

export function useGetCommandAnalytics(_params?: unknown, options?: HookOptions): UseQueryResult<CommandMetric[], Error> {
  const params = _params as { guildId?: string } | undefined;
  return useQuery({ ...queryOptions(options, getGetCommandAnalyticsQueryKey(_params)), queryFn: () => request(withQuery('/analytics/commands', params), () => cloneState().analytics) });
}

export function useGetMemberActivity(_params?: unknown, options?: HookOptions): UseQueryResult<MemberActivityResponse, Error> {
  const params = _params as { guildId?: string } | undefined;
  return useQuery({ ...queryOptions(options, getGetMemberActivityQueryKey(_params)), queryFn: () => request(withQuery('/members/activity', params), () => cloneState().memberActivity) });
}

export function useListStaffActivity(params?: { guildId?: string; category?: 'all' | StaffActivityCategory; staffId?: string; from?: string; to?: string; limit?: number }, options?: HookOptions): UseQueryResult<StaffActivityEvent[], Error> {
  return useQuery({
    ...queryOptions(options, getStaffActivityQueryKey(params)),
    queryFn: () => request(withQuery('/staff-activity', params), () => {
      const state = cloneState();
      return state.staffActivity
        .filter((event) => !params?.category || params.category === 'all' || event.category === params.category)
        .filter((event) => !params?.staffId || event.actor.id === params.staffId)
        .filter((event) => !params?.from || event.occurredAt >= `${params.from}T00:00:00.000Z`)
        .filter((event) => !params?.to || event.occurredAt <= `${params.to}T23:59:59.999Z`)
        .slice(0, params?.limit ?? 50);
    }),
  });
}

export function useBotHealth(_params?: unknown, options?: HookOptions): UseQueryResult<HealthStatus, Error> {
  const params = _params as { guildId?: string } | undefined;
  return useQuery({
    ...queryOptions(options, getBotHealthQueryKey(_params)),
    queryFn: () => request(withQuery('/healthz', params), () => ({ status: 'ok', botReady: true, botUser: 'UPCore Bot', uptimeSeconds: 14 * 86400 + 6 * 3600 + 22 * 60, database: 'connected' })),
  });
}
