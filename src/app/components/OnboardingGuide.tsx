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
import { TourWelcomeDialog } from "./TourWelcomeDialog";
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

const TOUR_ENTRY_SCREENS = new Set(["location", "home"]);

export function OnboardingProvider({ children, screen, isCU, isLoggedIn }: OnboardingProviderProps) {
  const [state, setState] = useState<OnboardingState>(() => loadOnboardingState());
  const [replaying, setReplaying] = useState(false);
  const [welcomeReady, setWelcomeReady] = useState(false);

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
    const next = {
      completedSteps: steps.map(s => s.id),
      skipped: true,
      tourPromptAnswered: true,
      tourAccepted: false,
    };
    persist(next);
    setReplaying(false);
  }, [persist, steps]);

  const restartGuide = useCallback(() => {
    const next = {
      completedSteps: [],
      skipped: false,
      tourPromptAnswered: true,
      tourAccepted: true,
    };
    persist(next);
    setReplaying(true);
  }, [persist]);

  const acceptTour = useCallback(() => {
    setWelcomeReady(false);
    setState(prev => {
      const next = {
        ...prev,
        skipped: false,
        tourPromptAnswered: true,
        tourAccepted: true,
      };
      saveOnboardingState(next);
      return next;
    });
    setReplaying(true);
  }, []);

  const dismissTourPrompt = useCallback(() => {
    setWelcomeReady(false);
    setState(prev => {
      const next = {
        ...prev,
        skipped: true,
        tourPromptAnswered: true,
        tourAccepted: false,
      };
      saveOnboardingState(next);
      return next;
    });
    setReplaying(false);
  }, []);

  const guideComplete = isOnboardingComplete(steps, state.completedSteps);
  const shouldOfferTour =
    isLoggedIn &&
    TOUR_ENTRY_SCREENS.has(screen) &&
    !state.tourPromptAnswered &&
    !guideComplete;

  // Brief delay after sign-in so the welcome prompt appears before any tour step.
  useEffect(() => {
    if (!shouldOfferTour) {
      setWelcomeReady(false);
      return;
    }
    const timer = window.setTimeout(() => setWelcomeReady(true), 450);
    return () => window.clearTimeout(timer);
  }, [shouldOfferTour, screen]);

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

  const tourReady = Boolean(state.tourAccepted) || replaying;
  const showWelcome = welcomeReady && shouldOfferTour;
  const isGuideActive =
    Boolean(activeStep) &&
    tourReady &&
    !showWelcome &&
    (!state.skipped || replaying);

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
      {showWelcome && (
        <TourWelcomeDialog onStart={acceptTour} onDismiss={dismissTourPrompt} />
      )}
      {isGuideActive && activeStep && (
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
