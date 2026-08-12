import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CoachMark } from "./CoachMark";
import {
  getActiveGuideStep,
  getStepsForUser,
  isOnboardingComplete,
  loadOnboardingState,
  saveOnboardingState,
  SCREEN_ENTER_COMPLETIONS,
  toGuideScreen,
  type GuideStepId,
  type OnboardingState,
} from "../onboardingGuide";

interface OnboardingContextValue {
  completeStep: (id: GuideStepId) => void;
  skipAll: () => void;
  restartGuide: () => void;
  isGuideActive: boolean;
  guideComplete: boolean;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return ctx;
}

export function useOnboardingOptional() {
  return useContext(OnboardingContext);
}

interface OnboardingProviderProps {
  children: ReactNode;
  screen: string;
  isCU: boolean;
  isLoggedIn: boolean;
}

export function OnboardingProvider({ children, screen, isCU, isLoggedIn }: OnboardingProviderProps) {
  const [state, setState] = useState<OnboardingState>(() => loadOnboardingState());
  const [replaying, setReplaying] = useState(false);

  const steps = useMemo(() => getStepsForUser(isCU), [isCU]);
  const guideScreen = toGuideScreen(screen);

  const persist = useCallback((next: OnboardingState) => {
    setState(next);
    saveOnboardingState(next);
  }, []);

  const completeStep = useCallback(
    (id: GuideStepId) => {
      setState(prev => {
        if (prev.completedSteps.includes(id)) return prev;
        const completedSteps = [...prev.completedSteps, id];
        const next = { ...prev, completedSteps };
        saveOnboardingState(next);
        if (isOnboardingComplete(steps, completedSteps)) {
          setReplaying(false);
        }
        return next;
      });
    },
    [steps],
  );

  const skipAll = useCallback(() => {
    const next = { completedSteps: steps.map(s => s.id), skipped: true };
    persist(next);
    setReplaying(false);
  }, [persist, steps]);

  const restartGuide = useCallback(() => {
    const next = { completedSteps: [], skipped: false };
    persist(next);
    setReplaying(true);
  }, [persist]);

  // Auto-complete prior steps when user navigates forward.
  useEffect(() => {
    if (!isLoggedIn || !guideScreen) return;
    const autoComplete = SCREEN_ENTER_COMPLETIONS[guideScreen];
    if (!autoComplete?.length) return;
    setState(prev => {
      const additions = autoComplete.filter(id => !prev.completedSteps.includes(id));
      if (!additions.length) return prev;
      const next = { ...prev, completedSteps: [...prev.completedSteps, ...additions] };
      saveOnboardingState(next);
      return next;
    });
  }, [guideScreen, isLoggedIn]);

  const activeStep =
    isLoggedIn && guideScreen
      ? getActiveGuideStep(steps, state.completedSteps, guideScreen, state.skipped, replaying)
      : null;

  const guideComplete = isOnboardingComplete(steps, state.completedSteps);
  const isGuideActive = Boolean(activeStep) && (!state.skipped || replaying);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      completeStep,
      skipAll,
      restartGuide,
      isGuideActive,
      guideComplete,
    }),
    [completeStep, skipAll, restartGuide, isGuideActive, guideComplete],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {activeStep && (
        <CoachMark
          message={activeStep.message}
          targetId={activeStep.targetId}
          placement={activeStep.placement}
          onSkip={skipAll}
          onTargetInteract={() => completeStep(activeStep.id)}
        />
      )}
    </OnboardingContext.Provider>
  );
}
