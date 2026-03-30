const STORAGE_KEY = 'demand-site:demands:v2';
const LEGACY_STORAGE_KEYS = ['demand-site:demands:v1', 'demand-site:demands'];
const DEMANDS_API_PATH = '/api/demands';
const SYNC_DELAY_MS = 500;

let syncTimer = null;

const LEGACY_SEED_TITLES = new Set([
  'Resolve checkout API bottleneck',
  'Migrate campaign report exports',
  'Streamline onboarding request intake'
]);

function parseStoredArray(raw) {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isLegacySeedDataset(items) {
  if (!Array.isArray(items) || items.length !== LEGACY_SEED_TITLES.size) return false;

  const normalizedTitles = new Set(
    items.map((item) => (item?.demandTitle ?? item?.title ?? '').trim()).filter(Boolean)
  );

  if (normalizedTitles.size !== LEGACY_SEED_TITLES.size) return false;
  return [...LEGACY_SEED_TITLES].every((title) => normalizedTitles.has(title));
}

export function loadDemands() {
  const current = parseStoredArray(window.localStorage.getItem(STORAGE_KEY));
  if (current) {
    if (isLegacySeedDataset(current)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return [];
    }
    return current;
  }

  for (const legacyKey of LEGACY_STORAGE_KEYS) {
    const legacy = parseStoredArray(window.localStorage.getItem(legacyKey));
    if (!legacy) continue;

    window.localStorage.removeItem(legacyKey);

    if (isLegacySeedDataset(legacy)) {
      return [];
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
    return legacy;
  }

  return null;
}

export function saveDemands(demands) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(demands));

  if (syncTimer) {
    window.clearTimeout(syncTimer);
  }

  syncTimer = window.setTimeout(() => {
    syncTimer = null;

    fetch(DEMANDS_API_PATH, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ demands })
    }).catch(() => {
      // Ignore sync errors so the UI can continue using local cache.
    });
  }, SYNC_DELAY_MS);
}

export async function hydrateDemandsFromApi() {
  try {
    const response = await fetch(DEMANDS_API_PATH);
    if (!response.ok) return null;

    const payload = await response.json();
    if (!Array.isArray(payload?.demands)) return null;

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload.demands));
    return payload.demands;
  } catch {
    return null;
  }
}
