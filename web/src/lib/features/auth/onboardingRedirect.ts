export function joinOnboardingTarget(search: string): string {
  const from = new URLSearchParams(search).get('from');

  if (from) {
    return `/onboarding?returnTo=${encodeURIComponent(from)}`;
  }

  return '/onboarding';
}

export function onboardingCompletionTarget(search: string): string {
  return new URLSearchParams(search).get('returnTo') || '/';
}
