export const ONBOARDING_STORAGE_KEY = "sustainscan-onboarding-v1";

export type GuideStepId =
  | "location-concession"
  | "home-register-log"
  | "scan-viewfinder"
  | "register-product-group"
  | "register-details"
  | "home-inspection"
  | "schedule-start-inspection"
  | "inspection-pre-shipment"
  | "inspection-info";

export type GuidePlacement = "top" | "bottom" | "left" | "right";

export type GuideScreen =
  | "location"
  | "home"
  | "scan-log"
  | "register-log-form"
  | "schedule-inspection"
  | "inspection-details";

export interface GuideStep {
  id: GuideStepId;
  screen: GuideScreen;
  message: string;
  targetId: string;
  placement: GuidePlacement;
}

export interface OnboardingState {
  completedSteps: GuideStepId[];
  skipped: boolean;
}

const CLIENT_STEPS: GuideStep[] = [
  {
    id: "location-concession",
    screen: "location",
    message: "Select your timber concession to get started",
    targetId: "guide-location-concession",
    placement: "bottom",
  },
  {
    id: "home-register-log",
    screen: "home",
    message: "Tap here to register a new log",
    targetId: "guide-home-register-log",
    placement: "top",
  },
  {
    id: "scan-viewfinder",
    screen: "scan-log",
    message: "Tap here to scan the QR code",
    targetId: "guide-scan-viewfinder",
    placement: "bottom",
  },
  {
    id: "register-product-group",
    screen: "register-log-form",
    message: "Select a product group for this log",
    targetId: "guide-register-product-group",
    placement: "bottom",
  },
  {
    id: "register-details",
    screen: "register-log-form",
    message: "Add your log measurements and details",
    targetId: "guide-register-details",
    placement: "top",
  },
];

const CU_STEPS: GuideStep[] = [
  {
    id: "home-inspection",
    screen: "home",
    message: "Tap here to open inspections",
    targetId: "guide-home-inspection",
    placement: "top",
  },
  {
    id: "schedule-start-inspection",
    screen: "schedule-inspection",
    message: "Tap here to start an inspection",
    targetId: "guide-schedule-start",
    placement: "top",
  },
  {
    id: "inspection-info",
    screen: "inspection-details",
    message: "Review shipment details before you begin",
    targetId: "guide-inspection-info",
    placement: "bottom",
  },
  {
    id: "inspection-pre-shipment",
    screen: "inspection-details",
    message: "Start the Pre-Shipment inspection here",
    targetId: "guide-pre-shipment-start",
    placement: "top",
  },
];

export function getStepsForUser(isCU: boolean): GuideStep[] {
  return isCU ? CU_STEPS : CLIENT_STEPS;
}

export function loadOnboardingState(): OnboardingState {
  if (typeof window === "undefined") {
    return { completedSteps: [], skipped: false };
  }
  try {
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return { completedSteps: [], skipped: false };
    const parsed = JSON.parse(raw) as Partial<OnboardingState>;
    return {
      completedSteps: Array.isArray(parsed.completedSteps) ? parsed.completedSteps : [],
      skipped: Boolean(parsed.skipped),
    };
  } catch {
    return { completedSteps: [], skipped: false };
  }
}

export function saveOnboardingState(state: OnboardingState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
}

export function getActiveGuideStep(
  steps: GuideStep[],
  completedSteps: GuideStepId[],
  currentScreen: string,
  skipped: boolean,
  replaying: boolean,
): GuideStep | null {
  if (skipped && !replaying) return null;
  for (const step of steps) {
    if (completedSteps.includes(step.id)) continue;
    if (step.screen === currentScreen) return step;
    return null;
  }
  return null;
}

export function isOnboardingComplete(steps: GuideStep[], completedSteps: GuideStepId[]): boolean {
  return steps.every(s => completedSteps.includes(s.id));
}

/** Map app Screen values to guide screen keys. */
export function toGuideScreen(screen: string): GuideScreen | null {
  const map: Record<string, GuideScreen> = {
    location: "location",
    home: "home",
    "scan-log": "scan-log",
    "register-log-form": "register-log-form",
    "schedule-inspection": "schedule-inspection",
    "inspection-details": "inspection-details",
  };
  return map[screen] ?? null;
}

/** Steps auto-completed when the user lands on a screen (prior action done). */
export const SCREEN_ENTER_COMPLETIONS: Partial<Record<GuideScreen, GuideStepId[]>> = {
  home: ["location-concession"],
  "scan-log": ["home-register-log"],
  "register-log-form": ["scan-viewfinder"],
  "schedule-inspection": ["home-inspection"],
  "inspection-details": ["schedule-start-inspection"],
};
