import { useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { sampleDemands } from './data/sampleDemands';
import { hydrateDemandsFromApi, loadDemands, saveDemands } from './utils/storage';

const pages = {
  dashboard: 'dashboard',
  metrics: 'metrics',
  managerCallMetrics: 'manager-call-metrics',
  allOpen: 'all-open-demands',
  allDestaff: 'all-destaff',
  destaff: 'destaff',
  adminUsers: 'admin-users',
  addDemand: 'add-demand'
};

const DRAFT_KEY = 'demand-site:intake-draft-v1';
const AUTH_KEY = 'demand-site:auth-session-v1';
const USERS_KEY = 'demand-site:users-v1';
const SUBSCRIPTIONS_KEY = 'demand-site:demand-subscriptions-v1';
const DEV_CHANDLER_SEED_KEY = 'demand-site:dev-chandler-seed-v1';
const HM_GROUPS_KEY = 'demand-site:hiring-manager-groups-v1';
const DESTAFF_KEY = 'demand-site:destaff-v1';
const DEMAND_VIEW_PREFS_KEY = 'demand-site:demand-view-prefs-v1';
const SPREADSHEET_VIEWS_KEY = 'demand-site:spreadsheet-views-v1';
const CHANDLER_EMAIL = 'foster.chandler.m@gmail.com';
const CHANDLER_NAME = 'Chandler Foster';

const defaultUsers = [
  {
    id: 'u-basic',
    password: 'basic123',
    firstName: 'Basic',
    lastName: 'User',
    displayName: 'Basic User',
    role: 'basic',
    email: 'basic@company.com',
    funcOrg: 'ENG_SW'
  },
  {
    id: 'u-hm',
    password: 'manager123',
    firstName: 'Hiring',
    lastName: 'Manager',
    displayName: 'Hiring Manager',
    role: 'hiring-manager',
    email: 'manager@company.com',
    funcOrg: 'ENG_SEIT'
  },
  {
    id: 'u-admin',
    password: 'admin123',
    firstName: 'Admin',
    lastName: 'User',
    displayName: 'Admin User',
    role: 'administrator',
    email: 'admin@company.com',
    funcOrg: 'ENG_SW'
  },
  {
    id: 'u-chandler',
    password: 'chandler123',
    firstName: 'Chandler',
    lastName: 'Foster',
    displayName: 'Chandler Foster',
    role: 'hiring-manager',
    email: 'foster.chandler.m@gmail.com',
    funcOrg: 'ENG_SW'
  }
];

const roleLabels = {
  basic: 'Basic',
  'hiring-manager': 'Hiring Manager',
  administrator: 'Administrator'
};
const roleValues = Object.keys(roleLabels);

function getUserDisplayName(user) {
  const firstName = String(user?.firstName || '').trim();
  const lastName = String(user?.lastName || '').trim();
  const joined = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (joined) return joined;
  if (typeof user?.displayName === 'string' && user.displayName.trim()) return user.displayName.trim();
  return '';
}

function normalizeString(value) {
  return String(value || '').trim().toLowerCase();
}

function isUnassignedHiringManager(value) {
  const normalized = normalizeString(value);
  return normalized.length === 0 || normalized === 'unassigned' || normalized === 'n/a';
}

const allWizardSteps = [
  { id: 'project-demand', title: 'Project Demand' },
  { id: 'project-summary', title: 'Project Summary' },
  { id: 'project-details', title: 'Project Details' },
  { id: 'functional-supply', title: 'Functional Supply' }
];

const priorities = ['Critical', 'High', 'Medium', 'Low'];
const statuses = ['Open', 'In Progress', 'Blocked', 'Done'];
const NEED_INFO_STAGE = 'Need Info';
const fulfillmentStages = [
  'Req Posted',
  'Resume Review',
  'Interview',
  NEED_INFO_STAGE,
  'Onboarding',
  'Sourcing',
  'Offer',
  'Filled'
];
const managerCallFulfillmentStages = ['Onboarding', 'Interview', NEED_INFO_STAGE, 'Req Posted', 'Resume Review'];
const MANAGER_CALL_VIEW_NAME = 'Manager Call Review';
const workTypes = ['Firm', 'T&M', 'Internal', 'Contractor'];
const clearanceOptions = ['Not Required', 'TS/SCI', 'Secret', 'Top Secret'];
const yesNo = ['No', 'Yes'];
const functionalOrgOptions = ['ENG_SW', 'ENG_SEIT'];

const priorityWeight = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1
};

const stepRequirementsById = {
  'project-demand': [
    { field: 'programPoc', label: 'Program POC' },
    { field: 'needDate', label: 'Need Date' }
  ],
  'project-summary': [{ field: 'project', label: 'Project' }],
  'project-details': [
    { field: 'positionTitle', label: 'Position Title' },
    { field: 'funcOrg', label: 'Functional Org' }
  ],
  'functional-supply': []
};

const demandFieldCatalog = [
  { key: 'demandId', label: 'Demand ID', getValue: (item) => item.demandId || '' },
  { key: 'demandTitle', label: 'Demand Title', getValue: (item) => item.demandTitle || item.title || '' },
  { key: 'project', label: 'Program', getValue: (item) => item.project || '' },
  { key: 'positionTitle', label: 'Position', getValue: (item) => item.positionTitle || '' },
  { key: 'hiringManager', label: 'Hiring Manager', getValue: (item) => item.hiringManager || item.owner || '' },
  { key: 'funcOrg', label: 'Functional Org', getValue: (item) => item.funcOrg || '' },
  { key: 'state', label: 'Status', getValue: (item) => item.state || item.status || '' },
  { key: 'priority', label: 'Priority', getValue: (item) => item.priority || '' },
  { key: 'needDate', label: 'Need Date', getValue: (item) => item.needDate || item.dueDate || '' },
  { key: 'workType', label: 'Work Type', getValue: (item) => item.workType || '' },
  { key: 'clearance', label: 'Clearance', getValue: (item) => item.clearance || '' },
  { key: 'fulfillmentStage', label: 'Fulfillment', getValue: (item) => item.fulfillmentStage || '' },
  { key: 'reqNumber', label: 'Req Number', getValue: (item) => item.reqNumber || '' },
  { key: 'createdByName', label: 'Created By', getValue: (item) => item.createdByName || '' }
];

const demandFieldByKey = Object.fromEntries(demandFieldCatalog.map((field) => [field.key, field]));
const defaultSpreadsheetColumns = [
  'demandId',
  'demandTitle',
  'project',
  'positionTitle',
  'hiringManager',
  'state',
  'priority',
  'needDate'
];

function sanitizeSpreadsheetColumns(columns) {
  if (!Array.isArray(columns)) return defaultSpreadsheetColumns;
  const validKeys = new Set(demandFieldCatalog.map((field) => field.key));
  const deduped = [...new Set(columns.filter((key) => typeof key === 'string' && validKeys.has(key)))];
  return deduped.length > 0 ? deduped : defaultSpreadsheetColumns;
}

function matchesSpreadsheetColumnFilters(item, columnFilters) {
  const activeFilters = Object.entries(columnFilters || {}).filter(([, value]) => String(value || '').trim().length > 0);
  if (activeFilters.length === 0) return true;

  return activeFilters.every(([key, rawFilter]) => {
    const field = demandFieldByKey[key];
    if (!field || typeof field.getValue !== 'function') return true;

    const filterValue = String(rawFilter || '').trim().toLowerCase();
    const cellValue = String(field.getValue(item) || '').trim().toLowerCase();
    return cellValue.includes(filterValue);
  });
}

function loadDemandViewPreferences() {
  try {
    const raw = window.localStorage.getItem(DEMAND_VIEW_PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveDemandViewPreferences(preferences) {
  window.localStorage.setItem(DEMAND_VIEW_PREFS_KEY, JSON.stringify(preferences));
}

function loadSpreadsheetViews() {
  try {
    const raw = window.localStorage.getItem(SPREADSHEET_VIEWS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSpreadsheetViews(views) {
  window.localStorage.setItem(SPREADSHEET_VIEWS_KEY, JSON.stringify(views));
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isBlank(value) {
  return typeof value === 'string' ? value.trim() === '' : !value;
}

function loadDraftSnapshot() {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.form || typeof parsed.form !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveDraftSnapshot(payload) {
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
}

function clearDraftSnapshot() {
  window.localStorage.removeItem(DRAFT_KEY);
}

function loadAuthSession() {
  try {
    const raw = window.localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.id || !parsed.role || !parsed.email) return null;
    if (!roleValues.includes(parsed.role)) return null;

    const legacyName = String(parsed.displayName || parsed.username || '').trim();
    const legacyParts = legacyName ? legacyName.split(/\s+/) : [];
    const firstName = String(parsed.firstName || legacyParts[0] || '').trim();
    const lastName = String(parsed.lastName || legacyParts.slice(1).join(' ') || 'User').trim();
    if (!firstName || !lastName) return null;

    const previewRole =
      parsed.role === 'administrator' && roleValues.includes(parsed.previewRole)
        ? parsed.previewRole
        : parsed.role;

    return {
      id: parsed.id,
      firstName,
      lastName,
      displayName: getUserDisplayName({ firstName, lastName }),
      email: String(parsed.email || '').trim().toLowerCase(),
      role: parsed.role,
      previewRole,
      funcOrg: functionalOrgOptions.includes(parsed.funcOrg) ? parsed.funcOrg : ''
    };
  } catch {
    return null;
  }
}

function saveAuthSession(user) {
  window.localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

function clearAuthSession() {
  window.localStorage.removeItem(AUTH_KEY);
}

function loadUsers() {
  try {
    const raw = window.localStorage.getItem(USERS_KEY);
    if (!raw) return defaultUsers;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultUsers;

    const validUsers = parsed
      .map((item) => {
        if (!item || typeof item.id !== 'string' || typeof item.password !== 'string') return null;

        const role = typeof item.role === 'string' ? item.role : '';
        if (!roleValues.includes(role)) return null;

        const email = String(item.email || '').trim().toLowerCase();
        if (!email || !isEmail(email)) return null;

        const legacyName = String(item.displayName || item.username || '').trim();
        const legacyParts = legacyName ? legacyName.split(/\s+/) : [];
        const firstName = String(item.firstName || legacyParts[0] || '').trim();
        const lastName = String(item.lastName || legacyParts.slice(1).join(' ') || 'User').trim();
        if (!firstName || !lastName) return null;

        const funcOrg = functionalOrgOptions.includes(item.funcOrg) ? item.funcOrg : '';

        return {
          id: item.id,
          firstName,
          lastName,
          displayName: getUserDisplayName({ firstName, lastName }),
          password: item.password,
          role,
          email,
          funcOrg
        };
      })
      .filter(Boolean);

    return validUsers.length > 0 ? validUsers : defaultUsers;
  } catch {
    return defaultUsers;
  }
}

function saveUsers(users) {
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function loadSubscriptions() {
  try {
    const raw = window.localStorage.getItem(SUBSCRIPTIONS_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const normalized = {};
    for (const [demandId, userIds] of Object.entries(parsed)) {
      if (!Array.isArray(userIds)) continue;
      const uniqueIds = [...new Set(userIds.filter((item) => typeof item === 'string' && item.trim()))];
      if (uniqueIds.length > 0) {
        normalized[demandId] = uniqueIds;
      }
    }

    return normalized;
  } catch {
    return {};
  }
}

function saveSubscriptions(subscriptions) {
  window.localStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(subscriptions));
}

function loadHiringManagerGroups() {
  try {
    const raw = window.localStorage.getItem(HM_GROUPS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item) =>
          item &&
          typeof item.id === 'string' &&
          typeof item.name === 'string' &&
          Array.isArray(item.memberIds)
      )
      .map((item) => ({
        id: item.id,
        name: item.name.trim(),
        description: typeof item.description === 'string' ? item.description : '',
        memberIds: [...new Set(item.memberIds.filter((memberId) => typeof memberId === 'string'))],
        createdAt: item.createdAt || null,
        updatedAt: item.updatedAt || null
      }))
      .filter((item) => item.name);
  } catch {
    return [];
  }
}

function saveHiringManagerGroups(groups) {
  window.localStorage.setItem(HM_GROUPS_KEY, JSON.stringify(groups));
}

function loadDestaffRecords() {
  try {
    const raw = window.localStorage.getItem(DESTAFF_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDestaffRecords(records) {
  window.localStorage.setItem(DESTAFF_KEY, JSON.stringify(records));
}

const destaffStatuses = ['Available', 'Interviewing', 'Placed', 'On Notice'];
const destaffClearanceOptions = ['Not Required', 'Secret', 'Top Secret', 'TS/SCI'];

function getDefaultDestaffForm() {
  return {
    employeeName: '',
    currentProgram: '',
    currentRole: '',
    funcOrg: '',
    clearance: 'Not Required',
    availableDate: '',
    skills: '',
    notes: '',
    status: 'Available',
    hiringManager: ''
  };
}

function getDefaultForm() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    bulkCount: '1',
    demandTitle: '',
    programPoc: '',
    enteredOn: today,
    demandId: '',
    needDate: today,
    state: 'Open',
    division: '',
    businessUnit: '',
    orgUnit: '',
    project: '',
    subProjectName: '',
    positionTitle: '',
    firmOrderFactor: '',
    workType: 'Firm',
    allotmentType: '',
    priority: 'Medium',
    durationMonths: '',
    interviewPanelNames: '',
    funcOrg: '',
    skillsDescription: '',
    certifications: '',
    allowableGrades: '',
    clearance: 'Not Required',
    facilityClearance: '',
    contractorOk: 'No',
    remotePercent: '0',
    fulfillmentStage: 'Req Posted',
    hiringManager: '',
    alternateMgr1: '',
    alternateMgr2: '',
    externalReqRequired: 'No',
    reqNumber: '',
    candidates: '',
    filledBy: '',
    filledBySite: '',
    newHire: '',
    startDate: '',
    comments: []
  };
}

function normalizeDemand(form) {
  const title = form.demandTitle.trim() || `${form.project.trim()} - ${form.positionTitle.trim()}`.trim();
  const status = normalizeStatusForFulfillmentStage(form.state, form.fulfillmentStage);
  return {
    ...form,
    demandTitle: title,
    priority: form.priority,
    state: status,
    status,
    dueDate: form.needDate,
    owner: form.hiringManager.trim() || form.programPoc.trim() || 'Unassigned',
    effort: Number(form.durationMonths) || 1,
    notes: form.skillsDescription.trim() || 'No notes captured.',
    comments: Array.isArray(form.comments) ? form.comments : []
  };
}

function canUseBlockedStatus(fulfillmentStage) {
  return fulfillmentStage === NEED_INFO_STAGE;
}

function normalizeStatusForFulfillmentStage(status, fulfillmentStage) {
  if (status === 'Blocked' && !canUseBlockedStatus(fulfillmentStage)) {
    return 'In Progress';
  }
  return status;
}

function diffDemandFields(before, after) {
  const ignored = new Set(['updatedAt', 'updatedByUserId', 'updatedByName', 'history']);
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const changed = [];

  for (const key of keys) {
    if (ignored.has(key)) continue;

    const left = before?.[key];
    const right = after?.[key];

    if (JSON.stringify(left) !== JSON.stringify(right)) {
      changed.push(key);
    }
  }

  return changed;
}

function appendDemandHistory(item, entry) {
  const priorHistory = Array.isArray(item.history) ? item.history : [];
  return [...priorHistory, { id: crypto.randomUUID(), ...entry }];
}

function getStatusOptionsForFulfillmentStage(fulfillmentStage) {
  if (canUseBlockedStatus(fulfillmentStage)) return statuses;
  return statuses.filter((status) => status !== 'Blocked');
}

function getNextDemandId(demands) {
  let max = 0;
  for (const d of demands) {
    const n = parseInt(String(d.demandId ?? '').replace(/\D/g, ''), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return String(max + 1).padStart(5, '0');
}

function buildDemandId(startingNum, index) {
  const base = typeof startingNum === 'number' ? startingNum : parseInt(String(startingNum).replace(/\D/g, ''), 10) || 1;
  return String(base + index).padStart(5, '0');
}

function toMailtoUrl({ to, cc, subject, body }) {
  const params = new URLSearchParams();
  if (cc) params.set('cc', cc);
  params.set('subject', subject);
  params.set('body', body);
  return `mailto:${to}?${params.toString()}`;
}

function normalizeStoredComments(item) {
  if (Array.isArray(item.comments)) return item.comments;
  if (typeof item.comments === 'string' && item.comments.trim()) {
    return [
      {
        id: crypto.randomUUID(),
        message: item.comments.trim(),
        authorName: 'Legacy Comment',
        authorEmail: '',
        createdAt: item.updatedAt || item.createdAt || new Date().toISOString()
      }
    ];
  }
  return [];
}

function getDemandLastUpdatedAt(item) {
  return item.updatedAt || item.createdAt || null;
}

function getDaysOpen(item) {
  const openedAt = item.createdAt || item.enteredOn || item.needDate || null;
  if (!openedAt) return null;
  const openedDate = new Date(openedAt);
  if (Number.isNaN(openedDate.getTime())) return null;
  const diffMs = Date.now() - openedDate.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export default function App() {
  const [demands, setDemands] = useState(() => loadDemands() ?? sampleDemands);
  const [destaffRecords, setDestaffRecords] = useState(loadDestaffRecords);
  const [page, setPage] = useState(pages.dashboard);
  const [users, setUsers] = useState(loadUsers);
  const [currentUser, setCurrentUser] = useState(loadAuthSession);
  const [authMode, setAuthMode] = useState('signin');
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [signupForm, setSignupForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    funcOrg: '',
    password: '',
    confirmPassword: ''
  });
  const [signupError, setSignupError] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [userForm, setUserForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    funcOrg: '',
    password: '',
    role: 'basic'
  });
  const [subscriptions, setSubscriptions] = useState(loadSubscriptions);
  const [dashboardFeedFilter, setDashboardFeedFilter] = useState('combined');
  const [hiringManagerGroups, setHiringManagerGroups] = useState(loadHiringManagerGroups);
  const [groupForm, setGroupForm] = useState({
    name: '',
    description: '',
    memberIds: []
  });
  const [groupFilters, setGroupFilters] = useState({
    memberCount: 'all',
    workload: 'all',
    query: ''
  });
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [groupStatus, setGroupStatus] = useState('');
  async function notifyDemandCreated(createdDemands) {
    // TODO: Configure SMTP in .env (see .env.example) and uncomment below to enable email notifications.
    // const demandsToNotify = Array.isArray(createdDemands) ? createdDemands : [createdDemands];
    // const primaryDemand = demandsToNotify[0];
    // const organizationEmail = primaryDemand.funcOrg === 'ENG_SEIT' ? ENG_SEIT_EMAIL : ENG_SW_EMAIL;
    //
    // const response = await fetch('/api/notifications/demand-created', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     organizationEmail,
    //     organizationLabel: primaryDemand.funcOrg,
    //     creatorEmail: currentUser.email,
    //     creatorName: currentUser.displayName,
    //     demandTitle: primaryDemand.demandTitle,
    //     project: primaryDemand.project,
    //     positionTitle: primaryDemand.positionTitle,
    //     priority: primaryDemand.priority,
    //     needDate: primaryDemand.needDate,
    //     notes: primaryDemand.notes,
    //     demandIds: demandsToNotify.map((item) => item.demandId || item.id)
    //   })
    // });
    //
    // if (!response.ok) {
    //   const payload = await response.json().catch(() => ({}));
    //   throw new Error(payload.error || 'Failed to send demand notification email.');
    // }
  }
  const [editingUserId, setEditingUserId] = useState(null);
  const [userStatus, setUserStatus] = useState('');
    const [destaffForm, setDestaffForm] = useState(getDefaultDestaffForm);
    const [editingDestaffId, setEditingDestaffId] = useState(null);
    const [destaffStatus, setDestaffStatus] = useState('');
    const [destaffSearch, setDestaffSearch] = useState('');
    const [destaffStatusFilter, setDestaffStatusFilter] = useState('All');
  const [currentStep, setCurrentStep] = useState(0);
  const [filters, setFilters] = useState({
    query: '',
    status: 'All',
    priority: 'All'
  });
  const [dashboardScope, setDashboardScope] = useState(null);
  const [demandViewMode, setDemandViewMode] = useState('spreadsheet');
  const [showSpreadsheetCustomizer, setShowSpreadsheetCustomizer] = useState(false);
  const [showManagerCallCustomizer, setShowManagerCallCustomizer] = useState(false);
  const [showAllOpenCustomizer, setShowAllOpenCustomizer] = useState(false);
  const [spreadsheetColumnFilters, setSpreadsheetColumnFilters] = useState({});
  const [spreadsheetColumns, setSpreadsheetColumns] = useState(defaultSpreadsheetColumns);
  const [savedSpreadsheetViews, setSavedSpreadsheetViews] = useState(loadSpreadsheetViews);
  const [viewDraft, setViewDraft] = useState({ name: '', shared: false });
  const [spreadsheetFilters, setSpreadsheetFilters] = useState({
    project: 'All',
    funcOrg: 'All',
    hiringManager: '',
    fulfillmentStages: [],
    groupBy: 'none'
  });
  const [selectedSpreadsheetDemandIds, setSelectedSpreadsheetDemandIds] = useState([]);
  const [bulkEdit, setBulkEdit] = useState({
    status: '',
    priority: '',
    hiringManager: '',
    fulfillmentStage: ''
  });
  const [dragField, setDragField] = useState(null);
  const [metricsFilters, setMetricsFilters] = useState({
    org: 'All',
    priority: 'All',
    hiringManager: ''
  });
  const [form, setForm] = useState(getDefaultForm);
  const [baselineForm, setBaselineForm] = useState(getDefaultForm);
  const [editId, setEditId] = useState(null);
  const [selectedDemandId, setSelectedDemandId] = useState(null);
  const [detailEdits, setDetailEdits] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [csvImportRows, setCsvImportRows] = useState([]);
  const [csvImportName, setCsvImportName] = useState('');
  const [csvImportStatus, setCsvImportStatus] = useState('');
  const [appStatus, setAppStatus] = useState('');
  const [attemptedSteps, setAttemptedSteps] = useState({});
  const [hasDraft, setHasDraft] = useState(false);
  const [draftUpdatedAt, setDraftUpdatedAt] = useState('');
  const [draftStatus, setDraftStatus] = useState('');
  const formRef = useRef(form);
  const stepRef = useRef(currentStep);

  const isDirty = useMemo(() => {
    if (page !== pages.addDemand) return false;
    return JSON.stringify(form) !== JSON.stringify(baselineForm);
  }, [page, form, baselineForm]);

  const canCreateDemand = Boolean(currentUser);
  const effectiveRole =
    currentUser?.role === 'administrator' && roleValues.includes(currentUser?.previewRole)
      ? currentUser.previewRole
      : currentUser?.role;
  const isRolePreviewing =
    Boolean(currentUser) &&
    currentUser.role === 'administrator' &&
    effectiveRole !== currentUser.role;
  const isAdmin = effectiveRole === 'administrator';
  const canEditFunctionalInfo =
    effectiveRole === 'administrator' || effectiveRole === 'hiring-manager';
  const adminCount = users.filter((item) => item.role === 'administrator').length;
  const hiringManagers = useMemo(
    () => users.filter((item) => item.role === 'hiring-manager'),
    [users]
  );
  const activeWizardSteps = useMemo(() => {
    const steps = allWizardSteps.slice(0, 3);
    if (editId && canEditFunctionalInfo) {
      steps.push(allWizardSteps[3]);
    }
    return steps;
  }, [editId, canEditFunctionalInfo]);

  function isOwner(item) {
    return item?.createdByUserId && currentUser && item.createdByUserId === currentUser.id;
  }

  function canEditDemand(item) {
    if (!currentUser) return false;
    if (effectiveRole === 'administrator' || effectiveRole === 'hiring-manager') return true;
    return isOwner(item);
  }

  function canDeleteDemand(item) {
    if (!currentUser) return false;
    return effectiveRole === 'administrator';
  }

  function canMarkDoneDemand(item) {
    if (!currentUser) return false;
    if (effectiveRole === 'administrator' || effectiveRole === 'hiring-manager') return true;
    return isOwner(item);
  }

  useEffect(() => {
    saveDemands(demands);
  }, [demands]);

  useEffect(() => {
    let cancelled = false;

    hydrateDemandsFromApi().then((remoteDemands) => {
      if (cancelled || !Array.isArray(remoteDemands)) return;

      setDemands((current) => {
        if (JSON.stringify(current) === JSON.stringify(remoteDemands)) {
          return current;
        }
        return remoteDemands;
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    saveDestaffRecords(destaffRecords);
  }, [destaffRecords]);

  useEffect(() => {
    setDemands((current) => {
      let changed = false;
      const next = current.map((item) => {
        const comments = normalizeStoredComments(item);
        const normalizedState = normalizeStatusForFulfillmentStage(
          item.state ?? item.status,
          item.fulfillmentStage
        );
        const stateChanged = normalizedState !== (item.state ?? item.status);

        if (Array.isArray(item.comments) && comments === item.comments && !stateChanged) return item;
        changed = true;
        return {
          ...item,
          comments,
          state: normalizedState,
          status: normalizedState
        };
      });
      return changed ? next : current;
    });
  }, []);

  useEffect(() => {
    saveUsers(users);
  }, [users]);

  useEffect(() => {
    saveSubscriptions(subscriptions);
  }, [subscriptions]);

  useEffect(() => {
    saveHiringManagerGroups(hiringManagerGroups);
  }, [hiringManagerGroups]);

  useEffect(() => {
    const validManagerIds = new Set(users.filter((item) => item.role === 'hiring-manager').map((item) => item.id));

    setHiringManagerGroups((current) => {
      let changed = false;
      const next = current.map((group) => {
        const memberIds = group.memberIds.filter((memberId) => validManagerIds.has(memberId));
        if (memberIds.length === group.memberIds.length) return group;
        changed = true;
        return {
          ...group,
          memberIds,
          updatedAt: new Date().toISOString()
        };
      });

      return changed ? next : current;
    });
  }, [users]);

  useEffect(() => {
    if (!currentUser) return;

    const matchedUser = users.find((item) => item.id === currentUser.id);
    if (!matchedUser) {
      setCurrentUser(null);
      clearAuthSession();
      setPage(pages.dashboard);
      return;
    }

    const nextSession = {
      id: matchedUser.id,
      firstName: matchedUser.firstName,
      lastName: matchedUser.lastName,
      displayName: matchedUser.displayName,
      role: matchedUser.role,
      previewRole:
        matchedUser.role === 'administrator' && roleValues.includes(currentUser.previewRole)
          ? currentUser.previewRole
          : matchedUser.role,
      email: matchedUser.email,
      funcOrg: matchedUser.funcOrg
    };

    if (
      nextSession.firstName !== currentUser.firstName ||
      nextSession.lastName !== currentUser.lastName ||
      nextSession.displayName !== currentUser.displayName ||
      nextSession.role !== currentUser.role ||
      nextSession.previewRole !== currentUser.previewRole ||
      nextSession.email !== currentUser.email ||
      nextSession.funcOrg !== currentUser.funcOrg
    ) {
      setCurrentUser(nextSession);
      saveAuthSession(nextSession);
    }
  }, [users, currentUser]);

  useEffect(() => {
    if (page === pages.adminUsers && !isAdmin) {
      setPage(pages.dashboard);
    }
  }, [page, isAdmin]);

  useEffect(() => {
    if (!currentUser?.id) return;

    const preferences = loadDemandViewPreferences();
    const currentPreference = preferences[currentUser.id] ?? {};
    const nextMode = currentPreference.mode === 'cards' ? 'cards' : 'spreadsheet';
    const nextColumns = sanitizeSpreadsheetColumns(currentPreference.columns);

    setDemandViewMode(nextMode);
    setSpreadsheetColumns(nextColumns);
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;

    const preferences = loadDemandViewPreferences();
    preferences[currentUser.id] = {
      mode: demandViewMode,
      columns: sanitizeSpreadsheetColumns(spreadsheetColumns)
    };
    saveDemandViewPreferences(preferences);
  }, [currentUser?.id, demandViewMode, spreadsheetColumns]);

  useEffect(() => {
    if (demandViewMode !== 'spreadsheet') {
      setShowSpreadsheetCustomizer(false);
    }
  }, [demandViewMode]);

  useEffect(() => {
    if (page !== pages.managerCallMetrics) {
      setShowManagerCallCustomizer(false);
    }
  }, [page]);

  useEffect(() => {
    if (page !== pages.allOpen) {
      setShowAllOpenCustomizer(false);
    }
  }, [page]);

  useEffect(() => {
    if (page !== pages.allDestaff) {
      // Placeholder for allDestaff page state cleanup if needed
    }
  }, [page]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    setDemands((current) => {
      if (!Array.isArray(current)) return current;
      const withoutLegacyAdminSeed = current.filter((item) => item.seedSource !== 'dev-admin-manager');

      if (withoutLegacyAdminSeed.some((item) => item.seedSource === 'dev-chandler-manager')) {
        return withoutLegacyAdminSeed.length === current.length ? current : withoutLegacyAdminSeed;
      }

      const chandlerUser = users.find(
        (item) => normalizeString(item.email) === CHANDLER_EMAIL
      );
      console.log('Chandler user found:', chandlerUser?.displayName);
      const adminUser = users.find((item) => item.role === 'administrator');
      const adminName = getUserDisplayName(adminUser) || adminUser?.displayName || 'Admin User';
      const adminEmail = adminUser?.email || 'admin@company.com';
      const adminId = adminUser?.id || 'u-admin';
      const chandlerName = getUserDisplayName(chandlerUser) || chandlerUser?.displayName || CHANDLER_NAME;
      const chandlerFuncOrg = chandlerUser?.funcOrg || functionalOrgOptions[0];

      const nextDemandNum = parseInt(getNextDemandId(withoutLegacyAdminSeed), 10) || 1;
      const now = Date.now();

      const seeded = Array.from({ length: 10 }, (_, index) => {
        const sequence = nextDemandNum + index;
        const id = crypto.randomUUID();
        const dayOffset = index + 1;
        const needDate = new Date(now + dayOffset * 86400000).toISOString().slice(0, 10);
        const fulfillmentStage = managerCallFulfillmentStages[index % managerCallFulfillmentStages.length];
        const createdAt = new Date(now - (index + 2) * 86400000).toISOString();

        return {
          id,
          demandId: String(sequence).padStart(5, '0'),
          demandTitle: `Chandler Seed Demand ${index + 1}`,
          project: `DEV-PROGRAM-${(index % 3) + 1}`,
          positionTitle: `Software Engineer ${index + 1}`,
          hiringManager: chandlerName,
          owner: chandlerName,
          funcOrg: chandlerFuncOrg,
          priority: priorities[index % priorities.length],
          state: 'Open',
          status: 'Open',
          needDate,
          fulfillmentStage,
          reqNumber: `REQ-DEV-${String(sequence).padStart(4, '0')}`,
          notes: `Development seeded demand assigned to ${chandlerName} (${CHANDLER_EMAIL}).`,
          comments: [],
          createdByUserId: adminId,
          createdByName: adminName,
          createdByEmail: adminEmail,
          createdByRole: 'administrator',
          updatedByUserId: adminId,
          updatedByName: adminName,
          createdAt,
          updatedAt: createdAt,
          seedSource: 'dev-chandler-manager'
        };
      });

      const nextDemands = [...seeded, ...withoutLegacyAdminSeed];
      return nextDemands;
    });

    try {
      window.localStorage.setItem(DEV_CHANDLER_SEED_KEY, 'done');
    } catch {
      // Ignore localStorage write errors in restricted browser modes.
    }
  }, [users]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!currentUser?.id) return;

    setSubscriptions((current) => {
      let changed = false;
      const next = { ...current };

      const seededDemands = demands.filter((item) => item.seedSource === 'dev-chandler-manager');
      console.log('Auto-subscribing', currentUser.displayName, 'to', seededDemands.length, 'seeded demands');
      for (const demand of seededDemands) {
        const existing = next[demand.id] || [];
        if (!existing.includes(currentUser.id)) {
          next[demand.id] = [...existing, currentUser.id];
          changed = true;
        }
      }

      if (changed) console.log('✓ Updated subscriptions for', seededDemands.length, 'demands');
      return changed ? next : current;
    });
  }, [demands, currentUser?.id]);

  useEffect(() => {
    saveSpreadsheetViews(savedSpreadsheetViews);
  }, [savedSpreadsheetViews]);

  useEffect(() => {
    const draft = loadDraftSnapshot();
    if (!draft) return;
    setHasDraft(true);
    setDraftUpdatedAt(draft.updatedAt ?? '');
  }, []);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    stepRef.current = currentStep;
  }, [currentStep]);

  useEffect(() => {
    const demandIds = new Set(demands.map((item) => item.id));
    const userIds = new Set(users.map((item) => item.id));

    setSubscriptions((current) => {
      let changed = false;
      const next = {};

      for (const [demandId, subscriberIds] of Object.entries(current)) {
        if (!demandIds.has(demandId)) {
          changed = true;
          continue;
        }

        const filtered = [...new Set(subscriberIds.filter((id) => userIds.has(id)))];
        if (filtered.length !== subscriberIds.length) changed = true;
        if (filtered.length > 0) {
          next[demandId] = filtered;
        } else {
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [demands, users]);

  useEffect(() => {
    setDashboardFeedFilter('combined');
  }, [currentUser?.id]);

  useEffect(() => {
    if (currentStep > activeWizardSteps.length - 1) {
      setCurrentStep(Math.max(0, activeWizardSteps.length - 1));
    }
  }, [currentStep, activeWizardSteps]);

  function isSubscribedDemand(demandId) {
    if (!currentUser?.id) return false;
    return Array.isArray(subscriptions[demandId]) && subscriptions[demandId].includes(currentUser.id);
  }

  function toggleDemandSubscription(demandId) {
    if (!currentUser?.id) return;

    setSubscriptions((current) => {
      const existing = Array.isArray(current[demandId]) ? current[demandId] : [];
      const nextIds = existing.includes(currentUser.id)
        ? existing.filter((id) => id !== currentUser.id)
        : [...existing, currentUser.id];

      const next = { ...current };
      if (nextIds.length > 0) {
        next[demandId] = nextIds;
      } else {
        delete next[demandId];
      }
      return next;
    });
  }

  function isManagedByCurrentUser(item) {
    if (!currentUser) return false;

    const demandManager = normalizeString(item.hiringManager || item.owner);
    if (!demandManager) return false;

    const currentName = normalizeString(currentUser.displayName);
    const currentEmail = normalizeString(currentUser.email);
    return demandManager === currentName || demandManager === currentEmail;
  }

  function isGroupNewDemand(item) {
    if (!currentUser?.funcOrg) return false;
    const status = String(item.state ?? item.status ?? '').trim();
    if (status !== 'Open') return false;
    if ((item.funcOrg || '') !== currentUser.funcOrg) return false;
    return isUnassignedHiringManager(item.hiringManager || item.owner);
  }

  useEffect(() => {
    if (!isDirty) return undefined;

    function handleBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (page !== pages.addDemand || !isDirty) return undefined;

    const intervalId = window.setInterval(() => {
      const snapshot = {
        form: formRef.current,
        currentStep: stepRef.current,
        updatedAt: new Date().toISOString(),
        auto: true
      };
      saveDraftSnapshot(snapshot);
      setHasDraft(true);
      setDraftUpdatedAt(snapshot.updatedAt);
      setDraftStatus(`Autosaved at ${new Date(snapshot.updatedAt).toLocaleTimeString()}.`);
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [page, isDirty]);

  const visibleDemands = useMemo(() => {
    const scopedDemands = Array.isArray(dashboardScope?.ids)
      ? demands.filter((item) => dashboardScope.ids.includes(item.id))
      : demands;

    let personalizedDemands = scopedDemands;
    if (page === pages.dashboard && currentUser) {
      personalizedDemands = scopedDemands.filter((item) => {
        const subscribed = isSubscribedDemand(item.id);
        const managedByMe = isManagedByCurrentUser(item);
        const groupNew = isGroupNewDemand(item);

        if (dashboardFeedFilter === 'subscribed') return subscribed;
        if (dashboardFeedFilter === 'manager') return managedByMe;
        if (dashboardFeedFilter === 'group-new') return groupNew;

        return subscribed || managedByMe || groupNew;
      });
    }

    return personalizedDemands
      .filter((item) => {
        const query = filters.query.trim().toLowerCase();
        const commentText = Array.isArray(item.comments)
          ? item.comments.map((comment) => comment.message).join(' ')
          : item.comments ?? '';
        const matchesQuery =
          query.length === 0 ||
          [
            item.demandTitle ?? item.title,
            item.hiringManager ?? item.owner,
            commentText || item.notes,
            item.project ?? '',
            item.positionTitle ?? ''
          ]
            .join(' ')
            .toLowerCase()
            .includes(query);
        const matchesStatus = filters.status === 'All' || (item.state ?? item.status) === filters.status;
        const matchesPriority = filters.priority === 'All' || item.priority === filters.priority;
        return matchesQuery && matchesStatus && matchesPriority;
      })
      .sort((a, b) => {
        const aStatus = a.state ?? a.status;
        const bStatus = b.state ?? b.status;
        if (aStatus === 'Done' && bStatus !== 'Done') return 1;
        if (aStatus !== 'Done' && bStatus === 'Done') return -1;
        const priorityDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        const aDate = a.needDate ?? a.dueDate ?? '';
        const bDate = b.needDate ?? b.dueDate ?? '';
        return aDate.localeCompare(bDate);
      });
  }, [demands, filters, dashboardScope, dashboardFeedFilter, page, currentUser, subscriptions]);

  const dashboardCounts = useMemo(() => {
    const total = visibleDemands.length;
    const done = visibleDemands.filter((item) => (item.state ?? item.status) === 'Done').length;
    const blocked = visibleDemands.filter((item) => (item.state ?? item.status) === 'Blocked').length;
    const open = visibleDemands.filter((item) => (item.state ?? item.status) === 'Open').length;
    const subscribed = visibleDemands.filter((item) => isSubscribedDemand(item.id)).length;
    return { total, open, done, blocked, subscribed };
  }, [visibleDemands, subscriptions, currentUser?.id]);

  const selectedSpreadsheetFields = useMemo(
    () => sanitizeSpreadsheetColumns(spreadsheetColumns).map((key) => demandFieldByKey[key]).filter(Boolean),
    [spreadsheetColumns]
  );

  const availableSpreadsheetFields = useMemo(
    () => demandFieldCatalog.filter((field) => !spreadsheetColumns.includes(field.key)),
    [spreadsheetColumns]
  );

  useEffect(() => {
    const selectedKeys = new Set(selectedSpreadsheetFields.map((field) => field.key));
    setSpreadsheetColumnFilters((current) => {
      let changed = false;
      const next = {};

      for (const [key, value] of Object.entries(current)) {
        if (selectedKeys.has(key)) {
          next[key] = value;
        } else {
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [selectedSpreadsheetFields]);

  const spreadsheetDemands = useMemo(() => {
    const hmQuery = spreadsheetFilters.hiringManager.trim().toLowerCase();

    return visibleDemands.filter((item) => {
      const projectMatch =
        spreadsheetFilters.project === 'All' ||
        (item.project || '') === spreadsheetFilters.project;
      const orgMatch =
        spreadsheetFilters.funcOrg === 'All' ||
        (item.funcOrg || '') === spreadsheetFilters.funcOrg;
      const managerMatch =
        hmQuery.length === 0 ||
        String(item.hiringManager || item.owner || '').toLowerCase().includes(hmQuery);

      const stageMatch =
        !Array.isArray(spreadsheetFilters.fulfillmentStages) ||
        spreadsheetFilters.fulfillmentStages.length === 0 ||
        spreadsheetFilters.fulfillmentStages.includes(item.fulfillmentStage || '');

      const columnMatch = matchesSpreadsheetColumnFilters(item, spreadsheetColumnFilters);
      return projectMatch && orgMatch && managerMatch && stageMatch && columnMatch;
    });
  }, [visibleDemands, spreadsheetFilters, spreadsheetColumnFilters]);

  const spreadsheetGroups = useMemo(() => {
    if (spreadsheetFilters.groupBy === 'none') return [];

    const key = spreadsheetFilters.groupBy;
    const map = new Map();

    for (const item of spreadsheetDemands) {
      const groupValue =
        key === 'project'
          ? item.project || 'Unspecified'
          : key === 'funcOrg'
          ? item.funcOrg || 'Unspecified'
          : key === 'hiringManager'
          ? item.hiringManager || item.owner || 'Unassigned'
          : key === 'state'
          ? item.state || item.status || 'Unknown'
          : key === 'priority'
          ? item.priority || 'Unknown'
          : 'Other';

      const current = map.get(groupValue) || { label: groupValue, total: 0, open: 0, blocked: 0 };
      current.total += 1;
      if ((item.state ?? item.status) !== 'Done') current.open += 1;
      if ((item.state ?? item.status) === 'Blocked') current.blocked += 1;
      map.set(groupValue, current);
    }

    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [spreadsheetDemands, spreadsheetFilters.groupBy]);

  const userAccessibleSpreadsheetViews = useMemo(() => {
    if (!currentUser?.id) return [];
    return savedSpreadsheetViews.filter((view) => view.shared || view.ownerId === currentUser.id);
  }, [savedSpreadsheetViews, currentUser?.id]);

  useEffect(() => {
    const visibleIds = new Set(spreadsheetDemands.map((item) => item.id));
    setSelectedSpreadsheetDemandIds((current) => current.filter((id) => visibleIds.has(id)));
  }, [spreadsheetDemands]);

  const selectedDemand = useMemo(
    () => demands.find((item) => item.id === selectedDemandId) ?? null,
    [demands, selectedDemandId]
  );

  function resetSpreadsheetColumns() {
    setSpreadsheetColumns(defaultSpreadsheetColumns);
  }

  function saveCurrentSpreadsheetView() {
    if (!currentUser?.id) return;
    const name = viewDraft.name.trim();
    if (!name) {
      setAppStatus('View name is required to save a spreadsheet view.');
      return;
    }

    const newView = {
      id: crypto.randomUUID(),
      name,
      shared: viewDraft.shared,
      ownerId: currentUser.id,
      ownerName: currentUser.displayName,
      columns: sanitizeSpreadsheetColumns(spreadsheetColumns),
      filters: { ...spreadsheetFilters },
      createdAt: new Date().toISOString()
    };

    setSavedSpreadsheetViews((current) => [...current, newView]);
    setViewDraft({ name: '', shared: false });
    setAppStatus(`Saved spreadsheet view: ${name}${newView.shared ? ' (shared)' : ''}.`);
  }

  function applySpreadsheetView(view) {
    setSpreadsheetColumns(sanitizeSpreadsheetColumns(view.columns));
    setSpreadsheetFilters({
      project: view.filters?.project || 'All',
      funcOrg: view.filters?.funcOrg || 'All',
      hiringManager: view.filters?.hiringManager || '',
      fulfillmentStages: Array.isArray(view.filters?.fulfillmentStages)
        ? view.filters.fulfillmentStages
        : [],
      groupBy: view.filters?.groupBy || 'none'
    });
    setDemandViewMode('spreadsheet');
    setAppStatus(`Applied spreadsheet view: ${view.name}.`);
  }

  function deleteSpreadsheetView(viewId) {
    const view = savedSpreadsheetViews.find((item) => item.id === viewId);
    if (!view || !currentUser?.id) return;
    if (view.ownerId !== currentUser.id && !isAdmin) return;

    setSavedSpreadsheetViews((current) => current.filter((item) => item.id !== viewId));
    setAppStatus(`Deleted view: ${view.name}.`);
  }

  function updateRolePreview(nextRole) {
    if (!currentUser || currentUser.role !== 'administrator') return;

    const normalizedRole = roleValues.includes(nextRole) ? nextRole : 'administrator';
    const nextSession = { ...currentUser, previewRole: normalizedRole };

    setCurrentUser(nextSession);
    saveAuthSession(nextSession);
    setAppStatus(
      normalizedRole === 'administrator'
        ? 'Switched back to Administrator view.'
        : `Previewing as ${roleLabels[normalizedRole]}.`
    );
  }

  function updateSpreadsheetFilter(field, value) {
    setSpreadsheetFilters((current) => ({ ...current, [field]: value }));
  }

  function clearSpreadsheetFilters() {
    setSpreadsheetFilters({
      project: 'All',
      funcOrg: 'All',
      hiringManager: '',
      fulfillmentStages: [],
      groupBy: 'none'
    });
  }

  function toggleSpreadsheetFulfillmentStage(stage) {
    setSpreadsheetFilters((current) => {
      const existing = Array.isArray(current.fulfillmentStages) ? current.fulfillmentStages : [];
      const nextStages = existing.includes(stage)
        ? existing.filter((item) => item !== stage)
        : [...existing, stage];

      return {
        ...current,
        fulfillmentStages: nextStages
      };
    });
  }

  function updateSpreadsheetColumnFilter(fieldKey, value) {
    setSpreadsheetColumnFilters((current) => ({ ...current, [fieldKey]: value }));
  }

  function clearSpreadsheetColumnFilters() {
    setSpreadsheetColumnFilters({});
  }

  function applyManagerCallSpreadsheetPreset() {
    if (!currentUser?.id) return;

    const managerCallFilters = {
      ...spreadsheetFilters,
      fulfillmentStages: managerCallFulfillmentStages
    };

    setDemandViewMode('spreadsheet');
    setSpreadsheetFilters(managerCallFilters);

    const now = new Date().toISOString();
    setSavedSpreadsheetViews((current) => {
      const existing = current.find((view) => view.name === MANAGER_CALL_VIEW_NAME);
      if (!existing) {
        return [
          ...current,
          {
            id: crypto.randomUUID(),
            name: MANAGER_CALL_VIEW_NAME,
            shared: true,
            ownerId: currentUser.id,
            ownerName: currentUser.displayName,
            columns: sanitizeSpreadsheetColumns(spreadsheetColumns),
            filters: managerCallFilters,
            createdAt: now,
            updatedAt: now
          }
        ];
      }

      return current.map((view) =>
        view.name === MANAGER_CALL_VIEW_NAME
          ? {
              ...view,
              shared: true,
              columns: sanitizeSpreadsheetColumns(spreadsheetColumns),
              filters: managerCallFilters,
              updatedAt: now
            }
          : view
      );
    });

    setAppStatus(`Applied ${MANAGER_CALL_VIEW_NAME} and updated the shared saved view.`);
  }

  function toggleSpreadsheetRowSelection(demandId) {
    setSelectedSpreadsheetDemandIds((current) =>
      current.includes(demandId)
        ? current.filter((id) => id !== demandId)
        : [...current, demandId]
    );
  }

  function toggleSelectAllSpreadsheetRows() {
    const visibleIds = spreadsheetDemands.map((item) => item.id);
    setSelectedSpreadsheetDemandIds((current) =>
      current.length === visibleIds.length ? [] : visibleIds
    );
  }

  function applySpreadsheetBulkEdit() {
    if (selectedSpreadsheetDemandIds.length === 0) {
      setAppStatus('Select at least one demand to run bulk edit.');
      return;
    }

    const hasBulkInput =
      bulkEdit.status || bulkEdit.priority || bulkEdit.hiringManager || bulkEdit.fulfillmentStage;
    if (!hasBulkInput) {
      setAppStatus('Choose at least one bulk edit field before applying.');
      return;
    }

    const selectedSet = new Set(selectedSpreadsheetDemandIds);
    let changedCount = 0;

    setDemands((current) =>
      current.map((item) => {
        if (!selectedSet.has(item.id)) return item;

        const nextFulfillmentStage = bulkEdit.fulfillmentStage || item.fulfillmentStage;
        const requestedStatus = bulkEdit.status || item.state || item.status;
        const normalizedStatus = normalizeStatusForFulfillmentStage(requestedStatus, nextFulfillmentStage);

        const updated = {
          ...item,
          fulfillmentStage: nextFulfillmentStage,
          state: normalizedStatus,
          status: normalizedStatus,
          priority: bulkEdit.priority || item.priority,
          hiringManager: bulkEdit.hiringManager || item.hiringManager,
          owner: (bulkEdit.hiringManager || item.hiringManager || item.owner)
        };

        const changedFields = diffDemandFields(item, updated);
        if (changedFields.length === 0) return item;
        changedCount += 1;

        return {
          ...updated,
          updatedAt: new Date().toISOString(),
          updatedByUserId: currentUser.id,
          updatedByName: currentUser.displayName,
          history: appendDemandHistory(item, {
            action: 'bulk-update',
            actorId: currentUser.id,
            actorName: currentUser.displayName,
            changedFields,
            timestamp: new Date().toISOString()
          })
        };
      })
    );

    setBulkEdit({ status: '', priority: '', hiringManager: '', fulfillmentStage: '' });
    setSelectedSpreadsheetDemandIds([]);
    setAppStatus(`Bulk updated ${changedCount} demand${changedCount === 1 ? '' : 's'}.`);
  }

  function removeSpreadsheetColumn(fieldKey) {
    setSpreadsheetColumns((current) => {
      if (current.length <= 1) return current;
      return current.filter((key) => key !== fieldKey);
    });
  }

  function moveSpreadsheetColumn(fieldKey, targetIndex) {
    setSpreadsheetColumns((current) => {
      const withoutKey = current.filter((key) => key !== fieldKey);
      const boundedIndex = Math.max(0, Math.min(targetIndex, withoutKey.length));
      withoutKey.splice(boundedIndex, 0, fieldKey);
      return sanitizeSpreadsheetColumns(withoutKey);
    });
  }

  function startFieldDrag(source, fieldKey) {
    setDragField({ source, fieldKey });
  }

  function handleDropOnSelectedColumns(targetIndex) {
    if (!dragField?.fieldKey) return;
    moveSpreadsheetColumn(dragField.fieldKey, targetIndex);
    setDragField(null);
  }

  function renderSpreadsheetCell(item, field) {
    const value = field.getValue(item);

    if (field.key === 'priority') {
      const priority = String(value || '').toLowerCase();
      return <span className={`badge priority-${priority}`}>{value || 'N/A'}</span>;
    }

    if (field.key === 'state') {
      const stateValue = String(value || '').toLowerCase().replace(' ', '-');
      return <span className={`badge status-${stateValue}`}>{value || 'N/A'}</span>;
    }

    if (field.key === 'demandTitle') {
      return (
        <button
          type="button"
          className="text-btn table-demand-link"
          onClick={() => openDemandDetails(item.id)}
        >
          {value || 'Untitled'}
        </button>
      );
    }

    return value || 'N/A';
  }

  const hiringManagerGroupDetails = useMemo(() => {
    const normalizedDemands = demands.map((item) => {
      const value = String(item.hiringManager ?? item.owner ?? '').trim().toLowerCase();
      return {
        ...item,
        _normalizedHiringManager: value
      };
    });

    return hiringManagerGroups.map((group) => {
      const members = group.memberIds
        .map((memberId) => hiringManagers.find((item) => item.id === memberId))
        .filter(Boolean);

      const membersWithStats = members.map((member) => {
        const keys = [member.displayName, member.email]
          .map((value) => String(value || '').trim().toLowerCase())
          .filter(Boolean);

        const assignedDemands = normalizedDemands.filter((item) =>
          keys.some((key) => item._normalizedHiringManager === key)
        );

        const openCount = assignedDemands.filter((item) => (item.state ?? item.status) !== 'Done').length;
        const blockedCount = assignedDemands.filter((item) => (item.state ?? item.status) === 'Blocked').length;

        return {
          ...member,
          assignedCount: assignedDemands.length,
          openCount,
          blockedCount
        };
      });

      return {
        ...group,
        members: membersWithStats
      };
    });
  }, [hiringManagerGroups, hiringManagers, demands]);

  const visibleHiringManagerGroups = useMemo(() => {
    const query = groupFilters.query.trim().toLowerCase();

    return hiringManagerGroupDetails.filter((group) => {
      const memberCountMatch =
        groupFilters.memberCount === 'all' ||
        (groupFilters.memberCount === 'empty' && group.members.length === 0) ||
        (groupFilters.memberCount === 'small' && group.members.length >= 1 && group.members.length <= 3) ||
        (groupFilters.memberCount === 'large' && group.members.length >= 4);

      const totals = group.members.reduce(
        (acc, member) => {
          acc.assigned += member.assignedCount;
          acc.blocked += member.blockedCount;
          return acc;
        },
        { assigned: 0, blocked: 0 }
      );

      const workloadMatch =
        groupFilters.workload === 'all' ||
        (groupFilters.workload === 'has-assigned' && totals.assigned > 0) ||
        (groupFilters.workload === 'has-blocked' && totals.blocked > 0);

      const queryTarget = [
        group.name,
        group.description,
        ...group.members.flatMap((member) => [member.displayName, member.email])
      ]
        .join(' ')
        .toLowerCase();

      const queryMatch = !query || queryTarget.includes(query);
      return memberCountMatch && workloadMatch && queryMatch;
    });
  }, [hiringManagerGroupDetails, groupFilters]);

  const selectedGroupDetail = useMemo(
    () => hiringManagerGroupDetails.find((group) => group.id === selectedGroupId) ?? null,
    [hiringManagerGroupDetails, selectedGroupId]
  );

  const metrics = useMemo(() => {
    const total = demands.length;
    const done = demands.filter((item) => (item.state ?? item.status) === 'Done').length;
    const blocked = demands.filter((item) => (item.state ?? item.status) === 'Blocked').length;
    const openDemands = demands
      .filter((item) => (item.state ?? item.status) === 'Open')
      .map((item) => ({
        ...item,
        daysOpen: getDaysOpen(item) ?? 0,
        lastUpdatedAt: getDemandLastUpdatedAt(item)
      }))
      .sort((a, b) => b.daysOpen - a.daysOpen);
    const staleDemands = demands
      .filter((item) => (item.state ?? item.status) !== 'Done')
      .map((item) => {
        const lastUpdatedAt = getDemandLastUpdatedAt(item);
        const lastUpdatedDate = lastUpdatedAt ? new Date(lastUpdatedAt) : null;
        const daysSinceUpdate = lastUpdatedDate && !Number.isNaN(lastUpdatedDate.getTime())
          ? Math.max(0, Math.floor((Date.now() - lastUpdatedDate.getTime()) / (1000 * 60 * 60 * 24)))
          : null;
        return {
          ...item,
          daysOpen: getDaysOpen(item) ?? 0,
          lastUpdatedAt,
          daysSinceUpdate
        };
      })
      .filter((item) => item.daysSinceUpdate !== null && item.daysSinceUpdate >= 7)
      .sort((a, b) => (b.daysSinceUpdate ?? 0) - (a.daysSinceUpdate ?? 0));
    const open = openDemands.length;
    const averageDaysOpen = openDemands.length
      ? Math.round(openDemands.reduce((sum, item) => sum + item.daysOpen, 0) / openDemands.length)
      : 0;
    const oldestOpenDays = openDemands[0]?.daysOpen ?? 0;
    const weightedEffort = demands.reduce(
      (sum, item) => sum + (Number(item.effort) || 1) * priorityWeight[item.priority],
      0
    );

    return {
      total,
      open,
      done,
      blocked,
      weightedEffort,
      averageDaysOpen,
      oldestOpenDays,
      staleCount: staleDemands.length,
      openDemands,
      staleDemands
    };
  }, [demands]);

  const filteredMetrics = useMemo(() => {
    let openDemands = metrics.openDemands;
    let staleDemands = metrics.staleDemands;

    if (metricsFilters.org !== 'All') {
      openDemands = openDemands.filter((d) => d.funcOrg === metricsFilters.org);
      staleDemands = staleDemands.filter((d) => d.funcOrg === metricsFilters.org);
    }
    if (metricsFilters.priority !== 'All') {
      openDemands = openDemands.filter((d) => d.priority === metricsFilters.priority);
      staleDemands = staleDemands.filter((d) => d.priority === metricsFilters.priority);
    }
    if (metricsFilters.hiringManager.trim()) {
      const hm = metricsFilters.hiringManager.trim().toLowerCase();
      openDemands = openDemands.filter((d) => (d.hiringManager || '').toLowerCase().includes(hm));
      staleDemands = staleDemands.filter((d) => (d.hiringManager || '').toLowerCase().includes(hm));
    }

    const agingBuckets = [
      { label: '0–7 days',   count: openDemands.filter((d) => d.daysOpen <= 7).length },
      { label: '8–14 days',  count: openDemands.filter((d) => d.daysOpen >= 8 && d.daysOpen <= 14).length },
      { label: '15–30 days', count: openDemands.filter((d) => d.daysOpen >= 15 && d.daysOpen <= 30).length },
      { label: '30+ days',   count: openDemands.filter((d) => d.daysOpen > 30).length }
    ];
    const maxBucketCount = Math.max(...agingBuckets.map((b) => b.count), 1);
    const avgDaysOpen = openDemands.length
      ? Math.round(openDemands.reduce((s, d) => s + d.daysOpen, 0) / openDemands.length)
      : 0;
    const oldestOpenDays = openDemands[0]?.daysOpen ?? 0;

    return { openDemands, staleDemands, agingBuckets, maxBucketCount, avgDaysOpen, oldestOpenDays };
  }, [metrics, metricsFilters]);

  const managerCallDemands = useMemo(() => {
    return demands
      .filter((item) => managerCallFulfillmentStages.includes(item.fulfillmentStage || ''))
      .sort((a, b) => {
        const aDate = a.needDate ?? a.dueDate ?? '';
        const bDate = b.needDate ?? b.dueDate ?? '';
        return aDate.localeCompare(bDate);
      });
  }, [demands]);

  const managerCallSpreadsheetDemands = useMemo(
    () => managerCallDemands.filter((item) => matchesSpreadsheetColumnFilters(item, spreadsheetColumnFilters)),
    [managerCallDemands, spreadsheetColumnFilters]
  );

  const allOpenDemands = useMemo(() => {
    return demands
      .filter((item) => (item.state ?? item.status) === 'Open')
      .sort((a, b) => {
        const aDate = a.needDate ?? a.dueDate ?? '';
        const bDate = b.needDate ?? b.dueDate ?? '';
        return aDate.localeCompare(bDate);
      });
  }, [demands]);

  const allOpenSpreadsheetDemands = useMemo(
    () => allOpenDemands.filter((item) => matchesSpreadsheetColumnFilters(item, spreadsheetColumnFilters)),
    [allOpenDemands, spreadsheetColumnFilters]
  );

  const openDestaffRecords = useMemo(() => {
    return destaffRecords.filter((r) => r.status === 'Available' || r.status === 'Interviewing');
  }, [destaffRecords]);

  const managerCallMetrics = useMemo(() => {
    const byStage = managerCallFulfillmentStages.map((stage) => ({
      stage,
      count: managerCallDemands.filter((item) => (item.fulfillmentStage || '') === stage).length
    }));

    const byOrg = functionalOrgOptions.map((org) => ({
      org,
      count: managerCallDemands.filter((item) => (item.funcOrg || '') === org).length
    }));

    return {
      total: managerCallDemands.length,
      open: managerCallDemands.filter((item) => (item.state ?? item.status) === 'Open').length,
      blocked: managerCallDemands.filter((item) => (item.state ?? item.status) === 'Blocked').length,
      byStage,
      byOrg
    };
  }, [managerCallDemands]);

  function resetForm(stayOnPage = false) {
    const defaults = getDefaultForm();
    setForm(defaults);
    setBaselineForm(defaults);
    setEditId(null);
    setCurrentStep(0);
    setAttemptedSteps({});
    setCsvImportRows([]);
    setCsvImportName('');
    setCsvImportStatus('');
    if (!stayOnPage) {
      setPage(pages.dashboard);
    }
  }

  function shouldLeaveIntake() {
    if (page !== pages.addDemand || !isDirty) return true;
    return window.confirm('You have unsaved changes. Leave this page and discard them?');
  }

  function goToDashboard() {
    if (!shouldLeaveIntake()) return;
    setPage(pages.dashboard);
  }

  function goToMetrics() {
    if (!shouldLeaveIntake()) return;
    setDashboardScope(null);
    setPage(pages.metrics);
  }

  function goToAllOpenDemands() {
    setPage(pages.allOpen);
  }

  function goToAllDestaff() {
    setPage(pages.allDestaff);
  }

  function goToManagerCallMetrics() {
    if (!shouldLeaveIntake()) return;
    setDashboardScope(null);
    setPage(pages.managerCallMetrics);
  }

  function openSpreadsheetForDemands(ids, label) {
    if (!shouldLeaveIntake()) return;

    const dedupedIds = [...new Set((ids || []).filter(Boolean))];
    if (dedupedIds.length === 0) {
      setAppStatus('No matching demands found for this metric.');
      return;
    }

    setFilters({ query: '', status: 'All', priority: 'All' });
    setDashboardScope({ ids: dedupedIds, label });
    setDemandViewMode('spreadsheet');
    setPage(pages.dashboard);
    setAppStatus(`Spreadsheet showing ${dedupedIds.length} demand${dedupedIds.length === 1 ? '' : 's'}: ${label}.`);
  }

  function clearDashboardScope() {
    setDashboardScope(null);
    setAppStatus('Showing all demands.');
  }

  function goToDestaff() {
    if (!shouldLeaveIntake()) return;
    setPage(pages.destaff);
  }

  function goToAdminUsers() {
    if (!isAdmin || !shouldLeaveIntake()) return;
    setPage(pages.adminUsers);
  }

  function updateDestaffField(field, value) {
    setDestaffForm((prev) => ({ ...prev, [field]: value }));
  }

  function submitDestaffForm(event) {
    event.preventDefault();
    if (!destaffForm.employeeName.trim()) {
      setDestaffStatus('Employee name is required.');
      return;
    }
    if (!destaffForm.currentProgram.trim()) {
      setDestaffStatus('Current program is required.');
      return;
    }
    const now = new Date().toISOString();
    if (editingDestaffId) {
      setDestaffRecords((current) =>
        current.map((r) =>
          r.id === editingDestaffId
            ? {
                ...r,
                ...destaffForm,
                updatedAt: now,
                updatedByUserId: currentUser.id,
                updatedByName: currentUser.displayName
              }
            : r
        )
      );
      setEditingDestaffId(null);
      setDestaffStatus('Record updated.');
    } else {
      const record = {
        id: crypto.randomUUID(),
        ...destaffForm,
        createdAt: now,
        updatedAt: now,
        createdByUserId: currentUser.id,
        createdByName: currentUser.displayName
      };
      setDestaffRecords((current) => [record, ...current]);
      setDestaffStatus('Person added to destaff list.');
    }
    setDestaffForm(getDefaultDestaffForm());
  }

  function startEditDestaff(record) {
    setDestaffForm({
      employeeName: record.employeeName || '',
      currentProgram: record.currentProgram || '',
      currentRole: record.currentRole || '',
      funcOrg: record.funcOrg || '',
      clearance: record.clearance || 'Not Required',
      availableDate: record.availableDate || '',
      skills: record.skills || '',
      notes: record.notes || '',
      status: record.status || 'Available',
      hiringManager: record.hiringManager || ''
    });
    setEditingDestaffId(record.id);
    setDestaffStatus('');
  }

  function cancelEditDestaff() {
    setDestaffForm(getDefaultDestaffForm());
    setEditingDestaffId(null);
    setDestaffStatus('');
  }

  function removeDestaffRecord(id) {
    setDestaffRecords((current) => current.filter((r) => r.id !== id));
  }

  function updateDestaffRecordStatus(id, newStatus) {
    const now = new Date().toISOString();
    setDestaffRecords((current) =>
      current.map((r) =>
        r.id === id
          ? { ...r, status: newStatus, updatedAt: now, updatedByUserId: currentUser.id, updatedByName: currentUser.displayName }
          : r
      )
    );
  }

  function exportStaleToCsv() {
    const rows = filteredMetrics.staleDemands.map((item) => ({
      'Demand ID': item.demandId || '',
      Title: item.demandTitle || '',
      Status: item.state ?? item.status ?? '',
      Priority: item.priority || '',
      'Functional Org': item.funcOrg || '',
      Project: item.project || '',
      'Position Title': item.positionTitle || '',
      'Hiring Manager': item.hiringManager || '',
      'Days Open': item.daysOpen,
      'Days Since Update': item.daysSinceUpdate ?? '',
      'Last Updated': item.lastUpdatedAt ? new Date(item.lastUpdatedAt).toLocaleDateString() : '',
      'Need Date': item.needDate || '',
      'Created By': item.createdByName || ''
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `stale-demands-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function openDemandDetails(id) {
    const demand = demands.find((item) => item.id === id) ?? null;
    setSelectedDemandId(id);
    setDetailEdits(canEditFunctionalInfo && demand ? { ...demand } : null);
    setNewComment('');
  }

  function closeDemandDetails() {
    setSelectedDemandId(null);
    setDetailEdits(null);
    setNewComment('');
    setEditingCommentId(null);
    setEditingCommentText('');
  }

  function startDetailEdit() {
    if (!selectedDemand) return;
    setDetailEdits({ ...selectedDemand });
  }

  function cancelDetailEdit() {
    setDetailEdits(null);
  }

  function updateDetailField(field, value) {
    setDetailEdits((prev) => {
      if (!prev) return prev;

      if (field === 'state' || field === 'status') {
        const normalized = normalizeStatusForFulfillmentStage(value, prev.fulfillmentStage);
        return {
          ...prev,
          state: normalized,
          status: normalized
        };
      }

      if (field === 'fulfillmentStage') {
        const normalized = normalizeStatusForFulfillmentStage(prev.state || prev.status, value);
        return {
          ...prev,
          fulfillmentStage: value,
          state: normalized,
          status: normalized
        };
      }

      return { ...prev, [field]: value };
    });
  }

  function saveDetailEdits() {
    if (!detailEdits || !selectedDemandId) return;
    const normalizedState = normalizeStatusForFulfillmentStage(
      detailEdits.state || detailEdits.status,
      detailEdits.fulfillmentStage
    );

    const normalizedDetailEdits = {
      ...detailEdits,
      state: normalizedState,
      status: normalizedState
    };

    setDemands((current) =>
      current.map((item) =>
        item.id === selectedDemandId
          ? (() => {
              const changedFields = diffDemandFields(item, normalizedDetailEdits);
              return {
                ...item,
                ...normalizedDetailEdits,
                updatedAt: new Date().toISOString(),
                updatedByUserId: currentUser.id,
                updatedByName: currentUser.displayName,
                history: appendDemandHistory(item, {
                  action: 'detail-edit',
                  actorId: currentUser.id,
                  actorName: currentUser.displayName,
                  changedFields,
                  timestamp: new Date().toISOString()
                })
              };
            })()
          : item
      )
    );
    setDetailEdits(null);
  }

  function onCsvImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = (result.data ?? [])
          .map((row) => ({
            demandId: String(row.demandId ?? row.DemandID ?? row.id ?? '').trim(),
            demandTitle: String(row.demandTitle ?? row.title ?? '').trim(),
            programPoc: String(row.programPoc ?? '').trim(),
            needDate: String(row.needDate ?? '').trim(),
            project: String(row.project ?? '').trim(),
            positionTitle: String(row.positionTitle ?? '').trim(),
            funcOrg: String(row.funcOrg ?? '').trim(),
            priority: String(row.priority ?? '').trim(),
            state: String(row.state ?? '').trim()
          }))
          .filter((row) => row.demandId);

        if (rows.length === 0) {
          setCsvImportRows([]);
          setCsvImportName('');
          setCsvImportStatus('CSV must include at least one row with a demandId column.');
          return;
        }

        if (rows.length > 10) {
          setCsvImportRows([]);
          setCsvImportName('');
          setCsvImportStatus('CSV import is limited to 10 rows at a time.');
          return;
        }

        setCsvImportRows(rows);
        setCsvImportName(file.name);
        setCsvImportStatus(`${rows.length} demand row${rows.length > 1 ? 's' : ''} ready for import.`);
      },
      error: () => {
        setCsvImportRows([]);
        setCsvImportName('');
        setCsvImportStatus('Unable to parse CSV file.');
      }
    });

    event.target.value = '';
  }

  function clearCsvImport() {
    setCsvImportRows([]);
    setCsvImportName('');
    setCsvImportStatus('CSV import cleared.');
  }

  function openAddDemand() {
    if (!canCreateDemand) return;
    if (!shouldLeaveIntake()) return;
    const defaults = { ...getDefaultForm(), demandId: getNextDemandId(demands) };
    setEditId(null);
    setAttemptedSteps({});
    setForm(defaults);
    setBaselineForm(defaults);
    setCurrentStep(0);
    setDraftStatus('');
    setCsvImportRows([]);
    setCsvImportName('');
    setCsvImportStatus('');
    setPage(pages.addDemand);
  }

  function getRequirementsForStep(stepIndex) {
    const step = activeWizardSteps[stepIndex];
    if (!step) return [];
    return stepRequirementsById[step.id] ?? [];
  }

  function canProceedFromStep(stepIndex) {
    return getMissingForStep(stepIndex).length === 0;
  }

  function getMissingForStep(stepIndex) {
    const requirements = getRequirementsForStep(stepIndex);
    return requirements.filter((item) => isBlank(form[item.field])).map((item) => item.label);
  }

  function getFieldError(field, label) {
    if (!attemptedSteps[currentStep]) return '';
    const inCurrentStep = getRequirementsForStep(currentStep).some((item) => item.field === field);
    if (!inCurrentStep) return '';
    if (!isBlank(form[field])) return '';
    return `${label} is required.`;
  }

  function markStepAttempted(stepIndex) {
    setAttemptedSteps((current) => ({ ...current, [stepIndex]: true }));
  }

  function nextStep() {
    if (currentStep >= activeWizardSteps.length - 1) return;
    if (!canProceedFromStep(currentStep)) {
      markStepAttempted(currentStep);
      return;
    }
    setCurrentStep((step) => step + 1);
    setDraftStatus('');
  }

  function prevStep() {
    if (currentStep <= 0) return;
    setCurrentStep((step) => step - 1);
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (!canProceedFromStep(currentStep)) {
      markStepAttempted(currentStep);
      return;
    }

    const normalized = normalizeDemand(form);
    if (!normalized.demandTitle || !normalized.owner || !normalized.needDate) return;

    if (editId) {
      const target = demands.find((item) => item.id === editId);
      if (!target || !canEditDemand(target)) {
        setDraftStatus('You are not authorized to edit this demand.');
        return;
      }
      setDemands((current) =>
        current.map((item) =>
          item.id === editId
            ? (() => {
                const next = { ...item, ...normalized };
                const changedFields = diffDemandFields(item, next);
                return {
                  ...next,
                  updatedAt: new Date().toISOString(),
                  updatedByUserId: currentUser.id,
                  updatedByName: currentUser.displayName,
                  history: appendDemandHistory(item, {
                    action: 'edit',
                    actorId: currentUser.id,
                    actorName: currentUser.displayName,
                    changedFields,
                    timestamp: new Date().toISOString()
                  })
                };
              })()
            : item
        )
      );
    } else {
      if (!canCreateDemand) {
        setDraftStatus('You are not authorized to create a demand.');
        return;
      }

      const bulkCount = csvImportRows.length > 0 ? csvImportRows.length : Math.max(1, Math.min(Number(form.bulkCount) || 1, 10));
      const createdAt = new Date().toISOString();
      const startingNum = parseInt(String(form.demandId).replace(/\D/g, ''), 10) || parseInt(getNextDemandId(demands), 10);
      const createdDemands = Array.from({ length: bulkCount }, (_, index) => {
        const csvRow = csvImportRows[index];
        const demandId = csvRow?.demandId || buildDemandId(startingNum, index);
        const demandTitle =
          csvRow?.demandTitle || (bulkCount > 1 ? `${normalized.demandTitle} ${index + 1}` : normalized.demandTitle);
        const demandPayload = {
          ...normalized,
          demandId,
          demandTitle,
          programPoc: csvRow?.programPoc || normalized.programPoc,
          needDate: csvRow?.needDate || normalized.needDate,
          project: csvRow?.project || normalized.project,
          positionTitle: csvRow?.positionTitle || normalized.positionTitle,
          funcOrg: csvRow?.funcOrg || normalized.funcOrg,
          priority: csvRow?.priority || normalized.priority,
          state: normalizeStatusForFulfillmentStage(csvRow?.state || normalized.state, normalized.fulfillmentStage),
          status: normalizeStatusForFulfillmentStage(csvRow?.state || normalized.state, normalized.fulfillmentStage),
          dueDate: csvRow?.needDate || normalized.needDate,
          notes: csvRow?.demandTitle ? normalized.notes : normalized.notes
        };

        return {
          id: crypto.randomUUID(),
          ...demandPayload,
          createdAt,
          updatedAt: createdAt,
          createdByUserId: currentUser.id,
          createdByName: currentUser.displayName,
          createdByEmail: currentUser.email,
          createdByRole: currentUser.role,
          updatedByUserId: currentUser.id,
          updatedByName: currentUser.displayName,
          history: [
            {
              id: crypto.randomUUID(),
              action: 'create',
              actorId: currentUser.id,
              actorName: currentUser.displayName,
              changedFields: ['all'],
              timestamp: createdAt
            }
          ],
          comments: []
        };
      });

      setDemands((current) => [...createdDemands, ...current]);

      await notifyDemandCreated(createdDemands);
      setAppStatus(`Created ${createdDemands.length} demand${createdDemands.length > 1 ? 's' : ''} successfully.`);

      setCsvImportRows([]);
      setCsvImportName('');
      setCsvImportStatus('');
    }

    clearDraftSnapshot();
    setHasDraft(false);
    setDraftUpdatedAt('');
    setDraftStatus('');

    resetForm();
  }

  function startEdit(item) {
    if (!shouldLeaveIntake()) return;
    if (!canEditDemand(item)) {
      setDraftStatus('You are not authorized to edit this demand.');
      return;
    }
    const mergedForm = { ...getDefaultForm(), ...item };
    setEditId(item.id);
    setCurrentStep(0);
    setAttemptedSteps({});
    setDraftStatus('');
    setCsvImportRows([]);
    setCsvImportName('');
    setCsvImportStatus('');
    setPage(pages.addDemand);
    setForm(mergedForm);
    setBaselineForm(mergedForm);
  }

  function removeDemand(id) {
    const target = demands.find((item) => item.id === id);
    if (!target || !canDeleteDemand(target)) return;
    if (id === editId) resetForm();
    setDemands((current) => current.filter((item) => item.id !== id));
    setSubscriptions((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function markDone(id) {
    const target = demands.find((item) => item.id === id);
    if (!target || !canMarkDoneDemand(target)) return;
    setDemands((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              state: 'Done',
              status: 'Done',
              updatedAt: new Date().toISOString(),
              updatedByUserId: currentUser.id,
              updatedByName: currentUser.displayName,
              history: appendDemandHistory(item, {
                action: 'mark-done',
                actorId: currentUser.id,
                actorName: currentUser.displayName,
                changedFields: ['state', 'status'],
                timestamp: new Date().toISOString()
              })
            }
          : item
      )
    );
  }

  function canManageComment(comment) {
    if (!currentUser) return false;
    if (effectiveRole === 'administrator' || effectiveRole === 'hiring-manager') return true;
    return comment.authorEmail === currentUser.email;
  }

  function addCommentToDemand() {
    if (!selectedDemand || !newComment.trim()) return;

    const comment = {
      id: crypto.randomUUID(),
      message: newComment.trim(),
      authorName: currentUser.displayName,
      authorEmail: currentUser.email,
      createdAt: new Date().toISOString()
    };

    setDemands((current) =>
      current.map((item) =>
        item.id === selectedDemand.id
          ? {
              ...item,
              comments: [...(Array.isArray(item.comments) ? item.comments : []), comment],
              updatedAt: new Date().toISOString(),
              updatedByUserId: currentUser.id,
              updatedByName: currentUser.displayName,
              history: appendDemandHistory(item, {
                action: 'comment-add',
                actorId: currentUser.id,
                actorName: currentUser.displayName,
                changedFields: ['comments'],
                timestamp: new Date().toISOString()
              })
            }
          : item
      )
    );

    setNewComment('');
  }

  function startCommentEdit(comment) {
    if (!canManageComment(comment)) return;
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.message);
  }

  function saveCommentEdit() {
    if (!selectedDemand || !editingCommentId || !editingCommentText.trim()) return;

    setDemands((current) =>
      current.map((item) =>
        item.id === selectedDemand.id
          ? {
              ...item,
              comments: (item.comments ?? []).map((comment) =>
                comment.id === editingCommentId
                  ? {
                      ...comment,
                      message: editingCommentText.trim(),
                      editedAt: new Date().toISOString()
                    }
                  : comment
              ),
              updatedAt: new Date().toISOString(),
              updatedByUserId: currentUser.id,
                updatedByName: currentUser.displayName,
                history: appendDemandHistory(item, {
                  action: 'comment-edit',
                  actorId: currentUser.id,
                  actorName: currentUser.displayName,
                  changedFields: ['comments'],
                  timestamp: new Date().toISOString()
                })
            }
          : item
      )
    );

    setEditingCommentId(null);
    setEditingCommentText('');
  }

  function deleteComment(commentId) {
    if (!selectedDemand) return;

    const target = (selectedDemand.comments ?? []).find((comment) => comment.id === commentId);
    if (!target || !canManageComment(target)) return;

    setDemands((current) =>
      current.map((item) =>
        item.id === selectedDemand.id
          ? {
              ...item,
              comments: (item.comments ?? []).filter((comment) => comment.id !== commentId),
              updatedAt: new Date().toISOString(),
              updatedByUserId: currentUser.id,
                updatedByName: currentUser.displayName,
                history: appendDemandHistory(item, {
                  action: 'comment-delete',
                  actorId: currentUser.id,
                  actorName: currentUser.displayName,
                  changedFields: ['comments'],
                  timestamp: new Date().toISOString()
                })
            }
          : item
      )
    );

    if (editingCommentId === commentId) {
      setEditingCommentId(null);
      setEditingCommentText('');
    }
  }

  function onLogin(event) {
    event.preventDefault();
    const email = authForm.email.trim().toLowerCase();
    const user = users.find(
      (entry) =>
        entry.email.toLowerCase() === email &&
        entry.password === authForm.password
    );

    if (!user) {
      setAuthError('Invalid email or password.');
      return;
    }

    const sessionUser = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      role: user.role,
      previewRole: user.role,
      email: user.email,
      funcOrg: user.funcOrg
    };

    setCurrentUser(sessionUser);
    saveAuthSession(sessionUser);
    setAuthForm({ email: '', password: '' });
    setAuthError('');
    setPage(pages.dashboard);
  }

  function onCreateAccount(event) {
    event.preventDefault();

    const firstName = signupForm.firstName.trim();
    const lastName = signupForm.lastName.trim();
    const email = signupForm.email.trim().toLowerCase();
    const funcOrg = signupForm.funcOrg;
    const password = signupForm.password;

    if (!firstName || !lastName || !email || !funcOrg || !password || !signupForm.confirmPassword) {
      setSignupError('All fields are required.');
      return;
    }

    if (!isEmail(email)) {
      setSignupError('Enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      setSignupError('Password must be at least 8 characters.');
      return;
    }

    if (password !== signupForm.confirmPassword) {
      setSignupError('Passwords do not match.');
      return;
    }

    const emailTaken = users.some((item) => item.email?.toLowerCase() === email);
    if (emailTaken) {
      setSignupError('Email already exists.');
      return;
    }

    if (!functionalOrgOptions.includes(funcOrg)) {
      setSignupError('Select a valid functional group.');
      return;
    }

    const displayName = getUserDisplayName({ firstName, lastName });

    const createdUser = {
      id: crypto.randomUUID(),
      firstName,
      lastName,
      displayName,
      email,
      funcOrg,
      password,
      role: 'basic'
    };

    setUsers((current) => [...current, createdUser]);

    const sessionUser = {
      id: createdUser.id,
      firstName: createdUser.firstName,
      lastName: createdUser.lastName,
      displayName: createdUser.displayName,
      role: createdUser.role,
      previewRole: createdUser.role,
      email: createdUser.email,
      funcOrg: createdUser.funcOrg
    };

    setCurrentUser(sessionUser);
    saveAuthSession(sessionUser);
    setSignupForm({
      firstName: '',
      lastName: '',
      email: '',
      funcOrg: '',
      password: '',
      confirmPassword: ''
    });
    setSignupError('');
    setAuthError('');
    setAuthMode('signin');
    setPage(pages.dashboard);
  }

  function onLogout() {
    if (!shouldLeaveIntake()) return;
    setCurrentUser(null);
    clearAuthSession();
    setPage(pages.dashboard);
    setCurrentStep(0);
    setEditId(null);
    setAttemptedSteps({});
    setDraftStatus('');
  }

  function resetUserForm() {
    setUserForm({
      firstName: '',
      lastName: '',
      email: '',
      funcOrg: '',
      password: '',
      role: 'basic'
    });
    setEditingUserId(null);
  }

  function submitUserForm(event) {
    event.preventDefault();
    if (!isAdmin) return;

    const firstName = userForm.firstName.trim();
    const lastName = userForm.lastName.trim();
    const email = userForm.email.trim().toLowerCase();
    const funcOrg = userForm.funcOrg;
    const password = userForm.password;

    if (!firstName || !lastName || !email || !funcOrg) {
      setUserStatus('First name, last name, email, and functional group are required.');
      return;
    }

    if (!isEmail(email)) {
      setUserStatus('Enter a valid email address.');
      return;
    }

    if (!functionalOrgOptions.includes(funcOrg)) {
      setUserStatus('Select a valid functional group.');
      return;
    }

    const duplicateEmail = users.some((item) => item.email.toLowerCase() === email && item.id !== editingUserId);
    if (duplicateEmail) {
      setUserStatus('Email already exists.');
      return;
    }

    const displayName = getUserDisplayName({ firstName, lastName });

    if (!editingUserId && !password) {
      setUserStatus('Password is required for a new user.');
      return;
    }

    if (editingUserId) {
      const target = users.find((item) => item.id === editingUserId);
      if (!target) {
        setUserStatus('User was not found.');
        return;
      }

      if (target.id === currentUser.id && target.role === 'administrator' && userForm.role !== 'administrator' && adminCount <= 1) {
        setUserStatus('At least one administrator is required.');
        return;
      }

      setUsers((current) =>
        current.map((item) =>
          item.id === editingUserId
            ? {
                ...item,
                firstName,
                lastName,
                displayName,
                email,
                funcOrg,
                role: userForm.role,
                password: password || item.password
              }
            : item
        )
      );
      setUserStatus('User updated.');
    } else {
      setUsers((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          firstName,
          lastName,
          displayName,
          email,
          funcOrg,
          password,
          role: userForm.role
        }
      ]);
      setUserStatus('User created.');
    }

    resetUserForm();
  }

  function beginEditUser(user) {
    if (!isAdmin) return;
    setEditingUserId(user.id);
    setUserForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      funcOrg: user.funcOrg || '',
      password: '',
      role: user.role
    });
    setUserStatus('Editing user. Leave password blank to keep current password.');
  }

  function removeUser(userId) {
    if (!isAdmin) return;

    const target = users.find((item) => item.id === userId);
    if (!target) return;

    if (target.id === currentUser.id) {
      setUserStatus('You cannot delete your own active account.');
      return;
    }

    if (target.role === 'administrator' && adminCount <= 1) {
      setUserStatus('At least one administrator is required.');
      return;
    }

    const confirmed = window.confirm(`Delete user ${target.displayName}?`);
    if (!confirmed) return;

    setUsers((current) => current.filter((item) => item.id !== userId));
    setSubscriptions((current) => {
      const next = {};
      for (const [demandId, subscriberIds] of Object.entries(current)) {
        const filtered = subscriberIds.filter((id) => id !== userId);
        if (filtered.length > 0) next[demandId] = filtered;
      }
      return next;
    });
    if (editingUserId === userId) {
      resetUserForm();
    }
    setUserStatus('User removed.');
  }

  function resetGroupForm() {
    setGroupForm({ name: '', description: '', memberIds: [] });
    setEditingGroupId(null);
  }

  function updateGroupField(field, value) {
    setGroupForm((current) => ({ ...current, [field]: value }));
  }

  function toggleGroupMember(memberId) {
    setGroupForm((current) => {
      const exists = current.memberIds.includes(memberId);
      return {
        ...current,
        memberIds: exists
          ? current.memberIds.filter((item) => item !== memberId)
          : [...current.memberIds, memberId]
      };
    });
  }

  function beginEditGroup(group) {
    if (!isAdmin) return;
    setEditingGroupId(group.id);
    setGroupForm({
      name: group.name,
      description: group.description || '',
      memberIds: group.memberIds
    });
    setGroupStatus('Editing group.');
  }

  function submitGroupForm(event) {
    event.preventDefault();
    if (!isAdmin) return;

    const name = groupForm.name.trim();
    if (!name) {
      setGroupStatus('Group name is required.');
      return;
    }

    const duplicate = hiringManagerGroups.some(
      (group) => group.name.toLowerCase() === name.toLowerCase() && group.id !== editingGroupId
    );

    if (duplicate) {
      setGroupStatus('Group name already exists.');
      return;
    }

    const now = new Date().toISOString();

    if (editingGroupId) {
      setHiringManagerGroups((current) =>
        current.map((group) =>
          group.id === editingGroupId
            ? {
                ...group,
                name,
                description: groupForm.description.trim(),
                memberIds: [...new Set(groupForm.memberIds)],
                updatedAt: now
              }
            : group
        )
      );
      setGroupStatus('Hiring manager group updated.');
    } else {
      setHiringManagerGroups((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          name,
          description: groupForm.description.trim(),
          memberIds: [...new Set(groupForm.memberIds)],
          createdAt: now,
          updatedAt: now
        }
      ]);
      setGroupStatus('Hiring manager group created.');
    }

    resetGroupForm();
  }

  function removeGroup(groupId) {
    if (!isAdmin) return;

    const target = hiringManagerGroups.find((group) => group.id === groupId);
    if (!target) return;

    const confirmed = window.confirm(`Delete group ${target.name}?`);
    if (!confirmed) return;

    setHiringManagerGroups((current) => current.filter((group) => group.id !== groupId));
    if (editingGroupId === groupId) {
      resetGroupForm();
    }
    if (selectedGroupId === groupId) {
      setSelectedGroupId(null);
    }
    setGroupStatus('Group removed.');
  }

  function updateGroupFilter(field, value) {
    setGroupFilters((current) => ({ ...current, [field]: value }));
  }

  function clearGroupFilters() {
    setGroupFilters({ memberCount: 'all', workload: 'all', query: '' });
  }

  function openGroupDetails(groupId) {
    setSelectedGroupId(groupId);
  }

  function closeGroupDetails() {
    setSelectedGroupId(null);
  }

  function viewManagerDemandsFromGroup(member) {
    const matchText = member.displayName || member.email || '';
    if (!matchText) return;

    if (!shouldLeaveIntake()) return;

    setFilters({
      query: matchText,
      status: 'All',
      priority: 'All'
    });
    setPage(pages.dashboard);
    setAppStatus(`Showing demands filtered for hiring manager: ${matchText}`);
    closeGroupDetails();
  }

  if (!currentUser) {
    return (
      <main className="page auth-page">
        <section className="panel auth-panel">
          <p className="eyebrow">Demand HQ</p>
          <h1 className="topbar-title">{authMode === 'signin' ? 'Sign In' : 'Create Account'}</h1>
          <p className="subhead">
            {authMode === 'signin'
              ? 'Authentication and authorization are enabled. Use your credentials to continue.'
              : 'Create a new Basic account. Hiring Manager and Administrator roles are assigned by an admin.'}
          </p>

          <div className="auth-switch">
            <button
              type="button"
              className={`btn-nav ${authMode === 'signin' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('signin');
                setSignupError('');
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`btn-nav ${authMode === 'signup' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('signup');
                setAuthError('');
              }}
            >
              Create Account
            </button>
          </div>

          {authMode === 'signin' ? (
            <form onSubmit={onLogin} className="auth-form">
              <label>
                Email
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="Enter email"
                  autoComplete="email"
                />
              </label>
              <label>
                Password
                <input
                  type={showSignInPassword ? 'text' : 'password'}
                  value={authForm.password}
                  onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder="Enter password"
                  autoComplete="current-password"
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showSignInPassword}
                  onChange={(event) => setShowSignInPassword(event.target.checked)}
                />
                Show password
              </label>
              {authError && <p className="field-error">{authError}</p>}
              <button type="submit" className="btn-primary">
                Sign In
              </button>
            </form>
          ) : (
            <form onSubmit={onCreateAccount} className="auth-form">
              <label>
                First Name
                <input
                  value={signupForm.firstName}
                  onChange={(event) =>
                    setSignupForm((current) => ({ ...current, firstName: event.target.value }))
                  }
                  placeholder="Enter first name"
                  autoComplete="given-name"
                />
              </label>
              <label>
                Last Name
                <input
                  value={signupForm.lastName}
                  onChange={(event) =>
                    setSignupForm((current) => ({ ...current, lastName: event.target.value }))
                  }
                  placeholder="Enter last name"
                  autoComplete="family-name"
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={signupForm.email}
                  onChange={(event) => setSignupForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="Enter email"
                  autoComplete="email"
                />
              </label>
              <label>
                Functional Group
                <select
                  value={signupForm.funcOrg}
                  onChange={(event) => setSignupForm((current) => ({ ...current, funcOrg: event.target.value }))}
                >
                  <option value="">Select group</option>
                  {functionalOrgOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label>
                Password
                <input
                  type={showSignupPassword ? 'text' : 'password'}
                  value={signupForm.password}
                  onChange={(event) =>
                    setSignupForm((current) => ({ ...current, password: event.target.value }))
                  }
                  placeholder="Create password"
                  autoComplete="new-password"
                />
              </label>
              <label>
                Confirm Password
                <input
                  type={showSignupPassword ? 'text' : 'password'}
                  value={signupForm.confirmPassword}
                  onChange={(event) =>
                    setSignupForm((current) => ({ ...current, confirmPassword: event.target.value }))
                  }
                  placeholder="Confirm password"
                  autoComplete="new-password"
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showSignupPassword}
                  onChange={(event) => setShowSignupPassword(event.target.checked)}
                />
                Show passwords
              </label>
              {signupError && <p className="field-error">{signupError}</p>}
              <button type="submit" className="btn-primary">
                Create Account
              </button>
            </form>
          )}

        </section>
      </main>
    );
  }

  function updateField(field, value) {
    setForm((current) => {
      if (field === 'state') {
        return {
          ...current,
          state: normalizeStatusForFulfillmentStage(value, current.fulfillmentStage)
        };
      }

      if (field === 'fulfillmentStage') {
        return {
          ...current,
          fulfillmentStage: value,
          state: normalizeStatusForFulfillmentStage(current.state, value)
        };
      }

      return { ...current, [field]: value };
    });
  }

  function saveDraft() {
    const snapshot = {
      form,
      currentStep,
      updatedAt: new Date().toISOString()
    };
    saveDraftSnapshot(snapshot);
    setHasDraft(true);
    setDraftUpdatedAt(snapshot.updatedAt);
    setDraftStatus('Draft saved.');
  }

  function resumeDraft() {
    const snapshot = loadDraftSnapshot();
    if (!snapshot) {
      setHasDraft(false);
      setDraftUpdatedAt('');
      setDraftStatus('No saved draft found.');
      return;
    }

    setEditId(null);
    setAttemptedSteps({});
    const resumedForm = { ...getDefaultForm(), ...snapshot.form };
    setForm(resumedForm);
    setBaselineForm(resumedForm);
    setCurrentStep(Math.max(0, Math.min(Number(snapshot.currentStep) || 0, activeWizardSteps.length - 1)));
    setPage(pages.addDemand);
    setHasDraft(true);
    setDraftUpdatedAt(snapshot.updatedAt ?? '');
    setDraftStatus('Draft loaded.');
  }

  function discardDraft() {
    clearDraftSnapshot();
    setHasDraft(false);
    setDraftUpdatedAt('');
    setDraftStatus('Saved draft removed.');
  }

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <p className="eyebrow">Demand HQ</p>
          <h1 className="topbar-title">Staffing Demand Console</h1>
        </div>
        <div className="topbar-actions">
          <div className="topbar-meta">
            <span className={`role-pill role-${effectiveRole}`}>{roleLabels[effectiveRole]}</span>
            {currentUser.role === 'administrator' && (
              <label className="role-preview-control">
                View as
                <select
                  value={effectiveRole}
                  onChange={(event) => updateRolePreview(event.target.value)}
                >
                  <option value="administrator">Administrator</option>
                  <option value="hiring-manager">Hiring Manager</option>
                  <option value="basic">Basic</option>
                </select>
              </label>
            )}
            <p className="auth-user">{currentUser.displayName} · {currentUser.email}</p>
          </div>
          <div className="topbar-nav">
            <button
              type="button"
              className={`btn-nav ${page === pages.dashboard ? 'active' : ''}`}
              onClick={goToDashboard}
            >
              Dashboard
            </button>
            <button
              type="button"
              className={`btn-nav ${page === pages.metrics ? 'active' : ''}`}
              onClick={goToMetrics}
            >
              Metrics
            </button>
            <button
              type="button"
              className={`btn-nav ${page === pages.managerCallMetrics ? 'active' : ''}`}
              onClick={goToManagerCallMetrics}
            >
              Manager Call Metrics
            </button>
            <button
              type="button"
              className={`btn-nav ${page === pages.allOpen ? 'active' : ''}`}
              onClick={goToAllOpenDemands}
            >
              All Open Demands
            </button>
            <button
              type="button"
              className={`btn-nav ${page === pages.addDemand ? 'active' : ''}`}
              onClick={openAddDemand}
            >
              Add Demand
            </button>
            <button
              type="button"
              className={`btn-nav ${page === pages.destaff ? 'active' : ''}`}
              onClick={goToDestaff}
            >
              Destaff
            </button>
            <button
              type="button"
              className={`btn-nav ${page === pages.allDestaff ? 'active' : ''}`}
              onClick={goToAllDestaff}
            >
              All Open Destaff
            </button>
            {isAdmin && (
              <button
                type="button"
                className={`btn-nav ${page === pages.adminUsers ? 'active' : ''}`}
                onClick={goToAdminUsers}
              >
                Admin Users
              </button>
            )}
            <button type="button" className="btn-nav" onClick={onLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      {isRolePreviewing && (
        <section className="preview-banner" role="status" aria-live="polite">
          Preview mode active. You are signed in as Administrator and currently viewing
          {' '}
          <strong>{roleLabels[effectiveRole]}</strong>
          {' '}
          permissions.
        </section>
      )}

      {page === pages.destaff && (() => {
                const visibleDestaff = destaffRecords.filter((r) => {
                  const matchesSearch =
                    !destaffSearch.trim() ||
                    [r.employeeName, r.currentProgram, r.currentRole, r.skills, r.funcOrg, r.hiringManager]
                      .join(' ')
                      .toLowerCase()
                      .includes(destaffSearch.trim().toLowerCase());
                  const matchesStatus = destaffStatusFilter === 'All' || r.status === destaffStatusFilter;
                  return matchesSearch && matchesStatus;
                });

                return (
                  <>
                    <section className="hero">
                      <h2>Destaff Tracking</h2>
                      <p className="subhead">
                        Track employees who are rolling off programs and need new placement.
                      </p>
                    </section>

                    <section className="metrics-grid" aria-label="Destaff summary">
                      <article className="metric-card">
                        <p>Total</p>
                        <h2>{destaffRecords.length}</h2>
                      </article>
                      <article className="metric-card">
                        <p>Available</p>
                        <h2>{destaffRecords.filter((r) => r.status === 'Available').length}</h2>
                      </article>
                      <article className="metric-card">
                        <p>Interviewing</p>
                        <h2>{destaffRecords.filter((r) => r.status === 'Interviewing').length}</h2>
                      </article>
                      <article className="metric-card">
                        <p>Placed</p>
                        <h2>{destaffRecords.filter((r) => r.status === 'Placed').length}</h2>
                      </article>
                    </section>

                    <div className="destaff-layout">
                      <section className="panel destaff-form-panel">
                        <h3>{editingDestaffId ? 'Edit Record' : 'Add Person'}</h3>
                        <form onSubmit={submitDestaffForm} className="destaff-form">
                          <label>
                            Employee Name <span className="required-mark">*</span>
                            <input
                              value={destaffForm.employeeName}
                              onChange={(e) => updateDestaffField('employeeName', e.target.value)}
                              placeholder="Full name"
                            />
                          </label>
                          <label>
                            Current Program <span className="required-mark">*</span>
                            <input
                              value={destaffForm.currentProgram}
                              onChange={(e) => updateDestaffField('currentProgram', e.target.value)}
                              placeholder="e.g. PGSD C2"
                            />
                          </label>
                          <label>
                            Current Role
                            <input
                              value={destaffForm.currentRole}
                              onChange={(e) => updateDestaffField('currentRole', e.target.value)}
                              placeholder="e.g. Software Engineer"
                            />
                          </label>
                          <div className="field-row">
                            <label>
                              Functional Org
                              <select value={destaffForm.funcOrg} onChange={(e) => updateDestaffField('funcOrg', e.target.value)}>
                                <option value="">Select org</option>
                                {functionalOrgOptions.map((o) => <option key={o}>{o}</option>)}
                              </select>
                            </label>
                            <label>
                              Clearance
                              <select value={destaffForm.clearance} onChange={(e) => updateDestaffField('clearance', e.target.value)}>
                                {destaffClearanceOptions.map((o) => <option key={o}>{o}</option>)}
                              </select>
                            </label>
                          </div>
                          <div className="field-row">
                            <label>
                              Available Date
                              <input
                                type="date"
                                value={destaffForm.availableDate}
                                onChange={(e) => updateDestaffField('availableDate', e.target.value)}
                              />
                            </label>
                            <label>
                              Status
                              <select value={destaffForm.status} onChange={(e) => updateDestaffField('status', e.target.value)}>
                                {destaffStatuses.map((o) => <option key={o}>{o}</option>)}
                              </select>
                            </label>
                          </div>
                          <label>
                            Hiring Manager
                            <input
                              value={destaffForm.hiringManager}
                              onChange={(e) => updateDestaffField('hiringManager', e.target.value)}
                              placeholder="Who is working this placement"
                            />
                          </label>
                          <label>
                            Skills / Qualifications
                            <textarea
                              rows="3"
                              value={destaffForm.skills}
                              onChange={(e) => updateDestaffField('skills', e.target.value)}
                              placeholder="Key skills, certifications, languages"
                            />
                          </label>
                          <label>
                            Notes
                            <textarea
                              rows="2"
                              value={destaffForm.notes}
                              onChange={(e) => updateDestaffField('notes', e.target.value)}
                              placeholder="Context, preferences, constraints"
                            />
                          </label>
                          <div className="actions">
                            <button type="submit" className="btn-primary">
                              {editingDestaffId ? 'Save Changes' : 'Add to List'}
                            </button>
                            {editingDestaffId && (
                              <button type="button" className="btn-secondary" onClick={cancelEditDestaff}>
                                Cancel
                              </button>
                            )}
                          </div>
                          {destaffStatus && <p className="meta">{destaffStatus}</p>}
                        </form>
                      </section>

                      <section className="panel destaff-list-panel">
                        <div className="board-head">
                          <h3>Destaff List</h3>
                        </div>
                        <div className="board-toolbar">
                          <input
                            value={destaffSearch}
                            onChange={(e) => setDestaffSearch(e.target.value)}
                            placeholder="Search name, program, skills…"
                            aria-label="Search destaff records"
                          />
                          <select
                            value={destaffStatusFilter}
                            onChange={(e) => setDestaffStatusFilter(e.target.value)}
                            aria-label="Filter by status"
                          >
                            <option value="All">All Statuses</option>
                            {destaffStatuses.map((o) => <option key={o}>{o}</option>)}
                          </select>
                        </div>
                        <ul className="destaff-list" aria-label="Destaff records">
                          {visibleDestaff.length === 0 && (
                            <li className="empty-state">No records match your filters.</li>
                          )}
                          {visibleDestaff.map((record) => (
                            <li key={record.id} className="destaff-card">
                              <div className="destaff-card-top">
                                <div>
                                  <h4>{record.employeeName}</h4>
                                  <p className="meta">
                                    {record.currentRole || 'No role'} · {record.currentProgram}
                                    {record.funcOrg ? ` · ${record.funcOrg}` : ''}
                                  </p>
                                  <p className="meta">
                                    Clearance: {record.clearance || 'Not set'}
                                    {record.availableDate ? ` · Available: ${record.availableDate}` : ''}
                                    {record.hiringManager ? ` · Mgr: ${record.hiringManager}` : ''}
                                  </p>
                                  {record.skills && <p className="notes">{record.skills}</p>}
                                </div>
                                <span className={`badge destaff-status-${record.status.toLowerCase().replace(' ', '-')}`}>
                                  {record.status}
                                </span>
                              </div>
                              <div className="card-actions">
                                <select
                                  value={record.status}
                                  onChange={(e) => updateDestaffRecordStatus(record.id, e.target.value)}
                                  aria-label="Change status"
                                  className="inline-status-select"
                                >
                                  {destaffStatuses.map((o) => <option key={o}>{o}</option>)}
                                </select>
                                <button type="button" className="text-btn" onClick={() => startEditDestaff(record)}>
                                  Edit
                                </button>
                                {isAdmin && (
                                  <button type="button" className="text-btn danger" onClick={() => removeDestaffRecord(record.id)}>
                                    Delete
                                  </button>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </section>
                    </div>
                  </>
                );
              })()}

              {page === pages.dashboard && (
        <>
          <section className="hero">
            <h2>Operational Demand Dashboard</h2>
            <p className="subhead">
              Use the dashboard to monitor intake pressure and move to Add Demand for full staffing request details.
            </p>
            {appStatus && <p className="meta">{appStatus}</p>}
          </section>

          <section className="metrics-grid" aria-label="Demand metrics">
            <article className="metric-card">
              <p>My Feed Total</p>
              <h2>{dashboardCounts.total}</h2>
            </article>
            <article className="metric-card">
              <p>Open</p>
              <h2>{dashboardCounts.open}</h2>
            </article>
            <article className="metric-card">
              <p>Completed</p>
              <h2>{dashboardCounts.done}</h2>
            </article>
            <article className="metric-card warn">
              <p>Blocked</p>
              <h2>{dashboardCounts.blocked}</h2>
            </article>
            <article className="metric-card">
              <p>Subscribed</p>
              <h2>{dashboardCounts.subscribed}</h2>
            </article>
          </section>

          <section className="panel board-panel dashboard-panel">
            <div className="board-head">
              <h3>Demand Pipeline</h3>
              <div className="card-actions">
                {dashboardScope && (
                  <button type="button" className="btn-secondary" onClick={clearDashboardScope}>
                    Clear Scope ({dashboardScope.label})
                  </button>
                )}
                <button
                  type="button"
                  className={`btn-secondary ${demandViewMode === 'cards' ? 'active-view' : ''}`}
                  onClick={() => setDemandViewMode('cards')}
                >
                  Card View
                </button>
                <button
                  type="button"
                  className={`btn-secondary ${demandViewMode === 'spreadsheet' ? 'active-view' : ''}`}
                  onClick={() => setDemandViewMode('spreadsheet')}
                >
                  Spreadsheet View
                </button>
                <button type="button" className="btn-primary" onClick={openAddDemand}>
                  Add New Demand
                </button>
              </div>
            </div>

            <div className="board-toolbar">
              <input
                value={filters.query}
                onChange={(event) => setFilters((f) => ({ ...f, query: event.target.value }))}
                placeholder="Search title, manager, project, comments"
                aria-label="Search demands"
              />

              <select
                value={filters.status}
                onChange={(event) => setFilters((f) => ({ ...f, status: event.target.value }))}
                aria-label="Filter by status"
              >
                <option>All</option>
                {statuses.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>

              <select
                value={filters.priority}
                onChange={(event) => setFilters((f) => ({ ...f, priority: event.target.value }))}
                aria-label="Filter by priority"
              >
                <option>All</option>
                {priorities.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>

            <div className="feed-scope-tabs" role="tablist" aria-label="Dashboard feed scope">
              <button
                type="button"
                className={`btn-secondary ${dashboardFeedFilter === 'combined' ? 'active-view' : ''}`}
                onClick={() => setDashboardFeedFilter('combined')}
              >
                Combined Feed
              </button>
              <button
                type="button"
                className={`btn-secondary ${dashboardFeedFilter === 'subscribed' ? 'active-view' : ''}`}
                onClick={() => setDashboardFeedFilter('subscribed')}
              >
                Subscribed
              </button>
              <button
                type="button"
                className={`btn-secondary ${dashboardFeedFilter === 'manager' ? 'active-view' : ''}`}
                onClick={() => setDashboardFeedFilter('manager')}
              >
                Hiring Manager
              </button>
              <button
                type="button"
                className={`btn-secondary ${dashboardFeedFilter === 'group-new' ? 'active-view' : ''}`}
                onClick={() => setDashboardFeedFilter('group-new')}
              >
                Group New
              </button>
            </div>

            {demandViewMode === 'cards' ? (
              <ul className="demand-list" aria-label="Demand board">
                {visibleDemands.length === 0 && (
                  <li className="empty-state">No demands match your current filters.</li>
                  )}
                  {visibleDemands.map((item) => (
                    <li
                      key={item.id}
                      className="demand-card"
                      role="button"
                      tabIndex={0}
                      onClick={() => openDemandDetails(item.id)}
                    >
                    <div className="card-top">
                      <h4>{item.demandTitle ?? item.title}</h4>
                      <span className={`badge priority-${item.priority.toLowerCase()}`}>{item.priority}</span>
                    </div>
                    <p className="meta">
                      Hiring Mgr: {item.hiringManager ?? item.owner} · Need Date: {item.needDate ?? item.dueDate} · Req:{' '}
                      {item.reqNumber || 'N/A'}
                    </p>
                    <p className="meta">
                      Project: {item.project || 'Unspecified'} · Position: {item.positionTitle || 'Unspecified'}
                    </p>
                    <p className="meta">
                      Created By: {item.createdByName || 'Legacy data'}
                      {item.createdByEmail ? ` (${item.createdByEmail})` : ''}
                    </p>
                    <p className="notes">{item.notes ?? 'No notes captured.'}</p>
                    <div className="card-bottom">
                      <span className={`badge status-${(item.state ?? item.status).toLowerCase().replace(' ', '-')}`}>
                        {item.state ?? item.status}
                      </span>
                      <div className="card-actions">
                        {(item.state ?? item.status) !== 'Done' && canMarkDoneDemand(item) && (
                          <button type="button" className="text-btn" onClick={(event) => { event.stopPropagation(); markDone(item.id); }}>
                            Mark Done
                          </button>
                        )}
                        <button type="button" className="text-btn" onClick={(event) => { event.stopPropagation(); openDemandDetails(item.id); }}>
                          View Details
                        </button>
                        <button
                          type="button"
                          className={`text-btn ${isSubscribedDemand(item.id) ? 'active-subscription' : ''}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleDemandSubscription(item.id);
                          }}
                        >
                          {isSubscribedDemand(item.id) ? 'Unsubscribe' : 'Subscribe'}
                        </button>
                        {canEditDemand(item) && (
                          <button type="button" className="text-btn" onClick={(event) => { event.stopPropagation(); startEdit(item); }}>
                            Edit
                          </button>
                        )}
                        {canDeleteDemand(item) && (
                          <button type="button" className="text-btn danger" onClick={(event) => { event.stopPropagation(); removeDemand(item.id); }}>
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <div className="card-actions" style={{ marginTop: '0.65rem' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowSpreadsheetCustomizer((current) => !current)}
                  >
                    {showSpreadsheetCustomizer ? 'Hide Customize Options' : 'Show Customize Options'}
                  </button>
                </div>

                {showSpreadsheetCustomizer && (
                  <section className="panel-lite spreadsheet-customizer">
                    <div className="board-head">
                      <h4>Customize Spreadsheet Columns</h4>
                      <div className="card-actions">
                        <button type="button" className="btn-secondary" onClick={resetSpreadsheetColumns}>
                          Reset Defaults
                        </button>
                        <button type="button" className="btn-primary" onClick={saveCurrentSpreadsheetView}>
                          Save View
                        </button>
                      </div>
                    </div>
                    <p className="meta">Drag fields into Selected Columns and reorder them. This layout is saved to your account.</p>

                    <div className="spreadsheet-view-save-row">
                      <input
                        value={viewDraft.name}
                        onChange={(event) => setViewDraft((current) => ({ ...current, name: event.target.value }))}
                        placeholder="View name"
                      />
                      <label className="checkbox-inline">
                        <input
                          type="checkbox"
                          checked={viewDraft.shared}
                          onChange={(event) => setViewDraft((current) => ({ ...current, shared: event.target.checked }))}
                        />
                        Shared view
                      </label>
                    </div>

                    {userAccessibleSpreadsheetViews.length > 0 && (
                      <div className="saved-views-list">
                        <p className="meta"><strong>Saved Views</strong></p>
                        {userAccessibleSpreadsheetViews.map((view) => (
                          <div key={view.id} className="saved-view-item">
                            <span>
                              {view.name} {view.shared ? '(shared)' : '(personal)'}
                            </span>
                            <div className="card-actions">
                              <button type="button" className="text-btn" onClick={() => applySpreadsheetView(view)}>
                                Apply
                              </button>
                              {(view.ownerId === currentUser.id || isAdmin) && (
                                <button type="button" className="text-btn danger" onClick={() => deleteSpreadsheetView(view.id)}>
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="spreadsheet-filters-grid">
                      <label>
                        Program
                        <select
                          value={spreadsheetFilters.project}
                          onChange={(event) => updateSpreadsheetFilter('project', event.target.value)}
                        >
                          <option value="All">All</option>
                          {[...new Set(demands.map((item) => item.project).filter(Boolean))].sort().map((project) => (
                            <option key={project} value={project}>{project}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Functional Org
                        <select
                          value={spreadsheetFilters.funcOrg}
                          onChange={(event) => updateSpreadsheetFilter('funcOrg', event.target.value)}
                        >
                          <option value="All">All</option>
                          {[...new Set(demands.map((item) => item.funcOrg).filter(Boolean))].sort().map((org) => (
                            <option key={org} value={org}>{org}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Hiring Manager
                        <input
                          value={spreadsheetFilters.hiringManager}
                          onChange={(event) => updateSpreadsheetFilter('hiringManager', event.target.value)}
                          placeholder="Filter manager"
                        />
                      </label>
                      <label>
                        Fulfillment Stages
                        <div className="stage-filter-chip-wrap">
                          {managerCallFulfillmentStages.map((stage) => (
                            <label key={stage} className="stage-filter-chip">
                              <input
                                type="checkbox"
                                checked={(spreadsheetFilters.fulfillmentStages || []).includes(stage)}
                                onChange={() => toggleSpreadsheetFulfillmentStage(stage)}
                              />
                              <span>{stage}</span>
                            </label>
                          ))}
                        </div>
                      </label>
                      <label>
                        Group By
                        <select
                          value={spreadsheetFilters.groupBy}
                          onChange={(event) => updateSpreadsheetFilter('groupBy', event.target.value)}
                        >
                          <option value="none">None</option>
                          <option value="project">Program</option>
                          <option value="funcOrg">Functional Org</option>
                          <option value="hiringManager">Hiring Manager</option>
                          <option value="state">Status</option>
                          <option value="priority">Priority</option>
                        </select>
                      </label>
                      <button type="button" className="btn-secondary" onClick={clearSpreadsheetFilters}>
                        Clear Spreadsheet Filters
                      </button>
                    </div>

                    {spreadsheetGroups.length > 0 && (
                      <div className="spreadsheet-groups-summary">
                        {spreadsheetGroups.map((group) => (
                          <div key={group.label} className="spreadsheet-group-card">
                            <strong>{group.label}</strong>
                            <span>Total: {group.total}</span>
                            <span>Open: {group.open}</span>
                            <span>Blocked: {group.blocked}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <section className="bulk-actions-bar">
                      <p className="meta"><strong>Bulk Actions ({selectedSpreadsheetDemandIds.length} selected)</strong></p>
                      <div className="spreadsheet-filters-grid">
                        <label>
                          Status
                          <select
                            value={bulkEdit.status}
                            onChange={(event) => setBulkEdit((current) => ({ ...current, status: event.target.value }))}
                          >
                            <option value="">No change</option>
                            {getStatusOptionsForFulfillmentStage(bulkEdit.fulfillmentStage || '').map((status) => (
                              <option key={status} value={status}>{status}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Priority
                          <select
                            value={bulkEdit.priority}
                            onChange={(event) => setBulkEdit((current) => ({ ...current, priority: event.target.value }))}
                          >
                            <option value="">No change</option>
                            {priorities.map((priority) => (
                              <option key={priority} value={priority}>{priority}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Hiring Manager
                          <input
                            value={bulkEdit.hiringManager}
                            onChange={(event) => setBulkEdit((current) => ({ ...current, hiringManager: event.target.value }))}
                            placeholder="No change"
                          />
                        </label>
                        <label>
                          Fulfillment Stage
                          <select
                            value={bulkEdit.fulfillmentStage}
                            onChange={(event) => setBulkEdit((current) => ({ ...current, fulfillmentStage: event.target.value }))}
                          >
                            <option value="">No change</option>
                            {fulfillmentStages.map((stage) => (
                              <option key={stage} value={stage}>{stage}</option>
                            ))}
                          </select>
                        </label>
                        <button type="button" className="btn-primary" onClick={applySpreadsheetBulkEdit}>
                          Apply Bulk Edit
                        </button>
                      </div>
                    </section>

                    <div className="spreadsheet-customizer-grid">
                      <div>
                        <p className="meta"><strong>Selected Columns</strong></p>
                        <div
                          className="column-chip-zone"
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => handleDropOnSelectedColumns(selectedSpreadsheetFields.length)}
                        >
                          {selectedSpreadsheetFields.map((field, index) => (
                            <div
                              key={field.key}
                              className="column-chip selected"
                              draggable
                              onDragStart={() => startFieldDrag('selected', field.key)}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={() => handleDropOnSelectedColumns(index)}
                            >
                              <span>{field.label}</span>
                              <button
                                type="button"
                                className="text-btn danger"
                                onClick={() => removeSpreadsheetColumn(field.key)}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="meta"><strong>Available Fields</strong></p>
                        <div className="column-chip-zone">
                          {availableSpreadsheetFields.map((field) => (
                            <div
                              key={field.key}
                              className="column-chip"
                              draggable
                              onDragStart={() => startFieldDrag('available', field.key)}
                            >
                              <span>{field.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                <div className="spreadsheet-wrap" aria-label="Demand spreadsheet table">
                  <table className="spreadsheet-table">
                    <thead>
                      <tr>
                        <th>
                          <input
                            type="checkbox"
                            checked={spreadsheetDemands.length > 0 && selectedSpreadsheetDemandIds.length === spreadsheetDemands.length}
                            onChange={toggleSelectAllSpreadsheetRows}
                            aria-label="Select all rows"
                          />
                        </th>
                        {selectedSpreadsheetFields.map((field) => (
                          <th key={field.key}>{field.label}</th>
                        ))}
                        <th>Actions</th>
                      </tr>
                      <tr className="spreadsheet-filter-row">
                        <th>
                          <button type="button" className="text-btn" onClick={clearSpreadsheetColumnFilters}>
                            Clear
                          </button>
                        </th>
                        {selectedSpreadsheetFields.map((field) => (
                          <th key={`filter-${field.key}`}>
                            <input
                              value={spreadsheetColumnFilters[field.key] || ''}
                              onChange={(event) => updateSpreadsheetColumnFilter(field.key, event.target.value)}
                              placeholder={`Filter ${field.label}`}
                              aria-label={`Filter by ${field.label}`}
                            />
                          </th>
                        ))}
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {spreadsheetDemands.length === 0 ? (
                        <tr>
                          <td colSpan={selectedSpreadsheetFields.length + 2} className="empty-state">
                            No demands match your current filters.
                          </td>
                        </tr>
                      ) : (
                        spreadsheetDemands.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <input
                                type="checkbox"
                                checked={selectedSpreadsheetDemandIds.includes(item.id)}
                                onChange={() => toggleSpreadsheetRowSelection(item.id)}
                                aria-label={`Select demand ${item.demandId || item.id}`}
                              />
                            </td>
                            {selectedSpreadsheetFields.map((field) => (
                              <td key={`${item.id}-${field.key}`}>{renderSpreadsheetCell(item, field)}</td>
                            ))}
                            <td>
                              <div className="card-actions">
                                {(item.state ?? item.status) !== 'Done' && canMarkDoneDemand(item) && (
                                  <button type="button" className="text-btn" onClick={() => markDone(item.id)}>
                                    Mark Done
                                  </button>
                                )}
                                <button type="button" className="text-btn" onClick={() => openDemandDetails(item.id)}>
                                  View
                                </button>
                                <button
                                  type="button"
                                  className={`text-btn ${isSubscribedDemand(item.id) ? 'active-subscription' : ''}`}
                                  onClick={() => toggleDemandSubscription(item.id)}
                                >
                                  {isSubscribedDemand(item.id) ? 'Unsub' : 'Sub'}
                                </button>
                                {canEditDemand(item) && (
                                  <button type="button" className="text-btn" onClick={() => startEdit(item)}>
                                    Edit
                                  </button>
                                )}
                                {canDeleteDemand(item) && (
                                  <button type="button" className="text-btn danger" onClick={() => removeDemand(item.id)}>
                                    Delete
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

        </>
      )}

      {page === pages.adminUsers && isAdmin && (
        <>
          <section className="hero">
            <h2>Administrator User Management</h2>
            <p className="subhead">Create accounts, update roles, and manage login access in one place.</p>
          </section>

          <section className="panel users-panel">
            <div className="board-head">
              <div>
                <h3>User Administration</h3>
                <p className="meta">Manage login access and role authorization.</p>
              </div>
              <p className="meta">{users.length} total user{users.length === 1 ? '' : 's'} · {adminCount} admin{adminCount === 1 ? '' : 's'}</p>
            </div>

            <form className="users-form" onSubmit={submitUserForm}>
              <div className="field-row">
                <label>
                  First Name
                  <input
                    value={userForm.firstName}
                    onChange={(event) => setUserForm((current) => ({ ...current, firstName: event.target.value }))}
                  />
                </label>
                <label>
                  Last Name
                  <input
                    value={userForm.lastName}
                    onChange={(event) => setUserForm((current) => ({ ...current, lastName: event.target.value }))}
                  />
                </label>
              </div>

              <div className="field-row">
                <label>
                  Email
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))}
                  />
                </label>
                <label>
                  Functional Group
                  <select
                    value={userForm.funcOrg}
                    onChange={(event) => setUserForm((current) => ({ ...current, funcOrg: event.target.value }))}
                  >
                    <option value="">Select group</option>
                    {functionalOrgOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Password {editingUserId ? '(optional on edit)' : ''}
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))}
                  />
                </label>
                <label>
                  Role
                  <select
                    value={userForm.role}
                    onChange={(event) => setUserForm((current) => ({ ...current, role: event.target.value }))}
                  >
                    <option value="basic">Basic</option>
                    <option value="hiring-manager">Hiring Manager</option>
                    <option value="administrator">Administrator</option>
                  </select>
                </label>
              </div>

              <div className="actions">
                <button type="submit" className="btn-primary">
                  {editingUserId ? 'Update User' : 'Create User'}
                </button>
                {editingUserId && (
                  <button type="button" className="btn-secondary" onClick={resetUserForm}>
                    Cancel Edit
                  </button>
                )}
              </div>
              {userStatus && <p className="meta">{userStatus}</p>}
            </form>

            <ul className="users-list" aria-label="Registered users">
              {users.map((user) => (
                <li key={user.id} className="users-item">
                  <div>
                    <p className="users-name">{user.displayName}</p>
                    <p className="meta">
                      {user.email || 'No email'} · {user.funcOrg || 'No group'} · {roleLabels[user.role]}
                    </p>
                  </div>
                  <div className="card-actions">
                    <button type="button" className="text-btn" onClick={() => beginEditUser(user)}>
                      Edit
                    </button>
                    <button type="button" className="text-btn danger" onClick={() => removeUser(user.id)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel groups-panel">
            <div className="board-head">
              <div>
                <h3>Hiring Manager Groups</h3>
                <p className="meta">Create groups, assign hiring managers, and review each member profile and workload.</p>
              </div>
              <p className="meta">{hiringManagerGroupDetails.length} group{hiringManagerGroupDetails.length === 1 ? '' : 's'}</p>
            </div>

            <div className="groups-filters panel-lite">
              <label>
                Search
                <input
                  value={groupFilters.query}
                  onChange={(event) => updateGroupFilter('query', event.target.value)}
                  placeholder="Search by group or manager"
                />
              </label>
              <label>
                Member Size
                <select
                  value={groupFilters.memberCount}
                  onChange={(event) => updateGroupFilter('memberCount', event.target.value)}
                >
                  <option value="all">All</option>
                  <option value="empty">Empty</option>
                  <option value="small">1-3 members</option>
                  <option value="large">4+ members</option>
                </select>
              </label>
              <label>
                Workload
                <select
                  value={groupFilters.workload}
                  onChange={(event) => updateGroupFilter('workload', event.target.value)}
                >
                  <option value="all">All</option>
                  <option value="has-assigned">Has assigned demands</option>
                  <option value="has-blocked">Has blocked demands</option>
                </select>
              </label>
              {(groupFilters.query || groupFilters.memberCount !== 'all' || groupFilters.workload !== 'all') && (
                <button type="button" className="text-btn" onClick={clearGroupFilters}>
                  Clear filters
                </button>
              )}
            </div>

            <form className="users-form" onSubmit={submitGroupForm}>
              <div className="field-row">
                <label>
                  Group Name
                  <input
                    value={groupForm.name}
                    onChange={(event) => updateGroupField('name', event.target.value)}
                    placeholder="e.g. Space Systems HM Team"
                  />
                </label>
                <label>
                  Description
                  <input
                    value={groupForm.description}
                    onChange={(event) => updateGroupField('description', event.target.value)}
                    placeholder="Optional description"
                  />
                </label>
              </div>

              <div>
                <p className="meta">Select Hiring Managers</p>
                <div className="group-member-picker">
                  {hiringManagers.length === 0 && (
                    <p className="meta">No hiring managers available. Create users with the Hiring Manager role first.</p>
                  )}
                  {hiringManagers.map((manager) => (
                    <label key={manager.id} className="group-member-option">
                      <input
                        type="checkbox"
                        checked={groupForm.memberIds.includes(manager.id)}
                        onChange={() => toggleGroupMember(manager.id)}
                      />
                      <span>
                        {manager.displayName} ({manager.email || 'No email'})
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="actions">
                <button type="submit" className="btn-primary">
                  {editingGroupId ? 'Update Group' : 'Create Group'}
                </button>
                {editingGroupId && (
                  <button type="button" className="btn-secondary" onClick={resetGroupForm}>
                    Cancel Edit
                  </button>
                )}
              </div>
              {groupStatus && <p className="meta">{groupStatus}</p>}
            </form>

            <div className="groups-grid">
              {visibleHiringManagerGroups.length === 0 && (
                <p className="empty-state">No hiring manager groups created yet.</p>
              )}

              {visibleHiringManagerGroups.map((group) => (
                <article key={group.id} className="group-card">
                  <div className="card-top">
                    <h4>{group.name}</h4>
                    <span className="badge">{group.members.length} member{group.members.length === 1 ? '' : 's'}</span>
                  </div>

                  {group.description && <p className="meta">{group.description}</p>}

                  {group.members.length === 0 && <p className="meta">No members assigned.</p>}

                  <ul className="group-member-list" aria-label={`Members for ${group.name}`}>
                    {group.members.map((member) => (
                      <li key={member.id} className="group-member-card">
                        <p className="users-name">{member.displayName}</p>
                        <p className="meta">Email: {member.email || 'No email'}</p>
                        <p className="meta">Role: {roleLabels[member.role]}</p>
                        <p className="meta">Group: {member.funcOrg || 'No group'}</p>
                        <p className="meta">
                          Assigned Demands: {member.assignedCount} · Open: {member.openCount} · Blocked: {member.blockedCount}
                        </p>
                      </li>
                    ))}
                  </ul>

                  <div className="card-actions">
                    <button type="button" className="text-btn" onClick={() => openGroupDetails(group.id)}>
                      View Details
                    </button>
                    <button type="button" className="text-btn" onClick={() => beginEditGroup(group)}>
                      Edit Group
                    </button>
                    <button type="button" className="text-btn danger" onClick={() => removeGroup(group.id)}>
                      Delete Group
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      {page === pages.metrics && (
        <>
          <section className="hero">
            <h2>Demand Metrics</h2>
            <p className="subhead">
              Track open demand aging and find requests that have stalled without updates for at least 7 days.
            </p>
          </section>

          <section className="metrics-toolbar panel-lite">
            <label>
              Functional Org
              <select value={metricsFilters.org} onChange={(e) => setMetricsFilters((f) => ({ ...f, org: e.target.value }))}>
                <option value="All">All Orgs</option>
                {functionalOrgOptions.map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
            <label>
              Priority
              <select value={metricsFilters.priority} onChange={(e) => setMetricsFilters((f) => ({ ...f, priority: e.target.value }))}>
                <option value="All">All Priorities</option>
                {priorities.map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
            <label>
              Hiring Manager
              <input
                value={metricsFilters.hiringManager}
                onChange={(e) => setMetricsFilters((f) => ({ ...f, hiringManager: e.target.value }))}
                placeholder="Filter by name…"
              />
            </label>
            {(metricsFilters.org !== 'All' || metricsFilters.priority !== 'All' || metricsFilters.hiringManager.trim()) && (
              <button
                type="button"
                className="text-btn"
                onClick={() => setMetricsFilters({ org: 'All', priority: 'All', hiringManager: '' })}
              >
                Clear filters
              </button>
            )}
          </section>

          <section className="metrics-grid" aria-label="Demand metrics summary">
            <button
              type="button"
              className="metric-card metric-card-action"
              onClick={() => openSpreadsheetForDemands(filteredMetrics.openDemands.map((item) => item.id), 'Open Demands')}
            >
              <p>Open</p>
              <h2>{filteredMetrics.openDemands.length}</h2>
            </button>
            <article className="metric-card">
              <p>Average Days Open</p>
              <h2>{filteredMetrics.avgDaysOpen}</h2>
            </article>
            <button
              type="button"
              className="metric-card warn metric-card-action"
              onClick={() => {
                const oldest = filteredMetrics.openDemands[0];
                openSpreadsheetForDemands(oldest ? [oldest.id] : [], 'Oldest Open Demand');
              }}
              disabled={filteredMetrics.openDemands.length === 0}
            >
              <p>Oldest Open Demand</p>
              <h2>{filteredMetrics.oldestOpenDays}d</h2>
            </button>
            <button
              type="button"
              className="metric-card warn metric-card-action"
              onClick={() => openSpreadsheetForDemands(filteredMetrics.staleDemands.map((item) => item.id), 'Not Updated In 7+ Days')}
            >
              <p>Not Updated In 7+ Days</p>
              <h2>{filteredMetrics.staleDemands.length}</h2>
            </button>
          </section>

          <section className="panel metrics-panel">
            <h3>Open Demand Aging Buckets</h3>
            <p className="meta">Distribution of open demands by how long they have been open.</p>
            <div className="aging-chart" aria-label="Aging distribution chart">
              {filteredMetrics.agingBuckets.map((bucket) => (
                <div key={bucket.label} className="aging-row">
                  <span className="aging-label">{bucket.label}</span>
                  <div className="aging-bar-track">
                    <div
                      className="aging-bar"
                      style={{ width: `${Math.round((bucket.count / filteredMetrics.maxBucketCount) * 100)}%` }}
                    />
                  </div>
                  <span className="aging-count">{bucket.count}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="metrics-layout">
            <section className="panel metrics-panel">
              <div className="board-head">
                <div>
                  <h3>Open Demand Aging</h3>
                  <p className="meta">Open requests sorted by time open, longest first.</p>
                </div>
              </div>
              <ul className="metrics-list" aria-label="Open demand aging list">
                {filteredMetrics.openDemands.length === 0 && (
                  <li className="empty-state">No open demands match current filters.</li>
                )}
                {filteredMetrics.openDemands.map((item) => (
                  <li key={item.id} className="metrics-item">
                    <div>
                      <h4>{item.demandTitle || item.positionTitle || 'Untitled demand'}</h4>
                      <p className="meta">
                        {item.demandId || 'No ID'} · {item.project || 'Unspecified project'} · {item.positionTitle || 'Unspecified role'}
                      </p>
                      <p className="meta">
                        Open {item.daysOpen} day{item.daysOpen === 1 ? '' : 's'} · Need Date: {item.needDate || 'Not set'}
                      </p>
                    </div>
                    <button type="button" className="text-btn" onClick={() => openDemandDetails(item.id)}>
                      Open
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel metrics-panel">
              <div className="board-head">
                <div>
                  <h3>Stale Demands</h3>
                  <p className="meta">Active demands with no updates in the last 7 days.</p>
                </div>
                {filteredMetrics.staleDemands.length > 0 && (
                  <button type="button" className="btn-secondary" onClick={exportStaleToCsv}>
                    Export CSV
                  </button>
                )}
              </div>
              <ul className="metrics-list" aria-label="Stale demand list">
                {filteredMetrics.staleDemands.length === 0 && (
                  <li className="empty-state">No stale demands match current filters.</li>
                )}
                {filteredMetrics.staleDemands.map((item) => (
                  <li key={item.id} className="metrics-item">
                    <div>
                      <h4>{item.demandTitle || item.positionTitle || 'Untitled demand'}</h4>
                      <p className="meta">
                        {item.demandId || 'No ID'} · {(item.state ?? item.status) || 'Unknown'} · {item.priority || 'No priority'}
                      </p>
                      <p className="meta">
                        Last updated {item.daysSinceUpdate} day{item.daysSinceUpdate === 1 ? '' : 's'} ago · Open {item.daysOpen} day{item.daysOpen === 1 ? '' : 's'}
                      </p>
                    </div>
                    <button type="button" className="text-btn" onClick={() => openDemandDetails(item.id)}>
                      Open
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </section>
        </>
      )}

      {page === pages.managerCallMetrics && (
        <>
          <section className="hero">
            <h2>Manager Call Metrics</h2>
            <p className="subhead">
              Focused metrics for manager call stages: {managerCallFulfillmentStages.join(', ')}.
            </p>
            <div className="card-actions" style={{ marginTop: '0.65rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowManagerCallCustomizer((current) => !current)}
              >
                {showManagerCallCustomizer ? 'Hide Customize Options' : 'Show Customize Options'}
              </button>
            </div>
          </section>

          <section className="metrics-grid" aria-label="Manager call metrics summary">
            <article className="metric-card">
              <p>Total In Manager Call</p>
              <h2>{managerCallMetrics.total}</h2>
            </article>
            <article className="metric-card">
              <p>Open</p>
              <h2>{managerCallMetrics.open}</h2>
            </article>
            <article className="metric-card warn">
              <p>Blocked</p>
              <h2>{managerCallMetrics.blocked}</h2>
            </article>
            <button
              type="button"
              className="metric-card metric-card-action"
              onClick={() => openSpreadsheetForDemands(managerCallDemands.map((item) => item.id), 'Manager Call Demands')}
              disabled={managerCallDemands.length === 0}
            >
              <p>Open In Spreadsheet</p>
              <h2>{managerCallDemands.length}</h2>
            </button>
          </section>

          <section className="panel metrics-panel">
            <div className="board-head">
              <div>
                <h3>By Fulfillment Stage</h3>
                <p className="meta">Distribution across manager call stages.</p>
              </div>
              <button type="button" className="btn-secondary" onClick={applyManagerCallSpreadsheetPreset}>
                Apply Manager Call Spreadsheet View
              </button>
            </div>
            <ul className="metrics-list" aria-label="Manager call stage distribution">
              {managerCallMetrics.byStage.map((bucket) => (
                <li key={bucket.stage} className="metrics-item">
                  <div>
                    <h4>{bucket.stage}</h4>
                  </div>
                  <strong>{bucket.count}</strong>
                </li>
              ))}
            </ul>
          </section>

          {showManagerCallCustomizer && (
            <section className="panel-lite spreadsheet-customizer" style={{ marginTop: '1rem' }}>
              <div className="board-head">
                <h4>Customize Manager Call Columns</h4>
                <div className="card-actions">
                  <button type="button" className="btn-secondary" onClick={resetSpreadsheetColumns}>
                    Reset Defaults
                  </button>
                </div>
              </div>
              <p className="meta">Column changes apply to spreadsheet views and are saved per user.</p>

              <div className="spreadsheet-customizer-grid">
                <div>
                  <p className="meta"><strong>Selected Columns</strong></p>
                  <div
                    className="column-chip-zone"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleDropOnSelectedColumns(selectedSpreadsheetFields.length)}
                  >
                    {selectedSpreadsheetFields.map((field, index) => (
                      <div
                        key={field.key}
                        className="column-chip selected"
                        draggable
                        onDragStart={() => startFieldDrag('selected', field.key)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => handleDropOnSelectedColumns(index)}
                      >
                        <span>{field.label}</span>
                        <button
                          type="button"
                          className="text-btn danger"
                          onClick={() => removeSpreadsheetColumn(field.key)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="meta"><strong>Available Fields</strong></p>
                  <div className="column-chip-zone">
                    {availableSpreadsheetFields.map((field) => (
                      <div
                        key={field.key}
                        className="column-chip"
                        draggable
                        onDragStart={() => startFieldDrag('available', field.key)}
                      >
                        <span>{field.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="panel metrics-panel" style={{ marginTop: '1rem' }}>
            <h3>Manager Call Demand Spreadsheet</h3>
            <p className="meta">All demands in manager call stages, shown in spreadsheet format.</p>

            <div className="spreadsheet-wrap" aria-label="Manager call spreadsheet table">
              <table className="spreadsheet-table">
                <thead>
                  <tr>
                    {selectedSpreadsheetFields.map((field) => (
                      <th key={field.key}>{field.label}</th>
                    ))}
                    <th>Actions</th>
                  </tr>
                  <tr className="spreadsheet-filter-row">
                    {selectedSpreadsheetFields.map((field) => (
                      <th key={`manager-filter-${field.key}`}>
                        <input
                          value={spreadsheetColumnFilters[field.key] || ''}
                          onChange={(event) => updateSpreadsheetColumnFilter(field.key, event.target.value)}
                          placeholder={`Filter ${field.label}`}
                          aria-label={`Filter manager call by ${field.label}`}
                        />
                      </th>
                    ))}
                    <th>
                      <button type="button" className="text-btn" onClick={clearSpreadsheetColumnFilters}>
                        Clear
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {managerCallSpreadsheetDemands.length === 0 ? (
                    <tr>
                      <td colSpan={selectedSpreadsheetFields.length + 1}>
                        <p className="empty-state" style={{ margin: '0.8rem 0' }}>
                          No demands currently in manager call stages.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    managerCallSpreadsheetDemands.map((item) => (
                      <tr key={item.id}>
                        {selectedSpreadsheetFields.map((field) => (
                          <td key={`${item.id}-${field.key}`}>{renderSpreadsheetCell(item, field)}</td>
                        ))}
                        <td>
                          <div className="card-actions">
                            <button type="button" className="text-btn" onClick={() => openDemandDetails(item.id)}>
                              Open
                            </button>
                            <button
                              type="button"
                              className={`text-btn ${isSubscribedDemand(item.id) ? 'active-subscription' : ''}`}
                              onClick={() => toggleDemandSubscription(item.id)}
                            >
                              {isSubscribedDemand(item.id) ? 'Unsub' : 'Sub'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {page === pages.allOpen && (
        <>
          <section className="hero">
            <h2>All Open Demands</h2>
            <p className="subhead">
              Complete view of all open demands with spreadsheet filters.
            </p>
            <div className="card-actions" style={{ marginTop: '0.65rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowAllOpenCustomizer((current) => !current)}
              >
                {showAllOpenCustomizer ? 'Hide Customize Options' : 'Show Customize Options'}
              </button>
            </div>
          </section>

          {showAllOpenCustomizer && (
            <section className="panel-lite spreadsheet-customizer" style={{ marginTop: '1rem' }}>
              <div className="board-head">
                <h4>Customize Columns</h4>
                <div className="card-actions">
                  <button type="button" className="btn-secondary" onClick={resetSpreadsheetColumns}>
                    Reset Defaults
                  </button>
                </div>
              </div>
              <p className="meta">Column changes apply to spreadsheet views and are saved per user.</p>

              <div className="spreadsheet-customizer-grid">
                <div>
                  <p className="meta"><strong>Selected Columns</strong></p>
                  <div
                    className="column-chip-zone"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleDropOnSelectedColumns(selectedSpreadsheetFields.length)}
                  >
                    {selectedSpreadsheetFields.map((field, index) => (
                      <div
                        key={field.key}
                        className="column-chip selected"
                        draggable
                        onDragStart={() => startFieldDrag('selected', field.key)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => handleDropOnSelectedColumns(index)}
                      >
                        <span>{field.label}</span>
                        <button
                          type="button"
                          className="text-btn danger"
                          onClick={() => removeSpreadsheetColumn(field.key)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="meta"><strong>Available Fields</strong></p>
                  <div className="column-chip-zone">
                    {availableSpreadsheetFields.map((field) => (
                      <div
                        key={field.key}
                        className="column-chip"
                        draggable
                        onDragStart={() => startFieldDrag('available', field.key)}
                      >
                        <span>{field.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="panel metrics-panel" style={{ marginTop: '1rem' }}>
            <h3>Open Demands Spreadsheet</h3>
            <p className="meta">{allOpenDemands.length} open demands shown in spreadsheet format with column filters.</p>

            <div className="spreadsheet-wrap" aria-label="All open demands spreadsheet table">
              <table className="spreadsheet-table">
                <thead>
                  <tr>
                    {selectedSpreadsheetFields.map((field) => (
                      <th key={field.key}>{field.label}</th>
                    ))}
                    <th>Actions</th>
                  </tr>
                  <tr className="spreadsheet-filter-row">
                    {selectedSpreadsheetFields.map((field) => (
                      <th key={`allopen-filter-${field.key}`}>
                        <input
                          value={spreadsheetColumnFilters[field.key] || ''}
                          onChange={(event) => updateSpreadsheetColumnFilter(field.key, event.target.value)}
                          placeholder={`Filter ${field.label}`}
                          aria-label={`Filter open demands by ${field.label}`}
                        />
                      </th>
                    ))}
                    <th>
                      <button type="button" className="text-btn" onClick={clearSpreadsheetColumnFilters}>
                        Clear
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {allOpenSpreadsheetDemands.length === 0 ? (
                    <tr>
                      <td colSpan={selectedSpreadsheetFields.length + 1}>
                        <p className="empty-state" style={{ margin: '0.8rem 0' }}>
                          No open demands match your filters.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    allOpenSpreadsheetDemands.map((item) => (
                      <tr key={item.id}>
                        {selectedSpreadsheetFields.map((field) => (
                          <td key={`${item.id}-${field.key}`}>{renderSpreadsheetCell(item, field)}</td>
                        ))}
                        <td>
                          <div className="card-actions">
                            <button type="button" className="text-btn" onClick={() => openDemandDetails(item.id)}>
                              Open
                            </button>
                            <button
                              type="button"
                              className={`text-btn ${isSubscribedDemand(item.id) ? 'active-subscription' : ''}`}
                              onClick={() => toggleDemandSubscription(item.id)}
                            >
                              {isSubscribedDemand(item.id) ? 'Unsub' : 'Sub'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {page === pages.allDestaff && (
        <>
          <section className="hero">
            <h2>All Open Destaff</h2>
            <p className="subhead">
              All employees available or interviewing for new placement.
            </p>
          </section>

          <section className="metrics-grid" aria-label="Open destaff summary">
            <article className="metric-card">
              <p>Available</p>
              <h2>{destaffRecords.filter((r) => r.status === 'Available').length}</h2>
            </article>
            <article className="metric-card">
              <p>Interviewing</p>
              <h2>{destaffRecords.filter((r) => r.status === 'Interviewing').length}</h2>
            </article>
          </section>

          <section className="panel metrics-panel" style={{ marginTop: '1rem' }}>
            <h3>Open Destaff Records</h3>
            <p className="meta">{openDestaffRecords.length} people currently available or interviewing.</p>

            <div style={{ overflowX: 'auto' }}>
              <table className="spreadsheet-table" aria-label="Open destaff records table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Current Program</th>
                    <th>Current Role</th>
                    <th>Func Org</th>
                    <th>Clearance</th>
                    <th>Available Date</th>
                    <th>Status</th>
                    <th>Skills</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {openDestaffRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9}>
                        <p className="empty-state" style={{ margin: '0.8rem 0' }}>
                          No destaff people currently available or interviewing.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    openDestaffRecords.map((record) => (
                      <tr key={record.id || `${record.employeeName}-${record.availableDate}`}>
                        <td>{record.employeeName}</td>
                        <td>{record.currentProgram}</td>
                        <td>{record.currentRole}</td>
                        <td>{record.funcOrg}</td>
                        <td>{record.clearance}</td>
                        <td>{record.availableDate}</td>
                        <td>
                          <span className={`destaff-status-${record.status?.toLowerCase().replace(/\\s+/g, '-')}`}>
                            {record.status}
                          </span>
                        </td>
                        <td>{record.skills}</td>
                        <td>{record.notes}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {page === pages.addDemand && (
        <section className="panel intake-panel">
          <div className="board-head">
            <h3>{editId ? 'Edit Demand Intake' : 'Add Demand Intake'}</h3>
            <button type="button" className="btn-secondary" onClick={goToDashboard}>
              Back to Dashboard
            </button>
          </div>

          <div className="wizard-progress" aria-label="Demand intake progress">
            {activeWizardSteps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                className={`wizard-step ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'done' : ''}`}
                onClick={() => setCurrentStep(index)}
              >
                <span>{index + 1}</span>
                {step.title}
              </button>
            ))}
          </div>

          <div className="draft-controls">
            <button type="button" className="btn-secondary" onClick={saveDraft}>
              Save Draft
            </button>
            <button type="button" className="btn-secondary" onClick={resumeDraft}>
              Resume Draft
            </button>
            <button type="button" className="btn-secondary" onClick={discardDraft} disabled={!hasDraft}>
              Discard Draft
            </button>
            <p className="draft-status">
              {draftStatus || (hasDraft ? `Saved draft available${draftUpdatedAt ? ` · ${new Date(draftUpdatedAt).toLocaleString()}` : ''}` : 'No draft saved yet.')}
            </p>
          </div>

          {!editId && (
            <section className="csv-import panel-lite">
              <div className="board-head">
                <div>
                  <h4>Bulk CSV Import</h4>
                  <p className="meta">Upload up to 10 rows. Required CSV column: demandId. Optional: demandTitle, programPoc, needDate, project, positionTitle, funcOrg, priority, state.</p>
                </div>
                {csvImportRows.length > 0 && (
                  <button type="button" className="btn-secondary" onClick={clearCsvImport}>
                    Clear CSV
                  </button>
                )}
              </div>
              <input type="file" accept=".csv,text/csv" onChange={onCsvImport} />
              <p className="meta">
                {csvImportStatus || (csvImportName ? `${csvImportName} ready.` : 'No CSV uploaded. Manual bulk count remains available.')}
              </p>
              {csvImportRows.length > 0 && (
                <ul className="csv-preview">
                  {csvImportRows.map((row) => (
                    <li key={row.demandId}>{row.demandId}{row.demandTitle ? ` · ${row.demandTitle}` : ''}</li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <form onSubmit={onSubmit} className="intake-form">
            <div className="wizard-shell">
              <div className="wizard-main">
                {currentStep === 0 && (
                  <section className="intake-section">
                    <h4>Project Demand</h4>
                    <div className="field-row">
                      <label>
                        Demand Title
                        <input
                          value={form.demandTitle}
                          onChange={(event) => updateField('demandTitle', event.target.value)}
                          placeholder="e.g. PGSD C2 Software Engineer"
                        />
                      </label>
                      <label>
                        Program POC <span className="required-mark">*</span>
                        <input value={form.programPoc} onChange={(event) => updateField('programPoc', event.target.value)} />
                        {getFieldError('programPoc', 'Program POC') && <p className="field-error">{getFieldError('programPoc', 'Program POC')}</p>}
                      </label>
                    </div>
                    <div className="field-row">
                      <label>
                        Entered On
                        <input type="date" value={form.enteredOn} onChange={(event) => updateField('enteredOn', event.target.value)} />
                      </label>
                      <label>
                        Demand ID
                        <input value={form.demandId} readOnly disabled />
                      </label>
                    </div>
                    {!editId && (
                      <label>
                        Bulk Count
                        <select value={form.bulkCount} onChange={(event) => updateField('bulkCount', event.target.value)}>
                          {Array.from({ length: 10 }, (_, index) => (
                            <option key={index + 1} value={String(index + 1)}>
                              {index + 1}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <div className="field-row">
                      <label>
                        Need Date <span className="required-mark">*</span>
                        <input type="date" value={form.needDate} onChange={(event) => updateField('needDate', event.target.value)} />
                        {getFieldError('needDate', 'Need Date') && <p className="field-error">{getFieldError('needDate', 'Need Date')}</p>}
                      </label>
                      <label>
                        State
                        <select value={form.state} onChange={(event) => updateField('state', event.target.value)}>
                          {getStatusOptionsForFulfillmentStage(form.fulfillmentStage).map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </section>
                )}

                {currentStep === 1 && (
                  <section className="intake-section">
                    <h4>Project Summary</h4>
                    <div className="field-row">
                      <label>
                        Division
                        <input value={form.division} onChange={(event) => updateField('division', event.target.value)} />
                      </label>
                      <label>
                        Business Unit
                        <input value={form.businessUnit} onChange={(event) => updateField('businessUnit', event.target.value)} />
                      </label>
                    </div>
                    <div className="field-row">
                      <label>
                        Org Unit
                        <input value={form.orgUnit} onChange={(event) => updateField('orgUnit', event.target.value)} />
                      </label>
                      <label>
                        Project <span className="required-mark">*</span>
                        <input value={form.project} onChange={(event) => updateField('project', event.target.value)} />
                        {getFieldError('project', 'Project') && <p className="field-error">{getFieldError('project', 'Project')}</p>}
                      </label>
                    </div>
                    <label>
                      Sub Project Name
                      <input value={form.subProjectName} onChange={(event) => updateField('subProjectName', event.target.value)} />
                    </label>
                  </section>
                )}

                {currentStep === 2 && (
                  <section className="intake-section">
                    <h4>Project Details</h4>
                    <label>
                      Position Title <span className="required-mark">*</span>
                      <input value={form.positionTitle} onChange={(event) => updateField('positionTitle', event.target.value)} />
                      {getFieldError('positionTitle', 'Position Title') && <p className="field-error">{getFieldError('positionTitle', 'Position Title')}</p>}
                    </label>
                    <div className="field-row">
                      <label>
                        Firm Order Factor
                        <input value={form.firmOrderFactor} onChange={(event) => updateField('firmOrderFactor', event.target.value)} />
                      </label>
                      <label>
                        Work Type
                        <select value={form.workType} onChange={(event) => updateField('workType', event.target.value)}>
                          {workTypes.map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="field-row">
                      <label>
                        Allotment Type
                        <input value={form.allotmentType} onChange={(event) => updateField('allotmentType', event.target.value)} />
                      </label>
                      <label>
                        Priority
                        <select value={form.priority} onChange={(event) => updateField('priority', event.target.value)}>
                          {priorities.map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="field-row">
                      <label>
                        Duration (months)
                        <input
                          type="number"
                          min="1"
                          value={form.durationMonths}
                          onChange={(event) => updateField('durationMonths', event.target.value)}
                        />
                      </label>
                      <label>
                        Interview Panel Names
                        <input
                          value={form.interviewPanelNames}
                          onChange={(event) => updateField('interviewPanelNames', event.target.value)}
                        />
                      </label>
                    </div>
                    <label>
                      Functional Org
                      <select value={form.funcOrg} onChange={(event) => updateField('funcOrg', event.target.value)}>
                        <option value="">Select functional org</option>
                        {functionalOrgOptions.map((option) => (
                          <option key={option}>{option}</option>
                        ))}
                      </select>
                      {getFieldError('funcOrg', 'Functional Org') && <p className="field-error">{getFieldError('funcOrg', 'Functional Org')}</p>}
                    </label>
                    <label>
                      Skills / Description
                      <textarea rows="4" value={form.skillsDescription} onChange={(event) => updateField('skillsDescription', event.target.value)} />
                    </label>
                    <label>
                      Certifications
                      <input value={form.certifications} onChange={(event) => updateField('certifications', event.target.value)} />
                    </label>
                    <label>
                      Allowable Grades
                      <input value={form.allowableGrades} onChange={(event) => updateField('allowableGrades', event.target.value)} />
                    </label>
                    <div className="field-row">
                      <label>
                        Clearance
                        <select value={form.clearance} onChange={(event) => updateField('clearance', event.target.value)}>
                          {clearanceOptions.map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Facility Clearance
                        <input value={form.facilityClearance} onChange={(event) => updateField('facilityClearance', event.target.value)} />
                      </label>
                    </div>
                    <div className="field-row">
                      <label>
                        Contractor OK?
                        <select value={form.contractorOk} onChange={(event) => updateField('contractorOk', event.target.value)}>
                          {yesNo.map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        % Remote
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={form.remotePercent}
                          onChange={(event) => updateField('remotePercent', event.target.value)}
                        />
                      </label>
                    </div>
                  </section>
                )}

                {currentStep === 3 && (
                  <section className="intake-section">
                    <h4>Functional Supply</h4>
                    {!canEditFunctionalInfo && (
                      <p className="meta">Functional fields are completed by a Hiring Manager after demand creation.</p>
                    )}
                    <div className="field-row">
                      <label>
                        Fulfillment Stage
                        <select
                          value={form.fulfillmentStage}
                          onChange={(event) => updateField('fulfillmentStage', event.target.value)}
                          disabled={!canEditFunctionalInfo}
                        >
                          {fulfillmentStages.map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Hiring Manager
                        <input
                          value={form.hiringManager}
                          onChange={(event) => updateField('hiringManager', event.target.value)}
                          disabled={!canEditFunctionalInfo}
                        />
                      </label>
                    </div>
                    <div className="field-row">
                      <label>
                        Alternate Mgr 1
                        <input
                          value={form.alternateMgr1}
                          onChange={(event) => updateField('alternateMgr1', event.target.value)}
                          disabled={!canEditFunctionalInfo}
                        />
                      </label>
                      <label>
                        Alternate Mgr 2
                        <input
                          value={form.alternateMgr2}
                          onChange={(event) => updateField('alternateMgr2', event.target.value)}
                          disabled={!canEditFunctionalInfo}
                        />
                      </label>
                    </div>
                    <div className="field-row">
                      <label>
                        External Req Required?
                        <select
                          value={form.externalReqRequired}
                          onChange={(event) => updateField('externalReqRequired', event.target.value)}
                          disabled={!canEditFunctionalInfo}
                        >
                          {yesNo.map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Req Number
                        <input
                          value={form.reqNumber}
                          onChange={(event) => updateField('reqNumber', event.target.value)}
                          disabled={!canEditFunctionalInfo}
                        />
                      </label>
                    </div>
                    <label>
                      Candidates
                      <input
                        value={form.candidates}
                        onChange={(event) => updateField('candidates', event.target.value)}
                        disabled={!canEditFunctionalInfo}
                      />
                    </label>
                    <div className="field-row">
                      <label>
                        Filled By
                        <input
                          value={form.filledBy}
                          onChange={(event) => updateField('filledBy', event.target.value)}
                          disabled={!canEditFunctionalInfo}
                        />
                      </label>
                      <label>
                        Filled By Site
                        <input
                          value={form.filledBySite}
                          onChange={(event) => updateField('filledBySite', event.target.value)}
                          disabled={!canEditFunctionalInfo}
                        />
                      </label>
                    </div>
                    <div className="field-row">
                      <label>
                        New Hire?
                        <input
                          value={form.newHire}
                          onChange={(event) => updateField('newHire', event.target.value)}
                          disabled={!canEditFunctionalInfo}
                        />
                      </label>
                      <label>
                        Start Date
                        <input
                          type="date"
                          value={form.startDate}
                          onChange={(event) => updateField('startDate', event.target.value)}
                          disabled={!canEditFunctionalInfo}
                        />
                      </label>
                    </div>
                    <p className="meta">Comments are added from the demand details view and timestamped automatically.</p>
                  </section>
                )}

                {!canProceedFromStep(currentStep) && attemptedSteps[currentStep] && (
                  <p className="step-warning">Complete required fields before continuing: {getMissingForStep(currentStep).join(', ')}.</p>
                )}

                <div className="actions">
                  <button type="button" className="btn-secondary" onClick={prevStep} disabled={currentStep === 0}>
                    Back
                  </button>
                  {currentStep < activeWizardSteps.length - 1 ? (
                    <button type="button" className="btn-primary" onClick={nextStep} disabled={!canProceedFromStep(currentStep)}>
                      Next
                    </button>
                  ) : (
                    <button type="submit" className="btn-primary" disabled={!canProceedFromStep(currentStep)}>
                      {editId ? 'Save Demand' : 'Create Demand'}
                    </button>
                  )}
                  <button type="button" className="btn-secondary" onClick={() => resetForm(true)}>
                    Clear Form
                  </button>
                  {editId && (
                    <button type="button" className="btn-secondary" onClick={() => resetForm(false)}>
                      Cancel Edit
                    </button>
                  )}
                </div>
              </div>

              <aside className="wizard-summary">
                <h4>Intake Snapshot</h4>
                <p className="meta">Current stage: {activeWizardSteps[currentStep]?.title}</p>
                <ul>
                  <li>Title: {form.demandTitle || 'Not set'}</li>
                  <li>Program POC: {form.programPoc || 'Not set'}</li>
                  <li>Need Date: {form.needDate || 'Not set'}</li>
                  <li>Project: {form.project || 'Not set'}</li>
                  <li>Position: {form.positionTitle || 'Not set'}</li>
                  <li>Functional Org: {form.funcOrg || 'Not set'}</li>
                  <li>Hiring Manager: {form.hiringManager || 'Not set'}</li>
                  <li>Priority: {form.priority}</li>
                  <li>State: {form.state}</li>
                </ul>

                <h4>Step Readiness</h4>
                <ul>
                  {activeWizardSteps.map((step, index) => (
                    <li key={step.id}>
                      {step.title}: {canProceedFromStep(index) ? 'Ready' : `Missing ${getMissingForStep(index).join(', ')}`}
                    </li>
                  ))}
                </ul>
              </aside>
            </div>
          </form>
        </section>
      )}

      {selectedDemand && (
        <section className="detail-modal-backdrop" onClick={closeDemandDetails}>
          <article className="panel detail-modal" onClick={(event) => event.stopPropagation()}>
            <div className="board-head">
              <div>
                <h3>{detailEdits ? detailEdits.demandTitle || selectedDemand.demandTitle : selectedDemand.demandTitle}</h3>
                <p className="meta">
                  {selectedDemand.demandId} · {selectedDemand.project || 'Unspecified project'} · {selectedDemand.positionTitle || 'Unspecified role'}
                </p>
              </div>
              <div className="card-actions">
                {detailEdits ? (
                  <>
                    <button type="button" className="btn-primary" onClick={saveDetailEdits}>Save</button>
                    <button type="button" className="btn-secondary" onClick={cancelDetailEdit}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="btn-secondary" onClick={closeDemandDetails}>Close</button>
                  </>
                )}
              </div>
            </div>

            {detailEdits ? (
              <div className="detail-grid">
                <div>
                  <h4>Demand Overview</h4>
                  <label>Demand ID <input value={selectedDemand.demandId || ''} readOnly disabled /></label>
                  <label>Demand Title <input value={detailEdits.demandTitle || ''} onChange={(e) => updateDetailField('demandTitle', e.target.value)} /></label>
                  <label>Program POC <input value={detailEdits.programPoc || ''} onChange={(e) => updateDetailField('programPoc', e.target.value)} /></label>
                  <label>Need Date <input type="date" value={detailEdits.needDate || ''} onChange={(e) => updateDetailField('needDate', e.target.value)} /></label>
                  <label>State
                    <select value={detailEdits.state || detailEdits.status || ''} onChange={(e) => { updateDetailField('state', e.target.value); updateDetailField('status', e.target.value); }}>
                      {getStatusOptionsForFulfillmentStage(detailEdits.fulfillmentStage).map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </label>
                  <label>Priority
                    <select value={detailEdits.priority || ''} onChange={(e) => updateDetailField('priority', e.target.value)}>
                      {priorities.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </label>
                  <label>Work Type
                    <select value={detailEdits.workType || ''} onChange={(e) => updateDetailField('workType', e.target.value)}>
                      {workTypes.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </label>
                  <label>Functional Org
                    <select value={detailEdits.funcOrg || ''} onChange={(e) => updateDetailField('funcOrg', e.target.value)}>
                      <option value="">Select functional org</option>
                      {functionalOrgOptions.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </label>
                  <p className="meta">Created by: {selectedDemand.createdByName || 'Unknown'}{selectedDemand.createdByEmail ? ` (${selectedDemand.createdByEmail})` : ''}</p>
                </div>
                <div>
                  <h4>Project Details</h4>
                  <label>Division <input value={detailEdits.division || ''} onChange={(e) => updateDetailField('division', e.target.value)} /></label>
                  <label>Business Unit <input value={detailEdits.businessUnit || ''} onChange={(e) => updateDetailField('businessUnit', e.target.value)} /></label>
                  <label>Org Unit <input value={detailEdits.orgUnit || ''} onChange={(e) => updateDetailField('orgUnit', e.target.value)} /></label>
                  <label>Project <input value={detailEdits.project || ''} onChange={(e) => updateDetailField('project', e.target.value)} /></label>
                  <label>Sub Project <input value={detailEdits.subProjectName || ''} onChange={(e) => updateDetailField('subProjectName', e.target.value)} /></label>
                  <label>Position Title <input value={detailEdits.positionTitle || ''} onChange={(e) => updateDetailField('positionTitle', e.target.value)} /></label>
                  <label>Firm Order Factor <input value={detailEdits.firmOrderFactor || ''} onChange={(e) => updateDetailField('firmOrderFactor', e.target.value)} /></label>
                  <label>Allotment Type <input value={detailEdits.allotmentType || ''} onChange={(e) => updateDetailField('allotmentType', e.target.value)} /></label>
                  <label>Duration (months) <input type="number" min="1" value={detailEdits.durationMonths || ''} onChange={(e) => updateDetailField('durationMonths', e.target.value)} /></label>
                  <label>Interview Panel <input value={detailEdits.interviewPanelNames || ''} onChange={(e) => updateDetailField('interviewPanelNames', e.target.value)} /></label>
                  <label>Skills / Description <textarea rows="3" value={detailEdits.skillsDescription || ''} onChange={(e) => updateDetailField('skillsDescription', e.target.value)} /></label>
                  <label>Certifications <input value={detailEdits.certifications || ''} onChange={(e) => updateDetailField('certifications', e.target.value)} /></label>
                  <label>Allowable Grades <input value={detailEdits.allowableGrades || ''} onChange={(e) => updateDetailField('allowableGrades', e.target.value)} /></label>
                  <label>Clearance
                    <select value={detailEdits.clearance || ''} onChange={(e) => updateDetailField('clearance', e.target.value)}>
                      {clearanceOptions.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </label>
                  <label>Facility Clearance <input value={detailEdits.facilityClearance || ''} onChange={(e) => updateDetailField('facilityClearance', e.target.value)} /></label>
                  <label>Contractor OK?
                    <select value={detailEdits.contractorOk || ''} onChange={(e) => updateDetailField('contractorOk', e.target.value)}>
                      {yesNo.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </label>
                  <label>% Remote <input type="number" min="0" max="100" value={detailEdits.remotePercent || ''} onChange={(e) => updateDetailField('remotePercent', e.target.value)} /></label>
                </div>
                <div className="detail-wide">
                  <h4>Functional Supply</h4>
                  <div className="field-row">
                    <label>Fulfillment Stage
                      <select value={detailEdits.fulfillmentStage || ''} onChange={(e) => updateDetailField('fulfillmentStage', e.target.value)}>
                        {fulfillmentStages.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    </label>
                    <label>Hiring Manager <input value={detailEdits.hiringManager || ''} onChange={(e) => updateDetailField('hiringManager', e.target.value)} /></label>
                  </div>
                  <div className="field-row">
                    <label>Alternate Mgr 1 <input value={detailEdits.alternateMgr1 || ''} onChange={(e) => updateDetailField('alternateMgr1', e.target.value)} /></label>
                    <label>Alternate Mgr 2 <input value={detailEdits.alternateMgr2 || ''} onChange={(e) => updateDetailField('alternateMgr2', e.target.value)} /></label>
                  </div>
                  <div className="field-row">
                    <label>External Req Required?
                      <select value={detailEdits.externalReqRequired || ''} onChange={(e) => updateDetailField('externalReqRequired', e.target.value)}>
                        {yesNo.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    </label>
                    <label>Req Number <input value={detailEdits.reqNumber || ''} onChange={(e) => updateDetailField('reqNumber', e.target.value)} /></label>
                  </div>
                  <label>Candidates <input value={detailEdits.candidates || ''} onChange={(e) => updateDetailField('candidates', e.target.value)} /></label>
                  <div className="field-row">
                    <label>Filled By <input value={detailEdits.filledBy || ''} onChange={(e) => updateDetailField('filledBy', e.target.value)} /></label>
                    <label>Filled By Site <input value={detailEdits.filledBySite || ''} onChange={(e) => updateDetailField('filledBySite', e.target.value)} /></label>
                  </div>
                  <div className="field-row">
                    <label>New Hire? <input value={detailEdits.newHire || ''} onChange={(e) => updateDetailField('newHire', e.target.value)} /></label>
                    <label>Start Date <input type="date" value={detailEdits.startDate || ''} onChange={(e) => updateDetailField('startDate', e.target.value)} /></label>
                  </div>
                </div>
              </div>
            ) : (
              <div className="detail-grid">
                <div>
                  <h4>Demand Overview</h4>
                  <ul className="detail-list">
                    <li><strong>Demand ID:</strong> {selectedDemand.demandId || 'Not set'}</li>
                    <li><strong>Program POC:</strong> {selectedDemand.programPoc || 'Not set'}</li>
                    <li><strong>Need Date:</strong> {selectedDemand.needDate || 'Not set'}</li>
                    <li><strong>State:</strong> {selectedDemand.state || selectedDemand.status}</li>
                    <li><strong>Priority:</strong> {selectedDemand.priority}</li>
                    <li><strong>Work Type:</strong> {selectedDemand.workType || 'Not set'}</li>
                    <li><strong>Functional Org:</strong> {selectedDemand.funcOrg || 'Not set'}</li>
                    <li><strong>Created By:</strong> {selectedDemand.createdByName || 'Unknown'}{selectedDemand.createdByEmail ? ` (${selectedDemand.createdByEmail})` : ''}</li>
                  </ul>
                </div>
                <div>
                  <h4>Project Details</h4>
                  <ul className="detail-list">
                    <li><strong>Division:</strong> {selectedDemand.division || 'Not set'}</li>
                    <li><strong>Business Unit:</strong> {selectedDemand.businessUnit || 'Not set'}</li>
                    <li><strong>Org Unit:</strong> {selectedDemand.orgUnit || 'Not set'}</li>
                    <li><strong>Sub Project:</strong> {selectedDemand.subProjectName || 'Not set'}</li>
                    <li><strong>Skills:</strong> {selectedDemand.skillsDescription || 'Not set'}</li>
                    <li><strong>Certifications:</strong> {selectedDemand.certifications || 'Not set'}</li>
                    <li><strong>Allowable Grades:</strong> {selectedDemand.allowableGrades || 'Not set'}</li>
                    <li><strong>Clearance:</strong> {selectedDemand.clearance || 'Not set'}</li>
                  </ul>
                </div>
                <div className="detail-wide">
                  <h4>Functional Supply</h4>
                  <ul className="detail-list detail-list-columns">
                    <li><strong>Hiring Manager:</strong> {selectedDemand.hiringManager || 'Not set'}</li>
                    <li><strong>Fulfillment Stage:</strong> {selectedDemand.fulfillmentStage || 'Not set'}</li>
                    <li><strong>Alternate Mgr 1:</strong> {selectedDemand.alternateMgr1 || 'Not set'}</li>
                    <li><strong>Alternate Mgr 2:</strong> {selectedDemand.alternateMgr2 || 'Not set'}</li>
                    <li><strong>External Req Required:</strong> {selectedDemand.externalReqRequired || 'Not set'}</li>
                    <li><strong>Req Number:</strong> {selectedDemand.reqNumber || 'Not set'}</li>
                    <li><strong>Candidates:</strong> {selectedDemand.candidates || 'Not set'}</li>
                    <li><strong>Filled By:</strong> {selectedDemand.filledBy || 'Not set'}</li>
                    <li><strong>Filled By Site:</strong> {selectedDemand.filledBySite || 'Not set'}</li>
                    <li><strong>New Hire:</strong> {selectedDemand.newHire || 'Not set'}</li>
                    <li><strong>Start Date:</strong> {selectedDemand.startDate || 'Not set'}</li>
                  </ul>
                </div>
              </div>
            )}

            <section className="detail-comments">
              <h4>Comments</h4>
              <div className="comment-composer">
                <textarea
                  rows="3"
                  value={newComment}
                  onChange={(event) => setNewComment(event.target.value)}
                  placeholder="Add a timestamped comment"
                />
                <button type="button" className="btn-primary" onClick={addCommentToDemand} disabled={!newComment.trim()}>
                  Add Comment
                </button>
              </div>
              <ul className="comment-list">
                {(selectedDemand.comments ?? []).length === 0 && <li className="empty-state">No comments yet.</li>}
                {[...(selectedDemand.comments ?? [])].reverse().map((comment) => (
                  <li key={comment.id} className="comment-item">
                    <p className="meta">
                      {comment.authorName} · {new Date(comment.createdAt).toLocaleString()}
                      {comment.editedAt ? ` · edited ${new Date(comment.editedAt).toLocaleString()}` : ''}
                    </p>
                    {editingCommentId === comment.id ? (
                      <>
                        <textarea
                          rows="3"
                          value={editingCommentText}
                          onChange={(event) => setEditingCommentText(event.target.value)}
                        />
                        <div className="card-actions">
                          <button type="button" className="text-btn" onClick={saveCommentEdit}>
                            Save
                          </button>
                          <button
                            type="button"
                            className="text-btn"
                            onClick={() => {
                              setEditingCommentId(null);
                              setEditingCommentText('');
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="notes">{comment.message}</p>
                    )}
                    {canManageComment(comment) && editingCommentId !== comment.id && (
                      <div className="card-actions">
                        <button type="button" className="text-btn" onClick={() => startCommentEdit(comment)}>
                          Edit
                        </button>
                        <button type="button" className="text-btn danger" onClick={() => deleteComment(comment.id)}>
                          Delete
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section className="detail-comments">
              <h4>Audit History</h4>
              <ul className="comment-list">
                {(selectedDemand.history ?? []).length === 0 && (
                  <li className="empty-state">No audit history yet.</li>
                )}
                {[...(selectedDemand.history ?? [])].reverse().map((entry) => (
                  <li key={entry.id} className="comment-item">
                    <p className="meta">
                      {entry.actorName || 'Unknown'} · {entry.action || 'update'} · {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'N/A'}
                    </p>
                    <p className="notes">
                      Changed: {Array.isArray(entry.changedFields) && entry.changedFields.length > 0 ? entry.changedFields.join(', ') : 'N/A'}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          </article>
        </section>
      )}

      {selectedGroupDetail && (
        <section className="detail-modal-backdrop" onClick={closeGroupDetails}>
          <article className="panel detail-modal" onClick={(event) => event.stopPropagation()}>
            <div className="board-head">
              <div>
                <h3>{selectedGroupDetail.name}</h3>
                <p className="meta">
                  {selectedGroupDetail.members.length} member{selectedGroupDetail.members.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="card-actions">
                <button type="button" className="btn-secondary" onClick={closeGroupDetails}>
                  Close
                </button>
              </div>
            </div>

            {selectedGroupDetail.description && <p className="meta">{selectedGroupDetail.description}</p>}

            <section className="metrics-grid" aria-label="Group workload metrics">
              <article className="metric-card">
                <p>Total Assigned Demands</p>
                <h2>
                  {selectedGroupDetail.members.reduce((sum, member) => sum + member.assignedCount, 0)}
                </h2>
              </article>
              <article className="metric-card">
                <p>Open Demands</p>
                <h2>
                  {selectedGroupDetail.members.reduce((sum, member) => sum + member.openCount, 0)}
                </h2>
              </article>
              <article className="metric-card warn">
                <p>Blocked Demands</p>
                <h2>
                  {selectedGroupDetail.members.reduce((sum, member) => sum + member.blockedCount, 0)}
                </h2>
              </article>
            </section>

            <h4>Hiring Manager Details</h4>
            <ul className="group-member-list" aria-label="Group member details">
              {selectedGroupDetail.members.length === 0 && (
                <li className="empty-state">No hiring managers assigned to this group.</li>
              )}
              {selectedGroupDetail.members.map((member) => (
                <li key={member.id} className="group-member-card">
                  <p className="users-name">{member.displayName}</p>
                  <div className="detail-list detail-list-columns">
                    <p><strong>Email:</strong> {member.email || 'No email'}</p>
                    <p><strong>Role:</strong> {roleLabels[member.role]}</p>
                    <p><strong>Group:</strong> {member.funcOrg || 'No group'}</p>
                    <p><strong>Assigned Demands:</strong> {member.assignedCount}</p>
                    <p><strong>Open Demands:</strong> {member.openCount}</p>
                    <p><strong>Blocked Demands:</strong> {member.blockedCount}</p>
                  </div>
                  <div className="card-actions">
                    <button
                      type="button"
                      className="text-btn"
                      onClick={() => viewManagerDemandsFromGroup(member)}
                    >
                      View Demands
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </article>
        </section>
      )}
    </main>
  );
}
