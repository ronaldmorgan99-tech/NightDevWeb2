export function isStudioDiscoverableFlag(value) {
  return String(value ?? '').toLowerCase() === 'true';
}

export function getStudioRouteMode(value) {
  return isStudioDiscoverableFlag(value) ? 'studio-enabled' : 'coming-soon';
}
