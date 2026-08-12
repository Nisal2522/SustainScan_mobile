import { useState, useRef, useEffect, type ChangeEvent, type ReactNode, type CSSProperties, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import {
  Eye, EyeOff, Mail, Lock, ChevronRight, MapPin, ChevronDown,
  Moon, Sun, LogOut, ClipboardList, Package, RefreshCw, ArrowLeft,
  ScanLine, QrCode, Calendar, Search, ListFilter, X, Truck, CheckCircle2, ArrowRight,
  Ship, Anchor, CircleDollarSign, Layers, Container, Paperclip, Scale, FileText,
  Clock, Plus, Camera, Upload, Home, Image as ImageIcon, Trash2, AlertTriangle,
} from "lucide-react";
import bgImage from "../imports/ChatGPT_Image_Apr_28__2026__03_22_59_PM__1___1_.png";
import sustainscanLogo from "../imports/logo_horizontal_transparent.png";
import controlUnionLogo from "../imports/CU_Logo_4_White_1.png";
import profilePhoto from "../imports/image.png";
import qrCode from "../imports/image-1.png";
import logEntryPhoto from "../imports/timber.png";

// ─── Types ────────────────────────────────────────────────────────────────────

type LoginTab = "client" | "cu";
type UserType = "client" | "cu";
type Screen = "login" | "cu-signin" | "location" | "home" | "scan-log" | "register-log-form" | "inventory-hub" | "log-inventory" | "schedule-inspection" | "inspection-details" | "inspection-info-details" | "approved-price-endorsement" | "declared-log-details" | "permitted-vs-declared" | "physical-verification" | "sample-verification-scan" | "sample-verification-log" | "loading-logs-scan";
type InspectionDay = "today" | "tomorrow" | "later";
type InspectionStatus = "pending" | "inprogress" | "complete";
type StatusFilter = "all" | InspectionStatus;
type SubInspectionStatus = "not-started" | "in-progress" | "completed";

interface PhysicalVerificationDraft {
  volumeOk: "yes" | "no" | null;
  photoAdded: boolean;
  nonConformanceReason: string;
  physicalStepComplete: boolean;
  sampleStepComplete: boolean;
  /** When true, sample scans are waived if a mandatory reason is provided. */
  noSamplesAvailable: boolean;
  noSamplesReason: string;
}

const EMPTY_PHYSICAL_VERIFICATION: PhysicalVerificationDraft = {
  volumeOk: null,
  photoAdded: false,
  nonConformanceReason: "",
  physicalStepComplete: false,
  sampleStepComplete: false,
  noSamplesAvailable: false,
  noSamplesReason: "",
};

/** Outdoor-readable muted text (avoids low-contrast gray-on-light). */
const FIELD_TEXT_MUTED = "#3d4f7c";
const FIELD_TEXT_FAINT = "#4a5d8a";

interface CompletionGate {
  canComplete: boolean;
  blockers: string[];
}

function evaluatePreShipmentCompletion(
  draft: PhysicalVerificationDraft,
  sampleScanCount: number,
): CompletionGate {
  const blockers: string[] = [];
  if (!draft.physicalStepComplete) {
    blockers.push("Submit the physical inspection before finishing.");
  }
  const hasSamples = sampleScanCount > 0;
  const hasNoSamplesReason =
    draft.noSamplesAvailable && draft.noSamplesReason.trim().length > 0;
  if (!hasSamples && !hasNoSamplesReason) {
    blockers.push(
      draft.noSamplesAvailable
        ? "Enter a reason why no samples are available."
        : "Scan at least one sample QR, or record a “No Samples Available” reason.",
    );
  }
  return { canComplete: blockers.length === 0, blockers };
}

function evaluateLoadingCompletion(activeAllocatedCount: number): CompletionGate {
  const blockers: string[] = [];
  if (activeAllocatedCount <= 0) {
    blockers.push("Allocate at least one loaded log before finishing.");
  }
  return { canComplete: blockers.length === 0, blockers };
}

interface InspectionTask {
  id: string;
  shipment: string;
  exporter: string;
  location: string;
  time: string;
  logs: number;
  day: InspectionDay;
  status: InspectionStatus;
}

interface InspectionProgress {
  preShipment: SubInspectionStatus;
  loading: SubInspectionStatus;
  preShipmentStartDate: string | null;
  preShipmentEndDate: string | null;
  loadingStartDate: string | null;
  loadingEndDate: string | null;
}

const EMPTY_INSPECTION_PROGRESS: InspectionProgress = {
  preShipment: "not-started",
  loading: "not-started",
  preShipmentStartDate: null,
  preShipmentEndDate: null,
  loadingStartDate: null,
  loadingEndDate: null,
};

interface FormState { email: string; password: string; showPassword: boolean; }

interface InventoryItem {
  id: number; species: string; length: number; diameter: number;
  volume: number; defectVolume: number; date: string; modified: boolean;
  logGroup: string; serialNo: string; batchNo: string; defReason: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BG_URL = bgImage;

const GRADIENT = "linear-gradient(135deg,#1a45b5 0%,#0f2f8f 60%,#0a1f6b 100%)";

/** Count-up for inspection volume readouts (respects reduced motion). */
function useCountUp(target: number, durationMs = 720, restartKey: string | number = 0) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, restartKey]);
  return value;
}

/** Opacity + scale focus effect for scrollable card lists (respects reduced motion). */
function useScrollFocusList(itemCount: number, listKey: string) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);

  const updateFocus = () => {
    const container = scrollRef.current;
    if (!container) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      itemRefs.current.forEach(el => {
        if (!el) return;
        el.style.transform = "";
        el.style.opacity = "";
      });
      return;
    }

    const rect = container.getBoundingClientRect();
    const focusRadius = Math.max(rect.height * 0.42, 140);
    const atTop = container.scrollTop < 32;
    const firstEl = itemRefs.current[0];

    const focusY = atTop && firstEl
      ? (() => {
          const firstRect = firstEl.getBoundingClientRect();
          return firstRect.top + firstRect.height / 2;
        })()
      : rect.top + rect.height * 0.46;

    itemRefs.current.forEach(el => {
      if (!el) return;
      const itemRect = el.getBoundingClientRect();
      const itemCenterY = itemRect.top + itemRect.height / 2;
      const dist = Math.abs(itemCenterY - focusY);
      const t = Math.min(1, dist / focusRadius);
      const scale = 1 - t * 0.1;
      const opacity = 1 - t * 0.52;
      el.style.transform = `scale(${scale.toFixed(3)})`;
      el.style.opacity = `${opacity.toFixed(3)}`;
    });
  };

  const scheduleFocus = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      updateFocus();
    });
  };

  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, itemCount);
  }, [itemCount, listKey]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || itemCount === 0) return;

    scheduleFocus();
    const settleTimers = [
      window.setTimeout(scheduleFocus, 120),
      window.setTimeout(scheduleFocus, 520),
      window.setTimeout(scheduleFocus, 900),
    ];

    container.addEventListener("scroll", scheduleFocus, { passive: true });
    window.addEventListener("resize", scheduleFocus);

    return () => {
      settleTimers.forEach(clearTimeout);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      container.removeEventListener("scroll", scheduleFocus);
      window.removeEventListener("resize", scheduleFocus);
    };
  }, [itemCount, listKey]);

  const setItemRef = (index: number) => (el: HTMLDivElement | null) => {
    itemRefs.current[index] = el;
    if (el && index === itemCount - 1) scheduleFocus();
  };

  return { scrollRef, setItemRef };
}

function LiquidTabBar({
  items,
  value,
  onChange,
  ariaLabel,
  dark = false,
}: {
  items: { id: string; node: ReactNode }[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  dark?: boolean;
}) {
  const activeIndex = Math.max(0, items.findIndex(item => item.id === value));
  const n = Math.max(1, items.length);
  const trackPad = 4;
  const gap = 2;

  return (
    <div
      className="liquid-tab-track animate-riseIn"
      style={{
        gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
        background: dark ? "rgba(30, 41, 59, 0.65)" : "rgba(255,255,255,0.88)",
        border: `1px solid ${dark ? "rgba(255,255,255,0.10)" : "rgba(15,47,143,0.10)"}`,
        borderRadius: 16,
        boxShadow: dark ? "0 2px 12px rgba(0,0,0,0.22)" : "0 2px 10px rgba(15,47,143,0.05)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        ["--rise-delay" as string]: "40ms",
      }}
      role="tablist"
      aria-label={ariaLabel}
    >
      <div
        className="liquid-tab-indicator"
        style={{
          width: `calc((100% - ${trackPad * 2}px - ${(n - 1) * gap}px) / ${n})`,
          left: `calc(${trackPad}px + ${activeIndex} * ((100% - ${trackPad * 2}px - ${(n - 1) * gap}px) / ${n} + ${gap}px))`,
        }}
        aria-hidden="true"
      />
      {items.map(item => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className="liquid-tab-btn pressable min-h-12 h-12 rounded-xl text-[12px] sm:text-[13px] font-semibold focus:outline-none px-1.5 min-w-0"
            style={{ color: active ? "#ffffff" : dark ? "rgba(255,255,255,0.82)" : FIELD_TEXT_MUTED }}
          >
            {item.node}
          </button>
        );
      })}
    </div>
  );
}

const SESSION_KEY = "sustainscan-session";

interface AppSession {
  screen: Screen;
  userType: UserType;
  location: string;
  dark: boolean;
  selectedInspectionId: string | null;
}

const AUTHENTICATED_SCREENS: Screen[] = [
  "location", "home", "scan-log", "register-log-form", "inventory-hub", "log-inventory", "schedule-inspection", "inspection-details", "inspection-info-details", "approved-price-endorsement", "declared-log-details", "permitted-vs-declared", "physical-verification",
  "sample-verification-scan", "sample-verification-log", "loading-logs-scan",
];

const INSPECTION_TASK_SCREENS: Screen[] = [
  "inspection-details", "inspection-info-details", "approved-price-endorsement", "declared-log-details", "permitted-vs-declared", "physical-verification",
  "sample-verification-scan", "sample-verification-log", "loading-logs-scan",
];

/** Primary hubs where the persistent bottom nav is shown. */
const BOTTOM_NAV_SCREENS: Screen[] = ["home", "scan-log", "schedule-inspection"];

/** Full Schedule module — Schedule tab stays selected across these screens. */
const SCHEDULE_MODULE_SCREENS: Screen[] = [
  "schedule-inspection",
  "inspection-details",
  "inspection-info-details",
  "approved-price-endorsement",
  "declared-log-details",
  "permitted-vs-declared",
  "physical-verification",
  "sample-verification-scan",
  "sample-verification-log",
  "loading-logs-scan",
];

const BOTTOM_NAV_VISIBLE_SCREENS: Screen[] = Array.from(
  new Set<Screen>([...BOTTOM_NAV_SCREENS, ...SCHEDULE_MODULE_SCREENS]),
);

const BOTTOM_NAV_PAD = "max(1.5rem, env(safe-area-inset-bottom, 0px))";

function resolveBottomNavTab(screen: Screen): Screen | null {
  if (SCHEDULE_MODULE_SCREENS.includes(screen)) return "schedule-inspection";
  if (BOTTOM_NAV_SCREENS.includes(screen)) return screen;
  return null;
}

function saveSession(session: AppSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function resolveExporterForConcession(concession: string): string {
  const match = CU_CLIENT_DIRECTORY.find(c =>
    (c.concessions as readonly string[]).includes(concession),
  );
  return match?.name ?? CU_CLIENT_DIRECTORY[0].name;
}

const CONCESSIONS = ["Concession Unit A", "Concession Unit B"];

const CU_CLIENT_DIRECTORY = [
  {
    name: "Open Bay Timber Limited",
    contact: "Mike Ron",
    tel: "+675 982 9827",
    concessions: ["Concession Unit A", "Concession Unit B"],
  },
  {
    name: "Rimbunan Hijau (PNG) Limited",
    contact: "Olive Kiu",
    tel: "(675) 325 7677",
    concessions: ["Concession Unit 01", "Concession Unit 02"],
  },
] as const;

/** Timber species master list (Log Inventory & product names) */
const TIMBER_SPECIES = [
  "Burckella", "Grey Canarium", "Calophyllum", "Red Canarium", "Pencil Cedar", "Dillenia",
  "Erima", "Hekakoro", "Kwila", "Lophopetalum/Perupo", "Malas", "PNG Mersawa",
  "Red Planchonella", "White Planchonella", "Taun", "Terminalia", "PNG Walnut",
  "Aglaia", "Amoora/Pacific Maple", "Antiaris", "PNG Basswood", "Wau Beech",
  "Mangrove Cedar", "Red Cedar", "Hopea Heavy", "Hopea Light", "Kamarere", "Kempas",
  "Labula", "Silkwood Maple", "Vitex", "Amberoi", "PNG Camphorwood", "Campnosperma",
  "Hard Celtis", "Light Celtis", "Cryptocarya/Medang", "Dysox", "Endiandra/Medang",
  "Gara Gara", "Water Gum", "Heritiera", "Litsea", "Pink Satinwood", "White Siris",
  "Brown Albizia", "Hard Albizia", "White Albizia", "White Almond", "Scaly Ash",
  "Silver Ash / Silkwood Ash", "PNG Hickory Ash", "Papuan Silver Ash", "PNG Bassia",
  "Pink Birch", "Bombax", "PNG Swamp Box", "PNG Brownwood", "Brown Tulip Oak",
  "Canthium", "Caranga", "Java Cedar", "Chrysophyllum", "Corallia", "PNG Coachwood",
  "White Cheesewood", "Yellow Cheesewood", "Drypetes", "Duabanga", "Evodia Heavy",
  "Evodia Light", "Fig", "Flacourtia", "White Magnolia", "Garuga", "Glochidion",
  "Gmelina / White Beech", "Gonystylus", "Gordonia", "Yellow Hardwood", "Hernandia",
  "Bulolo Ash", "Horsfieldia", "Scrub Ironbark", "PNG Ivorywood", "Kasi Kasi", "Kandis",
  "Kaplak", "Kingiodendron", "Kiso", "PNG Lapome", "Black Mangrove", "Macaranga",
  "Manilkara", "Milky Mangrove", "Mango", "Red Mangrove", "Scented Maple", "Maniltoa",
  "White Mangrove", "Brown Mangrove", "Grey Milkwood", "Neoscortechinia", "Neuburgia", "Nutmeg",
] as const;

const INVENTORY_ITEMS: InventoryItem[] = [
  { id: 1,  species: "Burckella",      length: 10.0, diameter: 11.0, volume: 12.0,  defectVolume: 13.0, date: "2026-05-25", modified: false,
    logGroup: "Group 1", serialNo: "0000000001", batchNo: "B-001", defReason: "—" },
  { id: 2,  species: "Grey Canarium",  length: 11.0, diameter: 12.1, volume: 12.0,  defectVolume: 13.0, date: "2026-05-25", modified: false,
    logGroup: "Group 1", serialNo: "0000000002", batchNo: "B-002", defReason: "—" },
  { id: 3,  species: "Calophyllum",    length:  4.0, diameter:  5.0, volume:  6.0,  defectVolume: 10.0, date: "2026-05-25", modified: true,
    logGroup: "Group 1", serialNo: "0000000003", batchNo: "—", defReason: "Reason" },
  { id: 4,  species: "Banana",         length: 11.1, diameter: 12.2, volume: 13.3,  defectVolume: 14.4, date: "2026-05-22", modified: true,
    logGroup: "Group 2", serialNo: "0000000004", batchNo: "B-022", defReason: "Crack" },
  { id: 5,  species: "Red Canarium",   length: 10.0, diameter: 20.0, volume: 30.0,  defectVolume: 40.0, date: "2026-05-22", modified: false,
    logGroup: "Group 1", serialNo: "0000000005", batchNo: "B-005", defReason: "—" },
  { id: 6,  species: "Pencil Cedar",   length: 10.0, diameter: 20.0, volume: 204.0, defectVolume: 10.0, date: "2026-05-22", modified: false,
    logGroup: "Group 1", serialNo: "0000000006", batchNo: "B-006", defReason: "—" },
  { id: 7,  species: "Dillenia",       length:  1.0, diameter:  2.0, volume:  3.0,  defectVolume:  4.0, date: "2026-05-22", modified: false,
    logGroup: "Group 1", serialNo: "0000000007", batchNo: "B-007", defReason: "—" },
  { id: 8,  species: "Meranti",        length:  8.5, diameter:  9.2, volume: 15.3,  defectVolume:  2.1, date: "2026-05-20", modified: true,
    logGroup: "Group 2", serialNo: "0000000008", batchNo: "B-019", defReason: "Split end" },
  { id: 9,  species: "Taun",           length:  6.0, diameter:  7.5, volume:  9.0,  defectVolume:  1.5, date: "2026-05-20", modified: false,
    logGroup: "Group 1", serialNo: "0000000009", batchNo: "B-009", defReason: "—" },
  { id: 10, species: "Acacia",         length: 12.0, diameter: 14.0, volume: 22.5,  defectVolume:  3.0, date: "2026-05-18", modified: false,
    logGroup: "Group 2", serialNo: "0000000010", batchNo: "B-010", defReason: "—" },
];

const LAST_SYNC = new Date(Date.now() - 1000 * 60 * 47);

const SCHEDULED_INSPECTIONS: InspectionTask[] = [
  {
    id: "1",
    shipment: "#INP-2024-001",
    exporter: "GreenWood Timber Exports Ltd",
    location: "Port Terminal A",
    time: "06–08 Aug",
    logs: 48,
    day: "today",
    status: "inprogress",
  },
  {
    id: "2",
    shipment: "#INP-2024-002",
    exporter: "Nordic Wood Exports",
    location: "Central Yard 4",
    time: "06–07 Aug",
    logs: 32,
    day: "today",
    status: "pending",
  },
  {
    id: "3",
    shipment: "#INP-2024-003",
    exporter: "Coastal Pine Ltd",
    location: "North Docking Bay",
    time: "06–09 Aug",
    logs: 56,
    day: "today",
    status: "pending",
  },
  {
    id: "4",
    shipment: "#INP-2024-004",
    exporter: "Amazonia Hardwoods",
    location: "West Logistics Hub",
    time: "06–08 Aug",
    logs: 21,
    day: "today",
    status: "complete",
  },
  {
    id: "7",
    shipment: "#INP-2024-007",
    exporter: "Pacific Timber Co",
    location: "South Quay",
    time: "07–09 Aug",
    logs: 27,
    day: "tomorrow",
    status: "pending",
  },
  {
    id: "8",
    shipment: "#INP-2024-008",
    exporter: "Highland Logs Ltd",
    location: "Inland Yard 2",
    time: "07–10 Aug",
    logs: 35,
    day: "tomorrow",
    status: "inprogress",
  },
  {
    id: "9",
    shipment: "#INP-2024-009",
    exporter: "River Bend Exports",
    location: "River Terminal",
    time: "10–12 Aug",
    logs: 44,
    day: "later",
    status: "pending",
  },
];


function formatSyncTime(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    + " · " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function todayISODate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ─── Shared: blurred background ───────────────────────────────────────────────

function Background() {
  const [bgReady, setBgReady] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.src = BG_URL;
    img.onload = () => setBgReady(true);
  }, []);

  return (
    <>
      <div className="absolute inset-0" style={{ background: "#0a162e" }} aria-hidden="true" />
      {bgReady && (
        <div
          className="absolute inset-0 bg-emerald-900 animate-fadeIn"
          style={{
            backgroundImage: `url(${BG_URL})`,
            backgroundSize: "cover",
            backgroundPosition: "18% center",
            filter: "blur(3px) brightness(0.68) saturate(1.15)",
            transform: "scale(1.05)",
          }}
          aria-hidden="true"
        />
      )}
      <div className="absolute inset-0" style={{ background: "rgba(10,22,70,0.45)" }} aria-hidden="true" />
    </>
  );
}

function PoweredBy() {
  return (
    <div
      className="powered-by flex flex-col items-center gap-1.5 pt-3"
      style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
    >
      <span className="text-[10px] font-medium uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.45)" }}>
        Powered by
      </span>
      <img
        src={controlUnionLogo}
        alt="Control Union"
        className="powered-by-logo object-contain drop-shadow-lg"
      />
    </div>
  );
}

// ─── Shared page header: Logo LEFT · [←][🌙][extra] RIGHT ─────────────────────

function AppHeaderBar({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const readScrollTop = () => {
      const shell = document.querySelector(".mobile-viewport") as HTMLElement | null;
      const top = shell ? shell.scrollTop : (window.scrollY || document.documentElement.scrollTop);
      setScrolled(top > 8);
    };

    readScrollTop();
    const shell = document.querySelector(".mobile-viewport");
    const target: HTMLElement | Window = shell instanceof HTMLElement ? shell : window;
    target.addEventListener("scroll", readScrollTop, { passive: true });
    return () => target.removeEventListener("scroll", readScrollTop);
  }, []);

  return (
    <div
      className="sticky top-0 z-40 w-full transition-[background,box-shadow,border-color] duration-300"
      style={{
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        paddingTop: "env(safe-area-inset-top)",
        background: dark
          ? scrolled ? "rgba(15,23,42,0.82)" : "rgba(15,23,42,0.55)"
          : scrolled ? "rgba(248,249,250,0.86)" : "rgba(255,255,255,0.58)",
        borderBottom: scrolled
          ? dark ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(15,47,143,0.10)"
          : "1px solid transparent",
        boxShadow: scrolled
          ? dark ? "0 8px 24px rgba(0,0,0,0.28)" : "0 8px 24px rgba(15,47,143,0.08)"
          : "none",
      }}
    >
      <div
        className="w-full max-w-[480px] mx-auto py-3.5 sm:py-4"
        style={{
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function BackCardButton({ onClick, dark = false }: { onClick: () => void; dark?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="field-touch w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 hover:scale-105 focus:outline-none pressable"
      style={{
        background: dark ? "rgba(255,255,255,0.12)" : "#ffffff",
        color: dark ? "#ffffff" : "#0a1a4a",
        border: dark ? "1.5px solid rgba(255,255,255,0.20)" : "1.5px solid rgba(15,47,143,0.22)",
        boxShadow: dark ? "none" : "0 1px 4px rgba(15,47,143,0.08)",
      }}
      aria-label="Go back"
    >
      <ArrowLeft size={18} />
    </button>
  );
}

function PageHeader({ dark, onBack, onDarkToggle, extra }: {
  dark: boolean; onBack?: () => void; onDarkToggle?: () => void; extra?: React.ReactNode;
}) {
  const btn = { background: dark ? "rgba(255,255,255,0.1)" : "rgba(15,47,143,0.08)", color: dark ? "#ffffff" : "#0f2f8f" };
  return (
    <div className="flex items-center justify-between gap-3 w-full min-w-0">
      <img
        src={sustainscanLogo}
        alt="SustainScan"
        className="h-6 sm:h-7 w-auto max-w-[50%] object-contain object-left flex-shrink min-w-0"
        style={{ filter: dark ? "brightness(0) invert(1)" : "none" }}
      />
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        {onBack && (
          <button onClick={onBack}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 focus:outline-none flex-shrink-0"
            style={btn} aria-label="Go back">
            <ArrowLeft size={17} />
          </button>
        )}
        {onDarkToggle && (
          <button onClick={onDarkToggle}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 focus:outline-none flex-shrink-0"
            style={btn} aria-label={dark ? "Light mode" : "Dark mode"}>
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        )}
        {extra}
      </div>
    </div>
  );
}

type BottomNavItem = {
  id: string;
  label: string;
  screen: Screen;
  icon: typeof Home;
};

function getBottomNavItems(isCU: boolean): BottomNavItem[] {
  if (isCU) {
    return [
      { id: "home", label: "Home", screen: "home", icon: Home },
      { id: "scan", label: "Scan", screen: "scan-log", icon: ScanLine },
      { id: "schedule", label: "Inspection", screen: "schedule-inspection", icon: Calendar },
      { id: "inventory", label: "Inventory", screen: "log-inventory", icon: Package },
    ];
  }
  return [
    { id: "home", label: "Home", screen: "home", icon: Home },
    { id: "register", label: "Register", screen: "scan-log", icon: ClipboardList },
    { id: "inventory", label: "Inventory", screen: "log-inventory", icon: Package },
  ];
}

function BottomNavBar({
  dark,
  isCU,
  activeScreen,
  onNavigate,
  onInventoryClick,
}: {
  dark: boolean;
  isCU: boolean;
  activeScreen: Screen;
  onNavigate: (s: Screen) => void;
  onInventoryClick: () => void;
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const items = getBottomNavItems(isCU);

  useEffect(() => {
    setHost(document.querySelector(".mobile-device") as HTMLElement | null);
  }, []);

  if (!host || !BOTTOM_NAV_VISIBLE_SCREENS.includes(activeScreen)) return null;

  const selectedTab = resolveBottomNavTab(activeScreen) ?? activeScreen;

  const bar = (
    <nav
      className="app-bottom-nav"
      aria-label="Primary"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 55,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        pointerEvents: "none",
      }}
    >
      <div
        className={`mx-3 mb-3 rounded-[1.35rem] px-1.5 py-1.5 flex items-stretch gap-0.5 glow-footer-bar${dark ? " glow-footer-bar--dark" : ""}`}
        style={{ pointerEvents: "auto" }}
      >
        {items.map(item => {
          const active = selectedTab === item.screen;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === "inventory") onInventoryClick();
                else onNavigate(item.screen);
              }}
              aria-current={active ? "page" : undefined}
              className={`relative z-[1] flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2 rounded-2xl focus:outline-none active:scale-[0.96] transition-all duration-200${active ? (dark ? " glow-footer-tab--active-dark" : " glow-footer-tab--active") : ""}`}
              style={{
                background: active ? (dark ? "rgba(59,130,246,0.18)" : "rgba(15,47,143,0.08)") : "transparent",
                color: active ? (dark ? "#93c5fd" : "#0f2f8f") : (dark ? "rgba(255,255,255,0.55)" : "#5a6a99"),
              }}
            >
              {active && (
                <span
                  className="absolute top-1.5 w-4 h-0.5 rounded-full"
                  style={{ background: dark ? "#60a5fa" : GRADIENT }}
                  aria-hidden="true"
                />
              )}
              <Icon size={20} strokeWidth={active ? 2.35 : 1.9} />
              <span className={`text-[10px] tracking-wide ${active ? "font-bold" : "font-semibold"}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );

  return createPortal(bar, host);
}

// ─── Login Screen ─────────────────────────────────────────────────────────────

function LoginScreen({ onSignIn, onCUSignIn }: { onSignIn: () => void; onCUSignIn: () => void }) {
  const [activeTab, setActiveTab] = useState<LoginTab>("client");
  const [clientForm, setClientForm] = useState<FormState>({ email: "", password: "", showPassword: false });

  useEffect(() => {
    (window as any).navigateToCU = onCUSignIn;
    return () => { delete (window as any).navigateToCU; };
  }, [onCUSignIn]);

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden animate-fadeIn" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Background />
      <div className="relative z-10 w-full max-w-[420px] mx-auto px-4 sm:mx-4 flex flex-col min-h-screen py-8 sm:py-10 items-center justify-between gap-6">
        <div className="flex flex-col items-center gap-3 pt-4">
          <img src={sustainscanLogo} alt="SustainScan" className="w-44 drop-shadow-2xl" style={{ filter: "brightness(0) invert(1)" }} />
        </div>

        {/* overflow-hidden kept here so tab active bg clips to rounded corners */}
        <div className="w-full rounded-3xl overflow-hidden shadow-2xl"
          style={{ background: "rgba(255,255,255,0.10)", backdropFilter: "blur(24px) saturate(1.6)", WebkitBackdropFilter: "blur(24px) saturate(1.6)", border: "1px solid rgba(255,255,255,0.28)" }}>
          <div className="flex" style={{ borderBottom: "1px solid rgba(255,255,255,0.2)" }}>
            {(["client", "cu"] as LoginTab[]).map(tab => {
              const active = activeTab === tab;
              return (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className="flex-1 py-4 text-sm font-semibold tracking-wide transition-all duration-200 focus:outline-none"
                  style={{ color: active ? "#fff" : "rgba(255,255,255,0.55)", background: active ? "rgba(15,47,143,0.72)" : "transparent", borderBottom: active ? "2px solid #60a5fa" : "2px solid transparent" }}>
                  {tab === "client" ? "Log in as Client" : "Log in as CU"}
                </button>
              );
            })}
          </div>
          <form onSubmit={e => { e.preventDefault(); onSignIn(); }} className="px-7 py-8 flex flex-col gap-5">
            {activeTab === "client" ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="client-email" className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.75)" }}>Email</label>
                  <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.3)" }}>
                    <Mail size={16} style={{ color: "rgba(255,255,255,0.6)" }} />
                    <input id="client-email" type="email" placeholder="you@example.com" value={clientForm.email} onChange={e => setClientForm(p => ({ ...p, email: e.target.value }))} autoComplete="email" className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/40 text-white" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="client-password" className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.75)" }}>Password</label>
                  <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.3)" }}>
                    <Lock size={16} style={{ color: "rgba(255,255,255,0.6)" }} />
                    <input id="client-password" type={clientForm.showPassword ? "text" : "password"} placeholder="••••••••" value={clientForm.password} onChange={e => setClientForm(p => ({ ...p, password: e.target.value }))} autoComplete="current-password" className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/40 text-white" />
                    <button type="button" onClick={() => setClientForm(p => ({ ...p, showPassword: !p.showPassword }))} className="focus:outline-none" style={{ color: "rgba(255,255,255,0.55)" }}>
                      {clientForm.showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button type="submit" className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:brightness-110 active:scale-[0.98] focus:outline-none"
                  style={{ background: GRADIENT, boxShadow: "0 4px 24px rgba(15,47,143,0.5),inset 0 1px 0 rgba(255,255,255,0.15)" }}>
                  Sign In <ChevronRight size={16} />
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-6 py-4">
                <p className="text-sm text-center" style={{ color: "rgba(255,255,255,0.7)" }}>
                  Sign in with your Control Union account to continue.
                </p>
                <button type="button" onClick={() => (window as any).navigateToCU?.()}
                  className="w-full flex items-center justify-center gap-3 rounded-xl py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98] focus:outline-none"
                  style={{ background: GRADIENT, boxShadow: "0 4px 24px rgba(15,47,143,0.5),inset 0 1px 0 rgba(255,255,255,0.15)" }}>
                  <svg width="20" height="20" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                    <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                    <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                    <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
                  </svg>
                  Sign in with CU
                </button>
              </div>
            )}
          </form>
        </div>

        <PoweredBy />
      </div>
    </div>
  );
}

// ─── CU Sign-In Screen ────────────────────────────────────────────────────────

function CUSignInScreen({ onNext }: { onNext: (location: string) => void }) {
  const [client, setClient] = useState("");
  const [concession, setConcession] = useState("");
  const [clientOpen, setClientOpen] = useState(false);
  const [concessionOpen, setConcessionOpen] = useState(false);

  const selectedClient = CU_CLIENT_DIRECTORY.find(c => c.name === client);
  const concessions = selectedClient?.concessions ?? [];

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden animate-fadeIn" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Background />
      <div className="relative z-10 w-full max-w-[420px] mx-auto px-4 sm:mx-4 flex flex-col min-h-screen py-8 sm:py-10 items-center justify-between gap-6">
        <div className="flex flex-col items-center gap-3 pt-4">
          <img src={sustainscanLogo} alt="SustainScan" className="w-44 drop-shadow-2xl" style={{ filter: "brightness(0) invert(1)" }} />
        </div>

        <div className="w-full rounded-3xl shadow-2xl"
          style={{ background: "rgba(255,255,255,0.10)", backdropFilter: "blur(24px) saturate(1.6)", WebkitBackdropFilter: "blur(24px) saturate(1.6)", border: "1px solid rgba(255,255,255,0.28)" }}>
          <div className="px-7 py-8 flex flex-col gap-6">
            {/* Select Client */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.75)" }}>Select Client</label>
              <div className="relative">
                <button type="button" onClick={() => { setClientOpen(v => !v); setConcessionOpen(false); }}
                  className="w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm text-left transition-all duration-150 focus:outline-none"
                  style={{ background: "rgba(255,255,255,0.10)", border: `1px solid ${clientOpen ? "rgba(96,165,250,0.6)" : "rgba(255,255,255,0.3)"}`, color: client ? "#fff" : "rgba(255,255,255,0.4)" }}>
                  <span className="truncate">{client || "Select a client…"}</span>
                  <ChevronDown size={16} style={{ color: "rgba(255,255,255,0.6)", transform: clientOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }} />
                </button>
                {clientOpen && (
                  <div className="absolute left-0 right-0 mt-2 rounded-2xl z-30"
                    style={{ background: "rgba(10,22,70,0.97)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.2)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", maxHeight: "200px", overflowY: "auto" }}>
                    {CU_CLIENT_DIRECTORY.map(c => (
                      <button key={c.name} type="button" onClick={() => { setClient(c.name); setConcession(""); setClientOpen(false); }}
                        className="w-full text-left px-4 py-3 text-sm transition-colors duration-100 hover:bg-white/10 focus:outline-none"
                        style={{ color: client === c.name ? "#93c5fd" : "rgba(255,255,255,0.85)", fontWeight: client === c.name ? 600 : 400, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Select Concession — options depend on selected client */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.75)" }}>Select Concession</label>
              <div className="relative">
                <button type="button" disabled={!client}
                  onClick={() => { if (client) { setConcessionOpen(v => !v); setClientOpen(false); } }}
                  className="w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm text-left transition-all duration-150 focus:outline-none"
                  style={{
                    background: "rgba(255,255,255,0.10)",
                    border: `1px solid ${concessionOpen ? "rgba(96,165,250,0.6)" : "rgba(255,255,255,0.3)"}`,
                    color: concession ? "#fff" : "rgba(255,255,255,0.4)",
                    opacity: client ? 1 : 0.55,
                    cursor: client ? "pointer" : "not-allowed",
                  }}>
                  <span className="truncate">{concession || (client ? "Select a concession…" : "Select a client first…")}</span>
                  <ChevronDown size={16} style={{ color: "rgba(255,255,255,0.6)", transform: concessionOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }} />
                </button>
                {concessionOpen && concessions.length > 0 && (
                  <div className="absolute left-0 right-0 mt-2 rounded-2xl z-30"
                    style={{ background: "rgba(10,22,70,0.97)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.2)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", maxHeight: "200px", overflowY: "auto" }}>
                    {concessions.map(loc => (
                      <button key={loc} type="button" onClick={() => { setConcession(loc); setConcessionOpen(false); }}
                        className="w-full text-left px-4 py-3 text-sm transition-colors duration-100 hover:bg-white/10 focus:outline-none"
                        style={{ color: concession === loc ? "#93c5fd" : "rgba(255,255,255,0.85)", fontWeight: concession === loc ? 600 : 400, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        {loc}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button type="button" onClick={() => client && concession && onNext(concession)} disabled={!client || !concession}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold shadow-lg transition-all duration-200 focus:outline-none"
              style={{ background: (client && concession) ? GRADIENT : "rgba(255,255,255,0.10)", boxShadow: (client && concession) ? "0 4px 24px rgba(15,47,143,0.5),inset 0 1px 0 rgba(255,255,255,0.15)" : "none", color: (client && concession) ? "#fff" : "rgba(255,255,255,0.3)", cursor: (client && concession) ? "pointer" : "not-allowed" }}>
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div style={{ height: "1.25rem" }} />
        <PoweredBy />
      </div>
    </div>
  );
}

// ─── Location Screen ──────────────────────────────────────────────────────────

function LocationScreen({ onNext }: { onNext: (location: string) => void }) {
  const [selected, setSelected] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden animate-fadeIn" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Background />
      <div className="relative z-10 w-full max-w-[420px] mx-auto px-4 sm:mx-4 flex flex-col min-h-screen py-8 sm:py-10 items-center justify-between gap-6">
        <div className="flex flex-col items-center gap-3 pt-4">
          <img src={sustainscanLogo} alt="SustainScan" className="w-44 drop-shadow-2xl" style={{ filter: "brightness(0) invert(1)" }} />
        </div>

        {/* No overflow-hidden here so the dropdown is never clipped */}
        <div className="w-full rounded-3xl shadow-2xl"
          style={{ background: "rgba(255,255,255,0.10)", backdropFilter: "blur(24px) saturate(1.6)", WebkitBackdropFilter: "blur(24px) saturate(1.6)", border: "1px solid rgba(255,255,255,0.28)" }}>
          <div className="px-7 pt-8 pb-5 rounded-t-3xl" style={{ borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(15,47,143,0.7)" }}>
                <MapPin size={17} className="text-white" />
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">Select Concession</h2>
            </div>
            <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>Choose the timber concession you are operating from.</p>
          </div>

          <div className="px-7 py-8 flex flex-col gap-6">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.75)" }}>Timber Concession</label>
              {/* relative wrapper so dropdown positions against this, not the card */}
              <div className="relative">
                <button type="button" onClick={() => setOpen(v => !v)}
                  className="w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm text-left transition-all duration-150 focus:outline-none"
                  style={{ background: "rgba(255,255,255,0.10)", border: `1px solid ${open ? "rgba(96,165,250,0.6)" : "rgba(255,255,255,0.3)"}`, color: selected ? "#fff" : "rgba(255,255,255,0.4)" }}>
                  <span className="truncate">{selected || "Select a concession…"}</span>
                  <ChevronDown size={16} style={{ color: "rgba(255,255,255,0.6)", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }} />
                </button>
                {open && (
                  <div className="absolute left-0 right-0 mt-2 rounded-2xl z-30"
                    style={{ background: "rgba(10,22,70,0.97)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.2)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", maxHeight: "260px", overflowY: "auto" }}>
                    {CONCESSIONS.map(loc => (
                      <button key={loc} type="button" onClick={() => { setSelected(loc); setOpen(false); }}
                        className="w-full text-left px-4 py-3 text-sm transition-colors duration-100 hover:bg-white/10 focus:outline-none"
                        style={{ color: selected === loc ? "#93c5fd" : "rgba(255,255,255,0.85)", fontWeight: selected === loc ? 600 : 400, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        {loc}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button type="button" onClick={() => selected && onNext(selected)} disabled={!selected}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold shadow-lg transition-all duration-200 focus:outline-none"
              style={{ background: selected ? GRADIENT : "rgba(255,255,255,0.10)", boxShadow: selected ? "0 4px 24px rgba(15,47,143,0.5),inset 0 1px 0 rgba(255,255,255,0.15)" : "none", color: selected ? "#fff" : "rgba(255,255,255,0.3)", cursor: selected ? "pointer" : "not-allowed" }}>
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div style={{ height: "1.25rem" }} />
        <PoweredBy />
      </div>
    </div>
  );
}

// ─── Home Screen ──────────────────────────────────────────────────────────────

function LogInventoryScopeSheet({
  dark,
  overlayBox,
  onClose,
  onConfirm,
}: {
  dark: boolean;
  overlayBox: { top: number; left: number; width: number; height: number };
  onClose: () => void;
  onConfirm: (exporter: string, concession: string) => void;
}) {
  const [exporter, setExporter] = useState("");
  const [concession, setConcession] = useState("");
  const [exporterOpen, setExporterOpen] = useState(false);
  const [concessionOpen, setConcessionOpen] = useState(false);

  const selectedExporter = CU_CLIENT_DIRECTORY.find(c => c.name === exporter);
  const concessions = selectedExporter?.concessions ?? [];
  const canContinue = Boolean(exporter && concession);

  const sheetBg = dark ? "#1e293b" : "#ffffff";
  const textPrimary = dark ? "#ffffff" : "#0a1a4a";
  const textMuted = dark ? "rgba(255,255,255,0.82)" : FIELD_TEXT_MUTED;
  const fieldBg = dark ? "rgba(255,255,255,0.06)" : "#f8faff";
  const fieldBorder = dark ? "rgba(255,255,255,0.12)" : "rgba(15,47,143,0.14)";
  const listBg = dark ? "#0f172a" : "#ffffff";

  return createPortal(
    <div
      className="z-[60] flex flex-col justify-end"
      style={{
        position: "fixed",
        top: overlayBox.top,
        left: overlayBox.left,
        width: overlayBox.width,
        height: overlayBox.height,
      }}
    >
      <button
        type="button"
        className="absolute inset-0 border-0 p-0 cursor-default"
        style={{
          background: "rgba(10,22,70,0.45)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full rounded-t-[28px] px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col gap-5 animate-sheetUp"
        style={{
          background: sheetBg,
          boxShadow: "0 -12px 40px rgba(15,47,143,0.18)",
          maxHeight: "88%",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Select exporter and concession"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-1 rounded-full" style={{ background: dark ? "rgba(255,255,255,0.2)" : "rgba(15,47,143,0.18)" }} />
          <div className="w-full flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[16px] font-bold" style={{ color: textPrimary }}>
                Log Information
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center focus:outline-none flex-shrink-0"
              style={{ background: dark ? "rgba(255,255,255,0.08)" : "rgba(15,47,143,0.08)", color: dark ? "#ffffff" : "#0f2f8f" }}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto overscroll-contain">
          {/* Exporter Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>
              Exporter Name
            </label>
            <button
              type="button"
              onClick={() => { setExporterOpen(v => !v); setConcessionOpen(false); }}
              className="w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-sm text-left focus:outline-none active:scale-[0.99] transition-all"
              style={{
                background: fieldBg,
                border: `1.5px solid ${exporterOpen ? "rgba(15,47,143,0.45)" : fieldBorder}`,
                color: exporter ? textPrimary : textMuted,
                boxShadow: exporterOpen ? "0 0 0 3px rgba(15,47,143,0.10)" : "none",
              }}
              aria-expanded={exporterOpen}
            >
              <span className="truncate font-medium">{exporter || "Select an exporter…"}</span>
              <ChevronDown
                size={16}
                style={{
                  color: textMuted,
                  transform: exporterOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                  flexShrink: 0,
                }}
              />
            </button>
            {exporterOpen && (
              <div
                className="rounded-2xl overflow-hidden animate-riseIn"
                style={{
                  background: listBg,
                  border: `1px solid ${fieldBorder}`,
                  boxShadow: "0 8px 24px rgba(15,47,143,0.10)",
                  maxHeight: 180,
                  overflowY: "auto",
                }}
              >
                {CU_CLIENT_DIRECTORY.map(c => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => {
                      setExporter(c.name);
                      setConcession("");
                      setExporterOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 text-sm font-medium transition-colors focus:outline-none"
                    style={{
                      color: exporter === c.name ? "#0f2f8f" : textPrimary,
                      background: exporter === c.name ? "rgba(15,47,143,0.08)" : "transparent",
                      borderBottom: `1px solid ${fieldBorder}`,
                    }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Concessions — depends on exporter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>
              Concessions
            </label>
            <button
              type="button"
              disabled={!exporter}
              onClick={() => {
                if (!exporter) return;
                setConcessionOpen(v => !v);
                setExporterOpen(false);
              }}
              className="w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-sm text-left focus:outline-none active:scale-[0.99] transition-all disabled:active:scale-100"
              style={{
                background: fieldBg,
                border: `1.5px solid ${concessionOpen ? "rgba(15,47,143,0.45)" : fieldBorder}`,
                color: concession ? textPrimary : textMuted,
                opacity: exporter ? 1 : 0.55,
                cursor: exporter ? "pointer" : "not-allowed",
                boxShadow: concessionOpen ? "0 0 0 3px rgba(15,47,143,0.10)" : "none",
              }}
              aria-expanded={concessionOpen}
            >
              <span className="truncate font-medium">
                {concession || (exporter ? "Select a concession…" : "Select an exporter first…")}
              </span>
              <ChevronDown
                size={16}
                style={{
                  color: textMuted,
                  transform: concessionOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                  flexShrink: 0,
                }}
              />
            </button>
            {concessionOpen && concessions.length > 0 && (
              <div
                className="rounded-2xl overflow-hidden animate-riseIn"
                style={{
                  background: listBg,
                  border: `1px solid ${fieldBorder}`,
                  boxShadow: "0 8px 24px rgba(15,47,143,0.10)",
                  maxHeight: 180,
                  overflowY: "auto",
                }}
              >
                {concessions.map(loc => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => {
                      setConcession(loc);
                      setConcessionOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 text-sm font-medium transition-colors focus:outline-none"
                    style={{
                      color: concession === loc ? "#0f2f8f" : textPrimary,
                      background: concession === loc ? "rgba(15,47,143,0.08)" : "transparent",
                      borderBottom: `1px solid ${fieldBorder}`,
                    }}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          disabled={!canContinue}
          onClick={() => {
            if (!canContinue) return;
            onConfirm(exporter, concession);
          }}
          className="w-full h-12 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 focus:outline-none active:scale-[0.98] transition-all disabled:active:scale-100 disabled:opacity-45"
          style={{ background: GRADIENT, boxShadow: canContinue ? "0 6px 18px rgba(15,47,143,0.32)" : "none" }}
        >
          Continue
          <ChevronRight size={16} />
        </button>
      </div>
    </div>,
    document.body,
  );
}

function HomeScreen({ location, onLogout, onNavigate, onOpenInventorySheet, isCU, dark, setDark }: {
  location: string; onLogout: () => void; onNavigate: (s: Screen) => void;
  onOpenInventorySheet: () => void;
  isCU: boolean; dark: boolean; setDark: (v: boolean) => void;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(LAST_SYNC);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const bg = dark ? "#0f172a" : "#f0f4ff";
  const surface = dark ? "rgba(30, 41, 59, 0.55)" : "rgba(255, 255, 255, 0.5)";
  const surfaceBorder = dark ? "rgba(255,255,255,0.1)" : "rgba(15,47,143,0.12)";
  const textPrimary = dark ? "#ffffff" : "#0a1a4a";
  const textMuted = dark ? "#ffffff" : "#5a6a99";
  const cardBg = dark ? "rgba(30, 41, 59, 0.55)" : "rgba(255, 255, 255, 0.55)";
  const cardBorder = dark ? "rgba(255,255,255,0.1)" : "rgba(15,47,143,0.14)";
  const iconColor = dark ? "#ffffff" : "#0f2f8f";
  const iconBg = dark ? "rgba(255,255,255,0.1)" : "rgba(15,47,143,0.08)";
  const subCardGlass = { backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" } as const;
  const btn = { background: dark ? "rgba(255,255,255,0.1)" : "rgba(15,47,143,0.08)", color: iconColor };

  const ProfileButton = (
    <div className="relative" ref={profileRef}>
      <button onClick={() => setProfileOpen(v => !v)}
        className="w-9 h-9 rounded-full overflow-hidden border-2 transition-all duration-150 hover:scale-105 focus:outline-none"
        style={{ borderColor: profileOpen ? "#0f2f8f" : dark ? "rgba(255,255,255,0.2)" : "rgba(15,47,143,0.25)" }}>
        <img src={profilePhoto} alt="Thilina" className="w-full h-full object-cover" />
      </button>
      {profileOpen && (
        <div className="absolute right-0 mt-2 w-44 rounded-2xl overflow-hidden z-30 shadow-xl"
          style={{ background: dark ? "#1e293b" : "#ffffff", border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(15,47,143,0.12)"}` }}>
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.07)" : "rgba(15,47,143,0.08)"}` }}>
            <p className="text-xs font-semibold" style={{ color: textPrimary }}>Thilina</p>
            <p className="text-[11px]" style={{ color: textMuted }}>{isCU ? "Control Union" : "Client"}</p>
          </div>
          <button onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-medium transition-colors hover:bg-red-50 focus:outline-none"
            style={{ color: "#d4183d" }}>
            <LogOut size={15} /> Log out
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen w-full flex flex-col transition-colors duration-300 animate-fadeIn" style={{ background: bg, fontFamily: "'Inter', sans-serif" }}>
      <AppHeaderBar dark={dark}>
        <PageHeader
          dark={dark}
          onDarkToggle={() => setDark(!dark)}
          extra={ProfileButton}
        />
      </AppHeaderBar>

      <div
        className="w-full max-w-[480px] mx-auto flex-1 flex flex-col px-5 pt-5 gap-6 min-h-0"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >

        {/* ── Greeting card ── */}
        <div className="rounded-2xl px-5 py-5 flex-shrink-0" style={{ background: GRADIENT, boxShadow: "0 4px 20px rgba(15,47,143,0.35)" }}>
          <p className="text-2xl font-bold tracking-tight text-white">
            <span className="aurora-text">Hello, Thilina</span>{" "}
            <span aria-hidden="true">👋</span>
          </p>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.75)" }}>{formatDate(new Date())}</p>
          {!isCU && location ? (
            <div className="flex items-center gap-2 mt-3">
              <MapPin size={14} style={{ color: "rgba(255,255,255,0.85)", flexShrink: 0 }} />
              <span className="text-sm font-medium truncate" style={{ color: "rgba(255,255,255,0.9)" }}>
                {location}
              </span>
            </div>
          ) : null}
        </div>

        {/* ── Action cards ── */}
        <div className="flex flex-col gap-4 flex-shrink-0">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: dark ? "rgba(255,255,255,0.55)" : "#5a6a99" }}>Actions</p>

          {!isCU && (
            <button onClick={() => onNavigate("scan-log")}
              className="w-full rounded-2xl p-5 flex items-center gap-5 text-left group transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] focus:outline-none shadow-sm hover:shadow-md"
              style={{ ...subCardGlass, background: cardBg, border: `1px solid ${cardBorder}` }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 animate-iconWell" style={{ background: iconBg }}>
                <ClipboardList size={26} className="animate-iconClipboard" style={{ color: iconColor }} />
              </div>
              <div className="flex-1">
                <p className="text-base font-bold" style={{ color: textPrimary }}>Register Log</p>
                <p className="text-xs mt-0.5" style={{ color: textMuted }}>
                  Record new sustainability entry
                </p>
              </div>
              <ChevronRight size={18} style={{ color: textMuted }} className="group-hover:translate-x-0.5 transition-transform duration-150" />
            </button>
          )}

          <button onClick={() => {
              if (isCU) onOpenInventorySheet();
              else onNavigate("log-inventory");
            }}
            className="w-full rounded-2xl p-5 flex items-center gap-5 text-left group transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] focus:outline-none shadow-sm hover:shadow-md"
            style={{ ...subCardGlass, background: cardBg, border: `1px solid ${cardBorder}` }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 animate-iconWell" style={{ background: iconBg }}>
              <Package size={26} className="animate-iconPackage" style={{ color: iconColor }} />
            </div>
            <div className="flex-1">
              <p className="text-base font-bold" style={{ color: textPrimary }}>
                {isCU ? "Log Information" : "Log Inventory"}
              </p>
              <p className="text-xs mt-0.5" style={{ color: textMuted }}>Update stock and material records</p>
            </div>
            <ChevronRight size={18} style={{ color: textMuted }} className="group-hover:translate-x-0.5 transition-transform duration-150" />
          </button>

          {isCU && (
            <button onClick={() => onNavigate("schedule-inspection")}
              className="w-full rounded-2xl p-5 flex items-center gap-5 text-left group transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] focus:outline-none shadow-sm hover:shadow-md"
              style={{ ...subCardGlass, background: cardBg, border: `1px solid ${cardBorder}` }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 animate-iconWell" style={{ background: iconBg }}>
                <Calendar size={26} className="animate-iconCalendar" style={{ color: iconColor }} />
              </div>
              <div className="flex-1">
                <p className="text-base font-bold" style={{ color: textPrimary }}>Inspection</p>
                <p className="text-xs mt-0.5" style={{ color: textMuted }}>Plan and manage upcoming inspections</p>
              </div>
              <ChevronRight size={18} style={{ color: textMuted }} className="group-hover:translate-x-0.5 transition-transform duration-150" />
            </button>
          )}
        </div>

        <div className="flex-1 min-h-6" aria-hidden="true" />

        {/* ── Sync bar ── */}
        <div className="rounded-2xl px-5 py-4 flex flex-col gap-3 flex-shrink-0 mt-auto" style={{ ...subCardGlass, background: surface, border: `1px solid ${surfaceBorder}` }}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: textMuted }}>Last synced</p>
            <p className="text-sm font-medium mt-0.5" style={{ color: textPrimary }}>{formatSyncTime(lastSync)}</p>
          </div>
          <button
            onClick={() => { setSyncing(true); setTimeout(() => { setLastSync(new Date()); setSyncing(false); }, 1800); }}
            disabled={syncing}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98] focus:outline-none disabled:opacity-60"
            style={{ background: GRADIENT, boxShadow: "0 4px 16px rgba(15,47,143,0.35)" }}>
            <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing…" : "Sync"}
          </button>
        </div>

      </div>
    </div>
  );
}

function ScanLogScreen({ dark, onBack, onScanNew, onOpenExisting, isCU }: {
  dark: boolean;
  onBack: () => void;
  onScanNew: () => void;
  onOpenExisting: () => void;
  isCU?: boolean;
}) {
  const [registeredDialogOpen, setRegisteredDialogOpen] = useState(false);
  const [phase, setPhase] = useState<ScannerPhase>("idle");

  const bg = dark ? "#0f172a" : "#f0f4ff";
  const surface = dark ? "rgba(30, 41, 59, 0.55)" : "rgba(255, 255, 255, 0.42)";
  const surfaceBorder = dark ? "rgba(255,255,255,0.1)" : "rgba(15,47,143,0.10)";
  const subCardGlass = { backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" } as const;
  const textPrimary = dark ? "#ffffff" : "#0a1a4a";
  const textMuted = dark ? "rgba(255,255,255,0.82)" : FIELD_TEXT_MUTED;

  // Simulated capture: sweep finds a code, then advances into the log flow.
  useEffect(() => {
    if (phase !== "scanning") return;
    const timer = setTimeout(() => setPhase("detected"), SCAN_DETECT_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "detected") return;
    const timer = setTimeout(() => {
      if (isCU) onOpenExisting();
      else onScanNew();
    }, SCAN_CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [phase, isCU, onOpenExisting, onScanNew]);

  const INSTRUCTIONS = isCU
    ? [
        "Hold the camera steady 15–20 cm from the QR.",
        "Ensure good lighting for accurate scanning.",
        "CU users can scan and view log details only — registration is not available.",
      ]
    : [
        "Hold the camera steady 15–20 cm from the QR.",
        "Ensure good lighting for accurate scanning.",
        "If the QR code is valid, the system validates the data and opens the navigation form.",
      ];

  return (
    <div className="relative min-h-screen w-full transition-colors duration-300 animate-fadeIn" style={{ background: bg, fontFamily: "'Inter', sans-serif" }}>
      <AppHeaderBar dark={dark}>
        <div className="flex items-center gap-3">
          <BackCardButton onClick={onBack} dark={dark} />
          <div className="min-w-0">
            <h1 className="text-[18px] font-bold tracking-tight" style={{ color: textPrimary }}>
              Scan Log
            </h1>
          </div>
        </div>
      </AppHeaderBar>

      <div
        className="w-full max-w-[480px] mx-auto flex flex-col px-5 pt-5 gap-6"
        style={{ paddingBottom: BOTTOM_NAV_PAD }}
      >

        {/* Modern tap-to-scan viewfinder */}
        <section className="flex flex-col items-center gap-4">
          <QrTapViewfinder
            phase={phase}
            dark={dark}
            detectedLabel="QR captured"
            idleHint="Ready when you are"
            scanningHint={isCU ? "Hold steady to view log details" : "Hold steady to open registration"}
            onToggleScan={() => {
              if (phase === "idle") setPhase("scanning");
              else if (phase === "scanning") setPhase("idle");
            }}
          />

          {!isCU && (
            <button
              type="button"
              onClick={() => setRegisteredDialogOpen(true)}
              className="text-[12px] font-semibold underline-offset-2 hover:underline focus:outline-none"
              style={{ color: textMuted }}
            >
              Already registered? View existing log
            </button>
          )}
        </section>

        {registeredDialogOpen && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center px-5"
            style={{ background: "rgba(10, 22, 70, 0.55)", backdropFilter: "blur(4px)" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-registered-title"
            onClick={() => setRegisteredDialogOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-5 shadow-2xl"
              style={{
                background: dark ? "#1e293b" : "#ffffff",
                border: `1px solid ${dark ? "rgba(255,255,255,0.10)" : "#e8edf9"}`,
              }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex flex-col gap-2 text-center">
                <h2 id="qr-registered-title" className="text-base font-bold" style={{ color: textPrimary }}>
                  QR Code Already Registered
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: textMuted }}>
                  This QR code is already registered. Do you want to view the existing log details?
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setRegisteredDialogOpen(false)}
                  className="flex-1 rounded-xl py-3 text-sm font-semibold transition-all duration-200 focus:outline-none"
                  style={{
                    background: dark ? "rgba(255,255,255,0.08)" : "#f0f4ff",
                    color: dark ? "#ffffff" : "#0f2f8f",
                    border: `1px solid ${surfaceBorder}`,
                  }}
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRegisteredDialogOpen(false);
                    onOpenExisting();
                  }}
                  className="flex-1 rounded-xl py-3 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98] focus:outline-none"
                  style={{ background: GRADIENT, boxShadow: "0 4px 16px rgba(15,47,143,0.35)" }}
                >
                  Yes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="rounded-2xl px-5 py-4" style={{ ...subCardGlass, background: surface, border: `1px solid ${surfaceBorder}` }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: textMuted }}>Instructions</p>
          {INSTRUCTIONS.map((tip, i) => (
            <div key={i} className="flex items-start gap-2 mb-2 last:mb-0">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                style={{
                  background: dark ? "rgba(255,255,255,0.10)" : "rgba(15,47,143,0.1)",
                  color: dark ? "#ffffff" : "#0f2f8f",
                }}
              >
                {i + 1}
              </span>
              <p className="text-xs leading-relaxed" style={{ color: textMuted }}>{tip}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Register Log Form ────────────────────────────────────────────────────────

interface RegisterLogFormData {
  serialNo: string;
  regDate: string;
  productGroup: string;
  productType: string;
  productName: string;
  lotNumber: string;
  length: string;
  diameter: string;
  diameter1: string;
  diameter2: string;
  diameter3: string;
  diameter4: string;
  volume: string;
  defectVolume: string;
  note: string;
  status: string;
}

const EMPTY_REGISTER_LOG: RegisterLogFormData = {
  serialNo: "",
  regDate: "",
  productGroup: "",
  productType: "",
  productName: "",
  lotNumber: "",
  length: "",
  diameter: "",
  diameter1: "",
  diameter2: "",
  diameter3: "",
  diameter4: "",
  volume: "",
  defectVolume: "",
  note: "",
  status: "",
};

/** Sample data for an already-registered QR log entry */
const REGISTERED_LOG_ENTRY: RegisterLogFormData = {
  serialNo: "0000000001",
  regDate: "2026-05-25",
  productGroup: "Group 1",
  productType: "Saw/Veneer",
  productName: "Taun",
  lotNumber: "LOT-2026-042",
  length: "10.0",
  diameter: "11.0",
  diameter1: "11.0",
  diameter2: "10.8",
  diameter3: "10.6",
  diameter4: "10.5",
  volume: "12.0",
  defectVolume: "1.2",
  note: "Previously registered — review details before updating.",
  status: "AVAILABLE",
};

const PRODUCT_GROUPS = ["Group 1", "Group 2"] as const;
const PRODUCT_TYPES = ["Round Log", "Saw/Veneer", "Sawn Timber", "Flitch", "Billet"] as const;

const PRODUCT_NAMES: Record<(typeof PRODUCT_GROUPS)[number], string[]> = {
  "Group 1": [...TIMBER_SPECIES.slice(0, 17)],
  "Group 2": [...TIMBER_SPECIES.slice(17, 24)],
};

function FormField({ label, required, children, dark = false }: { label: string; required?: boolean; children: React.ReactNode; dark?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold" style={{ color: dark ? "#ffffff" : "#0a1a4a" }}>
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-xl px-4 py-3 text-sm outline-none transition-all border focus:border-blue-400 placeholder:text-gray-400";
const inputStyle = { background: "#f8faff", border: "1px solid #dce4f5", color: "#0a1a4a" };

function RegisterLogFormScreen({ onBack, prefill, isCU }: { onBack: () => void; prefill: RegisterLogFormData | null; isCU?: boolean }) {
  const viewOnly = isCU || prefill !== null;
  const screenTitle = isCU ? "Scan Log" : prefill !== null ? "View Log" : "Register Log";
  const initial = prefill ?? EMPTY_REGISTER_LOG;

  const [serialNo, setSerialNo] = useState(initial.serialNo);
  const [regDate, setRegDate] = useState(initial.regDate);
  const [productGroup, setProductGroup] = useState(initial.productGroup);
  const [productType, setProductType] = useState(initial.productType);
  const [productName, setProductName] = useState(initial.productName);
  const [lotNumber, setLotNumber] = useState(initial.lotNumber);
  const [length, setLength] = useState(initial.length);
  const [diameter, setDiameter] = useState(initial.diameter);
  const [diameter1, setDiameter1] = useState(initial.diameter1);
  const [diameter2, setDiameter2] = useState(initial.diameter2);
  const [diameter3, setDiameter3] = useState(initial.diameter3);
  const [diameter4, setDiameter4] = useState(initial.diameter4);
  const [volume, setVolume] = useState(initial.volume);
  const [defectVolume, setDefectVolume] = useState(initial.defectVolume);
  const [note, setNote] = useState(initial.note);
  const [status, setStatus] = useState(initial.status);
  const [pgOpen, setPgOpen] = useState(false);
  const [ptOpen, setPtOpen] = useState(false);
  const [pnOpen, setPnOpen] = useState(false);

  // White fills keep the fields legible against the tinted page.
  const fieldStyle = viewOnly
    ? { ...inputStyle, background: "#ffffff", color: "#5a6a99", cursor: "not-allowed" as const }
    : { ...inputStyle, background: "#ffffff" };

  return (
    <div className="min-h-screen w-full animate-fadeIn" style={{ background: "#f0f4ff", fontFamily: "'Inter', sans-serif" }}>
      <AppHeaderBar>
        <div className="flex items-center gap-3">
          <BackCardButton onClick={onBack} />
          <div className="min-w-0">
            <h1 className="text-[18px] font-bold tracking-tight" style={{ color: "#0a1a4a" }}>
              {screenTitle}
            </h1>
          </div>
        </div>
      </AppHeaderBar>

      <div className="w-full max-w-[480px] mx-auto min-h-screen flex flex-col">
        {/* Form */}
        <div className="flex flex-col gap-5 px-5 py-6 pb-10">

          {/* Serial No */}
          <FormField label="Serial No" required>
            <input
              className={inputCls}
              style={fieldStyle}
              value={serialNo}
              onChange={e => setSerialNo(e.target.value)}
              readOnly={viewOnly}
              placeholder="Serial number"
            />
          </FormField>

          {/* Reg Date */}
          <FormField label="Reg Date" required>
            <div className="relative">
              <input
                type="date"
                className={inputCls}
                style={{ ...fieldStyle, paddingRight: "2.5rem" }}
                value={regDate}
                onChange={e => setRegDate(e.target.value)}
                readOnly={viewOnly}
              />
            </div>
          </FormField>

          {/* Product Group */}
          <FormField label="Product Group" required>
            {viewOnly ? (
              <input className={inputCls} style={fieldStyle} value={productGroup} readOnly />
            ) : (
              <div className="relative">
                <button type="button" onClick={() => { setPgOpen(v => !v); setPnOpen(false); setPtOpen(false); }}
                  className="w-full rounded-xl px-4 py-3 text-sm text-left flex items-center justify-between focus:outline-none"
                  style={{ ...fieldStyle, color: productGroup ? "#0a1a4a" : "#9ca3af", border: pgOpen ? "1px solid #60a5fa" : "1px solid #dce4f5" }}>
                  <span>{productGroup || "Select"}</span>
                  <ChevronDown size={15} style={{ color: "#5a6a99", transform: pgOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                </button>
                {pgOpen && (
                  <div className="absolute left-0 right-0 mt-1 rounded-xl z-20 shadow-xl overflow-hidden"
                    style={{ background: "#ffffff", border: "1px solid #dce4f5", maxHeight: "200px", overflowY: "auto" }}>
                    {PRODUCT_GROUPS.map(g => (
                      <button key={g} type="button"
                        onClick={() => { setProductGroup(g); setProductName(""); setPgOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 focus:outline-none transition-colors"
                        style={{ color: productGroup === g ? "#0f2f8f" : "#0a1a4a", fontWeight: productGroup === g ? 600 : 400, borderBottom: "1px solid #f0f4ff" }}>
                        {g}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </FormField>

          {/* Product Type */}
          <FormField label="Product Type" required>
            {viewOnly ? (
              <input className={inputCls} style={fieldStyle} value={productType} readOnly />
            ) : (
              <div className="relative">
                <button type="button" onClick={() => { setPtOpen(v => !v); setPgOpen(false); setPnOpen(false); }}
                  className="w-full rounded-xl px-4 py-3 text-sm text-left flex items-center justify-between focus:outline-none"
                  style={{ ...fieldStyle, color: productType ? "#0a1a4a" : "#9ca3af", border: ptOpen ? "1px solid #60a5fa" : "1px solid #dce4f5" }}>
                  <span>{productType || "Select"}</span>
                  <ChevronDown size={15} style={{ color: "#5a6a99", transform: ptOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                </button>
                {ptOpen && (
                  <div className="absolute left-0 right-0 mt-1 rounded-xl z-20 shadow-xl overflow-hidden"
                    style={{ background: "#ffffff", border: "1px solid #dce4f5", maxHeight: "200px", overflowY: "auto" }}>
                    {PRODUCT_TYPES.map(t => (
                      <button key={t} type="button"
                        onClick={() => { setProductType(t); setPtOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 focus:outline-none transition-colors"
                        style={{ color: productType === t ? "#0f2f8f" : "#0a1a4a", fontWeight: productType === t ? 600 : 400, borderBottom: "1px solid #f0f4ff" }}>
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </FormField>

          {/* Product Name */}
          <FormField label="Product Name" required>
            {viewOnly ? (
              <input className={inputCls} style={fieldStyle} value={productName} readOnly />
            ) : (
              <div className="relative">
                <button type="button"
                  onClick={() => { if (productGroup) { setPnOpen(v => !v); setPgOpen(false); setPtOpen(false); } }}
                  className="w-full rounded-xl px-4 py-3 text-sm text-left flex items-center justify-between focus:outline-none"
                  style={{ ...fieldStyle, color: productName ? "#0a1a4a" : "#9ca3af", border: pnOpen ? "1px solid #60a5fa" : "1px solid #dce4f5", opacity: productGroup ? 1 : 0.5 }}>
                  <span>{productName || "Select"}</span>
                  <ChevronDown size={15} style={{ color: "#5a6a99", transform: pnOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                </button>
                {pnOpen && productGroup && (
                  <div className="absolute left-0 right-0 mt-1 rounded-xl z-20 shadow-xl overflow-hidden"
                    style={{ background: "#ffffff", border: "1px solid #dce4f5", maxHeight: "200px", overflowY: "auto" }}>
                    {(PRODUCT_NAMES[productGroup as keyof typeof PRODUCT_NAMES] ?? []).map(n => (
                      <button key={n} type="button"
                        onClick={() => { setProductName(n); setPnOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 focus:outline-none transition-colors"
                        style={{ color: productName === n ? "#0f2f8f" : "#0a1a4a", fontWeight: productName === n ? 600 : 400, borderBottom: "1px solid #f0f4ff" }}>
                        {n}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </FormField>

          {/* Lot Number */}
          <FormField label="Lot Number">
            <input
              className={inputCls}
              style={fieldStyle}
              placeholder="Lot Number"
              value={lotNumber}
              onChange={e => setLotNumber(e.target.value)}
              readOnly={viewOnly}
            />
          </FormField>

          {/* Measurements — 2-column pairs */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#5a6a99" }}>Measurements</p>
            <div className="flex flex-col gap-3">
              <FormField label="D1 (cm)">
                <input
                  type="text"
                  className={inputCls}
                  style={fieldStyle}
                  placeholder="--"
                  value={diameter1}
                  onChange={e => setDiameter1(e.target.value)}
                  readOnly={viewOnly}
                />
              </FormField>
              <FormField label="D2 (cm)">
                <input
                  type="text"
                  className={inputCls}
                  style={fieldStyle}
                  placeholder="--"
                  value={diameter2}
                  onChange={e => setDiameter2(e.target.value)}
                  readOnly={viewOnly}
                />
              </FormField>
              <FormField label="D3 (cm)">
                <input
                  type="text"
                  className={inputCls}
                  style={fieldStyle}
                  placeholder="--"
                  value={diameter3}
                  onChange={e => setDiameter3(e.target.value)}
                  readOnly={viewOnly}
                />
              </FormField>
              <FormField label="D4 (cm)">
                <input
                  type="text"
                  className={inputCls}
                  style={fieldStyle}
                  placeholder="--"
                  value={diameter4}
                  onChange={e => setDiameter4(e.target.value)}
                  readOnly={viewOnly}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Avg.diamete" required>
                <div className="relative">
                  <input type="number" className={inputCls} style={{ ...fieldStyle, paddingRight: "2.5rem" }} placeholder="0.00" step="0.01" min="0" value={diameter} onChange={e => setDiameter(e.target.value)} readOnly={viewOnly} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium pointer-events-none" style={{ color: "#94a3b8" }}>cm</span>
                </div>
              </FormField>
              <FormField label="Length" required>
                <div className="relative">
                  <input type="number" className={inputCls} style={{ ...fieldStyle, paddingRight: "2.5rem" }} placeholder="0.00" step="0.01" min="0" value={length} onChange={e => setLength(e.target.value)} readOnly={viewOnly} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium pointer-events-none" style={{ color: "#94a3b8" }}>m</span>
                </div>
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Volume" required>
                <div className="relative">
                  <input type="number" className={inputCls} style={{ ...fieldStyle, paddingRight: "2.5rem" }} placeholder="0.00" step="0.01" min="0" value={volume} onChange={e => setVolume(e.target.value)} readOnly={viewOnly} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium pointer-events-none" style={{ color: "#94a3b8" }}>m³</span>
                </div>
              </FormField>
              <FormField label="Defect Volume" required>
                <div className="relative">
                  <input type="number" className={inputCls} style={{ ...fieldStyle, paddingRight: "2.5rem" }} placeholder="0.00" step="0.01" min="0" value={defectVolume} onChange={e => setDefectVolume(e.target.value)} readOnly={viewOnly} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium pointer-events-none" style={{ color: "#94a3b8" }}>m³</span>
                </div>
              </FormField>
            </div>
          </div>

          {/* Note */}
          <FormField label="Note" required>
            <textarea className={inputCls} style={{ ...fieldStyle, resize: "none" }} placeholder="Note" rows={3} value={note} onChange={e => setNote(e.target.value)} readOnly={viewOnly} />
          </FormField>

          {/* Status */}
          <FormField label="Status">
            <input className={inputCls} style={fieldStyle} value={status} onChange={e => setStatus(e.target.value)} readOnly={viewOnly} />
          </FormField>

          {/* Image — registered entry shows captured log photo */}
          <FormField label="Image" required={!viewOnly}>
            {viewOnly ? (
              <div
                className="w-full rounded-xl overflow-hidden"
                style={{ border: "1px solid #dce4f5", background: "#ffffff" }}>
                <img
                  src={logEntryPhoto}
                  alt="Registered log — timber"
                  className="w-full h-52 object-contain p-2"
                />
              </div>
            ) : (
              <button type="button"
                className="w-full rounded-xl flex flex-col items-center justify-center gap-2 transition-all duration-150 hover:bg-blue-50 focus:outline-none"
                style={{ background: "#ffffff", border: "1px solid #dce4f5", height: "140px" }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#e8edf9" }}>
                  <ScanLine size={20} style={{ color: "#5a6a99" }} />
                </div>
                <span className="text-sm" style={{ color: "#94a3b8" }}>Tap to capture image</span>
              </button>
            )}
          </FormField>

          {/* Submit — new entries only */}
          {!viewOnly && (
            <button type="button"
              className="w-full flex items-center justify-center rounded-xl py-4 text-sm font-bold text-white mt-2 transition-all duration-200 hover:brightness-110 active:scale-[0.98] focus:outline-none"
              style={{ background: GRADIENT, boxShadow: "0 4px 16px rgba(15,47,143,0.35)" }}>
              Submit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Inventory Row ────────────────────────────────────────────────────────────

function InventoryRow({ item, dark, showModified = true, showChangeQr = true }: {
  item: InventoryItem;
  dark: boolean;
  showModified?: boolean;
  showChangeQr?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const textPrimary = dark ? "#ffffff" : "#0a1a4a";
  const textMuted = dark ? "rgba(255,255,255,0.82)" : FIELD_TEXT_MUTED;
  const rowBg = dark ? "rgba(30, 41, 59, 0.55)" : "rgba(255, 255, 255, 0.55)";
  const rowBorder = dark ? "rgba(255,255,255,0.1)" : "rgba(15,47,143,0.12)";
  const expandedBg = dark ? "rgba(22, 32, 50, 0.5)" : "rgba(240, 245, 255, 0.55)";
  const subCardGlass = { backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" } as const;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ ...subCardGlass, background: rowBg, border: `1px solid ${rowBorder}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      {/* Row header — always clickable */}
      <button className="w-full px-4 py-3.5 flex items-start justify-between gap-3 focus:outline-none"
        onClick={() => setExpanded(v => !v)}>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold" style={{ color: textPrimary }}>{item.species}</span>
            {showModified && item.modified && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(15,47,143,0.12)", color: "#0f2f8f" }}>Modified</span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: textMuted }}>
            L: {item.length} · D: {item.diameter} · V: {item.volume} · DV: {item.defectVolume}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-medium" style={{ color: textMuted }}>{item.date}</span>
          <ChevronDown size={14} style={{ color: textMuted, transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
        </div>
      </button>

      {/* Expanded panel — same layout for every row (Attachment 1 style) */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${rowBorder}` }}>
          <div className="px-4 pt-3 pb-4" style={{ background: expandedBg }}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {[
                ["Log Group", item.logGroup],
                ["Serial No.", item.serialNo],
                ["Batch No.", item.batchNo || "—"],
                ["Def. Reason", item.defReason || "—"],
              ].map(([label, val]) => (
                <div key={label}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: textMuted }}>{label}</p>
                  <p className="text-xs font-medium mt-0.5" style={{ color: textPrimary }}>{val}</p>
                </div>
              ))}
            </div>
          </div>
          {showChangeQr && (
            <div className="px-4 py-3" style={{ background: dark ? "rgba(255,255,255,0.04)" : "#f0f5ff", borderTop: `1px solid ${rowBorder}` }}>
              <button
                type="button"
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold transition-all duration-150 hover:brightness-110 active:scale-[0.97] focus:outline-none"
                style={{ background: GRADIENT, color: "#ffffff", boxShadow: "0 2px 8px rgba(15,47,143,0.3)" }}>
                <QrCode size={13} />
                Change QR
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const INSPECTION_STATUS_META: Record<InspectionStatus, { label: string; bg: string; color: string; rail: string; border: string; iconBg: string }> = {
  pending: {
    label: "Pending",
    bg: "rgba(15,47,143,0.12)",
    color: "#3d4f7c",
    rail: GRADIENT,
    border: "rgba(15,47,143,0.18)",
    iconBg: "rgba(15,47,143,0.10)",
  },
  inprogress: {
    label: "In Progress",
    bg: "rgba(217,119,6,0.16)",
    color: "#92400e",
    rail: "linear-gradient(180deg,#f59e0b 0%,#d97706 100%)",
    border: "rgba(217,119,6,0.32)",
    iconBg: "rgba(217,119,6,0.14)",
  },
  complete: {
    label: "Complete",
    bg: "rgba(5,150,105,0.16)",
    color: "#047857",
    rail: "linear-gradient(180deg,#10b981 0%,#059669 100%)",
    border: "rgba(5,150,105,0.32)",
    iconBg: "rgba(5,150,105,0.14)",
  },
};

function resolveInspectionStatus(task: InspectionTask, progress: InspectionProgress): InspectionStatus {
  if (progress.preShipment === "completed" && progress.loading === "completed") return "complete";
  if (progress.preShipment !== "not-started" || progress.loading !== "not-started") return "inprogress";
  return task.status;
}

// ─── Schedule Inspection Screen ───────────────────────────────────────────────

function ScheduleInspectionScreen({
  dark = false,
  onBack,
  onStartInspection,
  getProgress,
}: {
  dark?: boolean;
  onBack: () => void;
  onStartInspection: (task: InspectionTask) => void;
  getProgress: (taskId: string) => InspectionProgress;
  exporter?: string;
  concession?: string;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [draftStatus, setDraftStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [overlayBox, setOverlayBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const pageBg = dark
    ? "linear-gradient(165deg, #0b1224 0%, #0f172a 42%, #111827 100%)"
    : "linear-gradient(165deg, #dce6fb 0%, #eef2ff 32%, #f5f7ff 68%, #f0f4ff 100%)";
  const textPrimary = dark ? "#ffffff" : "#0a1a4a";
  const textMuted = dark ? "rgba(255,255,255,0.82)" : FIELD_TEXT_MUTED;
  const glassSurface = dark ? "rgba(30, 41, 59, 0.72)" : "rgba(255,255,255,0.88)";
  const glassBorder = dark ? "rgba(255,255,255,0.14)" : "rgba(15,47,143,0.16)";
  const cardBg = dark ? "rgba(30, 41, 59, 0.78)" : "#ffffff";
  const cardShadow = dark
    ? "0 8px 28px rgba(0,0,0,0.35)"
    : "0 8px 24px rgba(15,47,143,0.07), 0 1px 3px rgba(15,47,143,0.04)";
  const metaRowBg = dark ? "rgba(255,255,255,0.07)" : "rgba(232,237,249,0.95)";
  const metaRowBorder = dark ? "rgba(255,255,255,0.14)" : "rgba(15,47,143,0.14)";
  const sheetBg = dark
    ? "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)"
    : "linear-gradient(180deg, #ffffff 0%, #f7f9ff 100%)";
  const controlBg = dark ? "rgba(15, 23, 42, 0.85)" : "#ffffff";
  const washA = dark
    ? "radial-gradient(circle, rgba(59,130,246,0.16) 0%, transparent 70%)"
    : "radial-gradient(circle, rgba(26,69,181,0.18) 0%, transparent 70%)";
  const washB = dark
    ? "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 72%)"
    : "radial-gradient(circle, rgba(15,47,143,0.10) 0%, transparent 72%)";

  const statusTone = (status: InspectionStatus) => {
    const base = INSPECTION_STATUS_META[status];
    if (!dark) return base;
    if (status === "pending") {
      return { ...base, bg: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.72)", border: "rgba(255,255,255,0.10)", iconBg: "rgba(255,255,255,0.08)" };
    }
    if (status === "inprogress") {
      return { ...base, bg: "rgba(245,158,11,0.18)", color: "#fbbf24", border: "rgba(245,158,11,0.30)", iconBg: "rgba(245,158,11,0.16)" };
    }
    return { ...base, bg: "rgba(16,185,129,0.18)", color: "#34d399", border: "rgba(16,185,129,0.30)", iconBg: "rgba(16,185,129,0.16)" };
  };

  const filtersActive = statusFilter !== "all";

  const syncOverlayBox = () => {
    const device = document.querySelector(".mobile-device");
    if (device) {
      const r = device.getBoundingClientRect();
      setOverlayBox({ top: r.top, left: r.left, width: r.width, height: r.height });
    } else {
      setOverlayBox({ top: 0, left: 0, width: window.innerWidth, height: window.innerHeight });
    }
  };

  useEffect(() => {
    if (!filterOpen) return;
    syncOverlayBox();
    const vp = document.querySelector(".mobile-viewport");
    window.addEventListener("resize", syncOverlayBox);
    window.addEventListener("scroll", syncOverlayBox, true);
    vp?.addEventListener("scroll", syncOverlayBox);
    return () => {
      window.removeEventListener("resize", syncOverlayBox);
      window.removeEventListener("scroll", syncOverlayBox, true);
      vp?.removeEventListener("scroll", syncOverlayBox);
    };
  }, [filterOpen]);

  const openFilters = () => {
    setDraftStatus(statusFilter);
    syncOverlayBox();
    setFilterOpen(true);
  };

  const closeFilters = () => setFilterOpen(false);

  const applyFilters = () => {
    setStatusFilter(draftStatus);
    setFilterOpen(false);
  };

  const resetDraftFilters = () => {
    setDraftStatus("all");
  };

  const filtered = SCHEDULED_INSPECTIONS.filter(task => {
    const status = resolveInspectionStatus(task, getProgress(task.id));
    if (statusFilter !== "all" && status !== statusFilter) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      return (
        task.shipment.toLowerCase().includes(q) ||
        task.location.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const statusChips: { id: StatusFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "pending", label: "Pending" },
    { id: "inprogress", label: "In Progress" },
    { id: "complete", label: "Complete" },
  ];

  const qNorm = query.trim().toLowerCase();
  const searchSuggestions = qNorm
    ? SCHEDULED_INSPECTIONS.filter(task => {
        const haystack = `${task.shipment} ${task.location} ${task.exporter}`.toLowerCase();
        return haystack.includes(qNorm);
      }).slice(0, 5)
    : [];
  const showSuggestions = searchFocused && qNorm.length > 0;

  const ctaLabel = (task: InspectionTask) => {
    const status = resolveInspectionStatus(task, getProgress(task.id));
    if (status === "complete") return "View Inspection";
    if (status === "inprogress") return "Continue Inspection";
    return "Start Inspection";
  };

  const applySuggestion = (task: InspectionTask) => {
    setQuery(task.shipment);
    setSearchFocused(false);
  };

  const listKey = `${statusFilter}-${qNorm}`;
  const { scrollRef, setItemRef } = useScrollFocusList(filtered.length, listKey);

  const swipe = useSwipeBack(onBack);

  return (
    <div
      className="relative h-full-screen w-full flex flex-col overflow-hidden animate-fadeIn"
      style={{
        background: pageBg,
        fontFamily: "'Inter', sans-serif",
        color: textPrimary,
      }}
      {...swipe}
    >
      {/* Soft atmospheric washes */}
      <div
        className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full"
        style={{ background: washA }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-[42%] -left-20 w-64 h-64 rounded-full"
        style={{ background: washB }}
        aria-hidden="true"
      />

      {/* Sticky chrome: Header → Search → Tabs → Summary */}
      <div
        className="relative z-40 shrink-0 w-full"
        style={{ background: pageBg }}
      >
        {/* 1. Top Screen Header */}
        <AppHeaderBar dark={dark}>
          <div className="flex items-center gap-3">
            <BackCardButton onClick={onBack} dark={dark} />
            <div className="min-w-0">
              <h1 className="text-[18px] font-bold tracking-tight" style={{ color: textPrimary }}>
                Inspection
              </h1>
            </div>
          </div>
        </AppHeaderBar>

        <div className="w-full max-w-[480px] mx-auto flex flex-col px-4 sm:px-5 pt-4 pb-3 gap-3.5">
          {/* Search & Filter Controls */}
          <div className="relative z-30 animate-riseIn" style={{ ["--rise-delay" as string]: "40ms" }}>
            <div className="flex items-center gap-2.5">
              <div
                className="relative min-w-0 transition-[flex-grow,flex-basis,max-width] duration-300 ease-in-out"
                style={{
                  flexGrow: 1,
                  flexBasis: searchFocused ? "100%" : "0%",
                  maxWidth: searchFocused ? "100%" : "calc(100% - 3.25rem)",
                }}
              >
                <div
                  className="flex items-center gap-3 h-12 px-3.5 rounded-2xl transition-all duration-300 ease-in-out"
                  style={{
                    background: searchFocused
                      ? (dark ? "rgba(30, 41, 59, 0.98)" : "#ffffff")
                      : glassSurface,
                    border: `1.5px solid ${searchFocused
                      ? (dark ? "rgba(96,165,250,0.55)" : "rgba(15,47,143,0.42)")
                      : glassBorder}`,
                    boxShadow: searchFocused
                      ? (dark
                        ? "0 0 0 4px rgba(59,130,246,0.18), 0 10px 28px rgba(0,0,0,0.32), 0 0 24px rgba(59,130,246,0.18)"
                        : "0 0 0 4px rgba(15,47,143,0.12), 0 10px 28px rgba(15,47,143,0.12), 0 0 22px rgba(26,69,181,0.14)")
                      : (dark ? "0 2px 12px rgba(0,0,0,0.22)" : "0 2px 10px rgba(15,47,143,0.05)"),
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    transform: searchFocused ? "translateY(-1px)" : "translateY(0)",
                  }}
                >
                  <Search
                    size={17}
                    className="transition-colors duration-300 ease-in-out flex-shrink-0"
                    style={{ color: searchFocused ? (dark ? "#93c5fd" : "#0f2f8f") : textMuted }}
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => {
                      // Allow suggestion tap to register before closing.
                      window.setTimeout(() => setSearchFocused(false), 140);
                    }}
                    placeholder="Search inspection ID or location"
                    className={`flex-1 min-w-0 bg-transparent text-sm outline-none transition-colors duration-300 ease-in-out ${dark ? "placeholder:text-white/40" : "placeholder:text-[#5a6a99]/70"}`}
                    style={{ color: textPrimary }}
                    aria-autocomplete="list"
                    aria-expanded={showSuggestions}
                    aria-controls="inspection-search-suggestions"
                  />
                  {query && (
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => setQuery("")}
                      className="pressable w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 focus:outline-none"
                      style={{
                        background: dark ? "rgba(255,255,255,0.10)" : "rgba(15,47,143,0.10)",
                        color: textMuted,
                      }}
                      aria-label="Clear search"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={openFilters}
                className="pressable relative h-12 rounded-2xl flex items-center justify-center flex-shrink-0 focus:outline-none overflow-hidden"
                style={{
                  width: searchFocused ? 0 : 48,
                  minWidth: searchFocused ? 0 : 48,
                  opacity: searchFocused ? 0 : 1,
                  marginLeft: searchFocused ? -10 : 0,
                  pointerEvents: searchFocused ? "none" : "auto",
                  background: filtersActive ? GRADIENT : glassSurface,
                  color: filtersActive ? "#ffffff" : (dark ? "#ffffff" : "#0f2f8f"),
                  border: searchFocused
                    ? "0 solid transparent"
                    : `1.5px solid ${filtersActive ? "transparent" : glassBorder}`,
                  boxShadow: filtersActive
                    ? "0 6px 18px rgba(15,47,143,0.28)"
                    : (dark ? "0 2px 12px rgba(0,0,0,0.22)" : "0 2px 10px rgba(15,47,143,0.05)"),
                  transition:
                    "width 0.3s ease-in-out, min-width 0.3s ease-in-out, opacity 0.25s ease-in-out, margin 0.3s ease-in-out, box-shadow 0.3s ease-in-out, background 0.25s ease-in-out",
                }}
                aria-label="Open filters"
                aria-expanded={filterOpen}
                tabIndex={searchFocused ? -1 : 0}
              >
                <ListFilter size={19} />
                {filtersActive && !searchFocused && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                    style={{ background: "#d4183d", boxShadow: dark ? "0 0 0 2px #0f172a" : "0 0 0 2px #ffffff" }}
                  />
                )}
              </button>
            </div>

            {showSuggestions && (
              <div
                id="inspection-search-suggestions"
                role="listbox"
                aria-label="Search suggestions"
                className="search-suggest-panel absolute left-0 right-0 mt-2 rounded-2xl overflow-hidden z-40"
                style={{
                  background: dark ? "rgba(15, 23, 42, 0.96)" : "#ffffff",
                  border: `1px solid ${dark ? "rgba(255,255,255,0.12)" : "rgba(15,47,143,0.12)"}`,
                  boxShadow: dark
                    ? "0 16px 40px rgba(0,0,0,0.45)"
                    : "0 16px 36px rgba(15,47,143,0.14), 0 2px 8px rgba(15,47,143,0.06)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                }}
              >
                {searchSuggestions.length === 0 ? (
                  <div className="px-4 py-3.5">
                    <p className="text-[12px] font-medium" style={{ color: textMuted }}>
                      No matches for “{query.trim()}”
                    </p>
                  </div>
                ) : (
                  <ul className="flex flex-col py-1.5 max-h-[240px] overflow-y-auto">
                    {searchSuggestions.map((task, i) => {
                      const status = resolveInspectionStatus(task, getProgress(task.id));
                      const tone = statusTone(status);
                      return (
                        <li key={task.id} role="option" className="search-suggest-enter" style={{ ["--suggest-delay" as string]: `${40 + i * 45}ms` }}>
                          <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => applySuggestion(task)}
                            className="w-full px-3.5 py-2.5 flex items-center gap-3 text-left focus:outline-none transition-colors duration-200 ease-in-out"
                            style={{
                              background: "transparent",
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = dark
                                ? "rgba(255,255,255,0.06)"
                                : "rgba(15,47,143,0.05)";
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = "transparent";
                            }}
                          >
                            <span
                              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{
                                background: dark ? "rgba(59,130,246,0.16)" : "rgba(15,47,143,0.08)",
                                color: dark ? "#93c5fd" : "#0f2f8f",
                              }}
                            >
                              <Search size={15} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] font-bold truncate" style={{ color: textPrimary }}>
                                {task.shipment}
                              </span>
                              <span className="mt-0.5 flex items-center gap-1 text-[11px] truncate" style={{ color: textMuted }}>
                                <MapPin size={11} className="flex-shrink-0" />
                                {task.location}
                              </span>
                            </span>
                            <span
                              className="text-[12px] font-bold uppercase tracking-wide px-2.5 py-1.5 rounded-md flex-shrink-0"
                              style={{ background: tone.bg, color: tone.color }}
                            >
                              {INSPECTION_STATUS_META[status].label}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* 6. Inspection Cards Scroll List */}
      <div
        ref={scrollRef}
        className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-focus-list"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div
          key={`insp-list-${listKey}`}
          className="w-full max-w-[480px] mx-auto flex flex-col px-4 sm:px-5 pt-1 gap-3.5 scroll-focus-list__inner"
          style={{ paddingBottom: BOTTOM_NAV_PAD }}
        >
          {filtered.length === 0 ? (
            <div
              className="rounded-2xl p-8 text-center flex flex-col items-center gap-3 animate-riseIn"
              style={{
                ["--rise-delay" as string]: "160ms",
                background: glassSurface,
                border: `1px dashed ${glassBorder}`,
                boxShadow: dark ? "0 4px 20px rgba(0,0,0,0.25)" : "0 4px 20px rgba(15,47,143,0.05)",
              }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center animate-emptyFloat"
                style={{
                  background: dark ? "rgba(255,255,255,0.08)" : "rgba(15,47,143,0.08)",
                  color: dark ? "#ffffff" : "#0f2f8f",
                }}
              >
                <ClipboardList size={26} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: textPrimary }}>
                  Nothing scheduled
                </p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: textMuted }}>
                  Try adjusting filters, or clear your search.
                </p>
              </div>
            </div>
          ) : (
            filtered.map((task, index) => {
              const status = resolveInspectionStatus(task, getProgress(task.id));
              const meta = statusTone(status);
              return (
                <div
                  key={task.id}
                  ref={setItemRef(index)}
                  className="scroll-focus-item"
                >
                <article
                  className="relative overflow-hidden rounded-2xl flex flex-col animate-riseIn"
                  style={{
                    ["--rise-delay" as string]: `${160 + index * 55}ms`,
                    background: cardBg,
                    border: `1px solid ${meta.border}`,
                    boxShadow: cardShadow,
                    backdropFilter: dark ? "blur(14px)" : undefined,
                    WebkitBackdropFilter: dark ? "blur(14px)" : undefined,
                  }}
                >
                  {/* Accent rail */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-[3px]"
                    style={{ background: meta.rail }}
                    aria-hidden="true"
                  />

                  <div className="pl-4 pr-4 pt-4 pb-3.5 flex flex-col gap-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <span
                          key={status}
                          className="inline-flex items-center gap-1.5 min-h-8 h-8 px-3 rounded-full text-[12px] font-bold animate-statusMorph"
                          style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}
                        >
                          {status === "complete" && <CheckCircle2 size={12} strokeWidth={2.5} />}
                          {status === "inprogress" && <Clock size={12} strokeWidth={2.5} />}
                          {meta.label}
                        </span>
                      </div>
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{
                          background: meta.iconBg,
                          color: meta.color,
                        }}
                      >
                        <Ship size={18} />
                      </div>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <h3 className="text-[16px] font-bold leading-snug tracking-tight" style={{ color: textPrimary }}>
                        {task.shipment}
                      </h3>
                      <p className="text-[13px] font-semibold leading-snug truncate" style={{ color: textMuted }}>
                        {task.exporter}
                      </p>
                    </div>

                    {/* Iconized meta row */}
                    <div
                      className="grid grid-cols-3 gap-2 sm:gap-2.5 rounded-xl p-2.5 sm:p-3"
                      style={{ background: metaRowBg, border: `1px solid ${metaRowBorder}` }}
                    >
                      <div className="flex flex-col gap-1.5 min-w-0">
                        <span className="inline-flex items-center gap-1 text-[12px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>
                          <MapPin size={12} className="flex-shrink-0" /> Location
                        </span>
                        <span className="text-[12px] sm:text-[13px] font-bold break-words leading-snug" style={{ color: textPrimary }}>
                          {task.location}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1.5 min-w-0 border-x px-1.5 sm:px-2" style={{ borderColor: metaRowBorder }}>
                        <span className="inline-flex items-center gap-1 text-[12px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>
                          <Calendar size={12} className="flex-shrink-0" /> Window
                        </span>
                        <span className="text-[12px] sm:text-[13px] font-bold break-words leading-snug" style={{ color: textPrimary }}>
                          {task.time}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1.5 min-w-0">
                        <span className="inline-flex items-center gap-1 text-[12px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>
                          <Layers size={12} className="flex-shrink-0" /> Volume
                        </span>
                        <span className="text-[12px] sm:text-[13px] font-bold break-words leading-snug" style={{ color: textPrimary }}>
                          {task.logs} logs
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onStartInspection(task)}
                      className="pressable group w-full min-h-12 h-12 rounded-xl text-sm font-bold text-white focus:outline-none hover:brightness-110 flex items-center justify-center gap-2"
                      style={{ background: GRADIENT, boxShadow: "0 6px 18px rgba(15,47,143,0.28)" }}
                    >
                      {ctaLabel(task)}
                      <ArrowRight
                        size={16}
                        className="transition-transform duration-200 group-hover:translate-x-0.5 animate-nudgeRight"
                      />
                    </button>
                  </div>
                </article>
                </div>
              );
            })
          )}
        </div>
      </div>

      {filterOpen && overlayBox && createPortal(
        <div
          className="z-50 flex flex-col justify-end"
          style={{
            position: "fixed",
            top: overlayBox.top,
            left: overlayBox.left,
            width: overlayBox.width,
            height: overlayBox.height,
          }}
        >
          <button
            type="button"
            className="absolute inset-0 border-0 p-0 cursor-default"
            style={{
              background: dark ? "rgba(0,0,0,0.55)" : "rgba(10,22,70,0.45)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
            aria-label="Close filters"
            onClick={closeFilters}
          />
          <div
            className="relative z-10 w-full rounded-t-[28px] px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col gap-5 animate-sheetUp"
            style={{
              background: sheetBg,
              boxShadow: dark ? "0 -12px 40px rgba(0,0,0,0.45)" : "0 -12px 40px rgba(15,47,143,0.18)",
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Filter inspections"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-1 rounded-full" style={{ background: dark ? "rgba(255,255,255,0.18)" : "rgba(15,47,143,0.18)" }} />
              <div className="w-full flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: textMuted }}>
                  Filters
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={resetDraftFilters}
                    className="text-xs font-semibold focus:outline-none"
                    style={{ color: dark ? "#93c5fd" : "#0f2f8f" }}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={closeFilters}
                    className="field-touch w-12 h-12 rounded-xl flex items-center justify-center focus:outline-none"
                    style={{
                      background: dark ? "rgba(255,255,255,0.12)" : "rgba(15,47,143,0.10)",
                      color: dark ? "#ffffff" : "#0f2f8f",
                    }}
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <label htmlFor="filter-status" className="text-[12px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>
                Status
              </label>
              <div className="relative">
                <select
                  id="filter-status"
                  value={draftStatus}
                  onChange={e => setDraftStatus(e.target.value as StatusFilter)}
                  className="w-full h-12 appearance-none rounded-2xl pl-4 pr-10 text-sm font-semibold outline-none focus:outline-none transition-[box-shadow,border-color] duration-200"
                  style={{
                    background: controlBg,
                    border: `1.5px solid ${glassBorder}`,
                    color: textPrimary,
                    boxShadow: dark ? "0 2px 10px rgba(0,0,0,0.22)" : "0 2px 10px rgba(15,47,143,0.04)",
                  }}
                >
                  {statusChips.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2"
                  style={{ color: textMuted }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={applyFilters}
              className="w-full h-12 rounded-xl text-sm font-semibold text-white focus:outline-none active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              style={{ background: GRADIENT, boxShadow: "0 6px 18px rgba(15,47,143,0.28)" }}
            >
              Apply filters
              <CheckCircle2 size={16} />
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

// ─── Inspection Details Screen ────────────────────────────────────────────────

const SUB_STATUS_CONFIG: Record<SubInspectionStatus, { label: string; bg: string; color: string; darkBg: string; darkColor: string }> = {
  "not-started": { label: "Not Started", bg: "rgba(61,79,124,0.14)", color: "#3d4f7c", darkBg: "rgba(255,255,255,0.12)", darkColor: "rgba(255,255,255,0.82)" },
  "in-progress": { label: "In Progress", bg: "rgba(15,47,143,0.14)", color: "#0f2f8f", darkBg: "rgba(59,130,246,0.22)", darkColor: "#93c5fd" },
  "completed": { label: "Completed", bg: "rgba(16,185,129,0.16)", color: "#047857", darkBg: "rgba(16,185,129,0.22)", darkColor: "#34d399" },
};

function SubInspectionStatusPill({ status, dark = false }: { status: SubInspectionStatus; dark?: boolean }) {
  const cfg = SUB_STATUS_CONFIG[status];
  const bg = dark ? cfg.darkBg : cfg.bg;
  const color = dark ? cfg.darkColor : cfg.color;
  return (
    <span
      key={status}
      className="inline-flex items-center gap-1.5 min-h-8 h-8 px-3 rounded-full text-[12px] font-bold flex-shrink-0 animate-statusMorph"
      style={{ background: bg, color }}
    >
      {status === "in-progress" && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color }} />}
      {status === "completed" && <CheckCircle2 size={12} />}
      Status: {cfg.label}
    </span>
  );
}

interface InspectionStepConfig {
  key: "preShipment" | "loading";
  title: string;
  shortLabel: string;
  description: string;
  icon: React.ReactNode;
}

const INSPECTION_STEPS: InspectionStepConfig[] = [
  {
    key: "preShipment",
    title: "Pre-Shipment Inspection",
    shortLabel: "Pre-Shipment",
    description: "Verify product quality, packaging, and compliance before shipment.",
    icon: <ClipboardList size={20} />,
  },
  {
    key: "loading",
    title: "Loading Inspection",
    shortLabel: "Loading",
    description: "Verify loading process and cargo condition.",
    icon: <Truck size={20} />,
  },
];

type InspectionInfoSectionId =
  | "shipment"
  | "ape"
  | "vessel"
  | "declared-logs"
  | "cargo"
  | "attachments"
  | "volume-variance";

interface InspectionInfoSection {
  id: InspectionInfoSectionId;
  title: string;
  description: string;
  badge: string;
  alert?: boolean;
  icon: ReactNode;
  group: "shipment" | "cargo" | "compliance";
}

const INSPECTION_INFO_GROUPS: { id: InspectionInfoSection["group"]; label: string }[] = [
  { id: "shipment", label: "Shipment" },
  { id: "cargo", label: "Cargo & documents" },
  { id: "compliance", label: "Compliance" },
];

function getInspectionInfoSections(task: InspectionTask): InspectionInfoSection[] {
  const eta = task.day === "today" ? "08/02/2026" : task.day === "tomorrow" ? "09/02/2026" : "12/02/2026";
  return [
    {
      id: "shipment",
      title: "Shipment Details",
      description: "Reference, request date, exporter, project site, permit, loading point, licence and advised volume.",
      badge: "REF 20",
      icon: <Ship size={18} />,
      group: "shipment",
    },
    {
      id: "ape",
      title: "Approved Price Endorsement",
      description: "Permitted volume and FOB pricing per species and group, as approved on the APE.",
      badge: "11 ROWS",
      icon: <CircleDollarSign size={18} />,
      group: "shipment",
    },
    {
      id: "vessel",
      title: "Vessel Details",
      description: "Vessel name, agent, contact and estimated time of arrival.",
      badge: `ETA ${eta}`,
      icon: <Anchor size={18} />,
      group: "shipment",
    },
    {
      id: "declared-logs",
      title: "Exporter Declared Log Details",
      description: "Serial numbers, product group, code, log size, and permit volume declared in the request.",
      badge: `${Math.min(task.logs, 4)} LOGS`,
      icon: <Layers size={18} />,
      group: "cargo",
    },
    {
      id: "cargo",
      title: "Cargo Details",
      description: "Buyer, destination port and buyer address for the consignment.",
      badge: "DEST. QINGDAO",
      icon: <Container size={18} />,
      group: "cargo",
    },
    {
      id: "attachments",
      title: "Attachments",
      description: "Supporting documents submitted with the inspection request.",
      badge: "3 FILES",
      icon: <Paperclip size={18} />,
      group: "cargo",
    },
    {
      id: "volume-variance",
      title: "Permitted vs Declared Volume",
      description: "Compare permitted APE volumes against exporter-declared quantities and flag variances.",
      badge: "10 VARIANCES",
      alert: true,
      icon: <Scale size={18} />,
      group: "compliance",
    },
  ];
}

function getInspectionInfoSectionFields(sectionId: InspectionInfoSectionId, task: InspectionTask): [string, string][] {
  const scheduleLabel = task.time;
  switch (sectionId) {
    case "shipment":
      return [
        ["Reference No.", task.shipment],
        ["Request Date", "28 Jan 2026"],
        ["Exporter", task.exporter],
        ["Project Site", task.location],
        ["Permit No.", "PNG-EXP-2026-0441"],
        ["Loading Point", task.location],
        ["Licence No.", "LIC-8821-B"],
        ["Advised Volume", `${(task.logs * 1.85).toFixed(2)} m³`],
        ["Schedule", scheduleLabel],
        ["Status", INSPECTION_STATUS_META[task.status].label],
      ];
    case "ape":
      // Rendered by ApprovedPriceEndorsementPanel — keep a short fallback list for safety.
      return [
        ["APE Reference", "APE-2026-0417"],
        ["Product Category", "SAW/VENEER"],
        ["Permit Volume", "10,134.000 m³"],
        ["Endorsed Value", "USD 758,701.00"],
        ["Endorsed Lines", "11"],
      ];
    case "vessel":
      return [
        ["Vessel Name", "MV Pacific Timber"],
        ["IMO Number", "IMO 9482017"],
        ["Shipping Agent", "Harbour Link Agency"],
        ["Agent Contact", "+675 720 4410"],
        ["ETA", task.day === "today" ? "08/02/2026" : task.day === "tomorrow" ? "09/02/2026" : "12/02/2026"],
        ["Berth", "Berth 3 · Outer Quay"],
        ["Flag", "Panama"],
      ];
    case "declared-logs":
      return [
        ["Declared Logs", `${Math.min(task.logs, 4)} of ${task.logs}`],
        ["Product Group", "Sawn / Round"],
        ["Species Code", "KWILA / MERBAU"],
        ["Avg. Log Size", "L 4.2 m · D 48 cm"],
        ["Permit Volume", `${(task.logs * 1.85).toFixed(2)} m³`],
        ["Serial Range", "SN-1001 → SN-1048"],
        ["Declaration Date", "30 Jan 2026"],
      ];
    case "cargo":
      return [
        ["Buyer", "Qingdao Forest Trading Co."],
        ["Destination Port", "Qingdao, China"],
        ["Consignee", "QFT Import Desk"],
        ["Buyer Address", "12 Harbour Rd, Huangdao, Qingdao"],
        ["Incoterms", "FOB"],
        ["Bill of Lading", "Pending issue"],
      ];
    case "attachments":
      return [
        ["Files Attached", "3 documents"],
        ["APE Certificate", "APE-2026-118.pdf"],
        ["Export Permit", "PNG-EXP-2026-0441.pdf"],
        ["Packing List", "PL-SHIP-001.xlsx"],
        ["Submitted By", task.exporter],
        ["Submitted On", "31 Jan 2026"],
      ];
    case "volume-variance":
      return [
        ["Variances Found", "10"],
        ["Severity", "Requires review"],
        ["Permitted Volume", `${(task.logs * 2.1).toFixed(2)} m³`],
        ["Declared Volume", `${(task.logs * 1.85).toFixed(2)} m³`],
        ["Net Difference", `−${(task.logs * 0.25).toFixed(2)} m³`],
        ["Over-declared Rows", "3"],
        ["Under-declared Rows", "7"],
        ["Last Checked", "01 Feb 2026"],
      ];
  }
}

interface ApeLineItem {
  id: string;
  group: string;
  code: string;
  species: string;
  productType: string;
  permitVolume: string;
  unitPrice: string;
  totalPrice: string;
}

const APE_SUMMARY = {
  reference: "APE-2026-0417",
  category: "SAW/VENEER",
  permitVolume: "10,134.000 m³",
  endorsedValue: "USD 758,701.00",
  endorsedLines: "11",
} as const;

const APE_LINE_ITEMS: ApeLineItem[] = [
  {
    id: "1",
    group: "Group 1",
    code: "BUR",
    species: "Burckella",
    productType: "Saw / Veneer",
    permitVolume: "153.000 m³",
    unitPrice: "USD 88.00",
    totalPrice: "USD 13,464.00",
  },
  {
    id: "2",
    group: "Group 1",
    code: "CAL",
    species: "Calophyllum",
    productType: "Saw / Veneer",
    permitVolume: "210.000 m³",
    unitPrice: "USD 95.00",
    totalPrice: "USD 19,950.00",
  },
  {
    id: "3",
    group: "Group 1",
    code: "DIL",
    species: "Dillenia",
    productType: "Saw / Veneer",
    permitVolume: "178.500 m³",
    unitPrice: "USD 82.00",
    totalPrice: "USD 14,637.00",
  },
  {
    id: "4",
    group: "Group 2",
    code: "KWI",
    species: "Kwila",
    productType: "Saw / Veneer",
    permitVolume: "320.000 m³",
    unitPrice: "USD 120.00",
    totalPrice: "USD 38,400.00",
  },
  {
    id: "5",
    group: "Group 2",
    code: "TAU",
    species: "Taun",
    productType: "Saw / Veneer",
    permitVolume: "265.000 m³",
    unitPrice: "USD 102.00",
    totalPrice: "USD 27,030.00",
  },
  {
    id: "6",
    group: "Group 2",
    code: "MAL",
    species: "Malas",
    productType: "Saw / Veneer",
    permitVolume: "198.000 m³",
    unitPrice: "USD 76.00",
    totalPrice: "USD 15,048.00",
  },
  {
    id: "7",
    group: "Group 3",
    code: "PNG",
    species: "PNG Walnut",
    productType: "Saw / Veneer",
    permitVolume: "145.000 m³",
    unitPrice: "USD 140.00",
    totalPrice: "USD 20,300.00",
  },
  {
    id: "8",
    group: "Group 3",
    code: "ERI",
    species: "Erima",
    productType: "Saw / Veneer",
    permitVolume: "240.000 m³",
    unitPrice: "USD 68.00",
    totalPrice: "USD 16,320.00",
  },
  {
    id: "9",
    group: "Group 3",
    code: "TER",
    species: "Terminalia",
    productType: "Saw / Veneer",
    permitVolume: "186.000 m³",
    unitPrice: "USD 91.00",
    totalPrice: "USD 16,926.00",
  },
  {
    id: "10",
    group: "Group 4",
    code: "HOP",
    species: "Hopea Light",
    productType: "Saw / Veneer",
    permitVolume: "412.000 m³",
    unitPrice: "USD 110.00",
    totalPrice: "USD 45,320.00",
  },
  {
    id: "11",
    group: "Group 4",
    code: "VIT",
    species: "Vitex",
    productType: "Saw / Veneer",
    permitVolume: "355.000 m³",
    unitPrice: "USD 98.00",
    totalPrice: "USD 34,790.00",
  },
];

const APE_SUMMARY_BY_PRODUCT = [
  {
    productType: "Saw / Veneer",
    lines: "11 LINES",
    permitVolume: "10,134.000 m³",
    unitPrice: "USD 74.87",
    total: "USD 758,701.00",
  },
] as const;

/** Shared blue-gradient info hero — Inspection Info + APE summary cards. */
function GradientInfoHeroCard({
  icon,
  title,
  subtitle,
  stats,
  onClick,
  showArrow = Boolean(onClick),
  ariaLabel,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  stats: { label: string; value: string; valueColor?: string }[];
  onClick?: () => void;
  showArrow?: boolean;
  ariaLabel?: string;
}) {
  const twoCol = stats.length === 2;
  const inner = (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 55%)" }}
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col gap-3.5">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.18)" }}
          >
            {icon}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-bold text-white tracking-tight">{title}</h2>
            {subtitle ? (
              <p className="text-[13px] font-medium mt-1 leading-snug truncate" style={{ color: "rgba(255,255,255,0.78)" }}>
                {subtitle}
              </p>
            ) : null}
          </div>

          {showArrow && (
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "#ffffff", color: "#0f2f8f" }}
            >
              <ArrowRight size={15} />
            </span>
          )}
        </div>

        <div
          className={twoCol ? "rounded-xl px-3.5 py-3 grid grid-cols-2 gap-3" : "rounded-xl px-3.5 py-3 flex flex-col gap-2.5"}
          style={{
            background: "rgba(255,255,255,0.10)",
            border: "1px solid rgba(255,255,255,0.14)",
          }}
        >
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={twoCol && i === 1 ? "min-w-0 pl-2.5 sm:pl-3" : twoCol ? "min-w-0" : "min-w-0 flex items-baseline justify-between gap-3"}
              style={twoCol && i === 1 ? { borderLeft: "1px solid rgba(255,255,255,0.16)" } : undefined}
            >
              {twoCol ? (
                <>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "rgba(255,255,255,0.58)" }}>
                    {stat.label}
                  </p>
                  <p
                    className="text-[13px] sm:text-[15px] font-bold mt-1 tabular-nums tracking-tight leading-snug break-words"
                    style={{ color: stat.valueColor ?? "#ffffff" }}
                  >
                    {stat.value}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "rgba(255,255,255,0.58)" }}>
                    {stat.label}
                  </p>
                  <p
                    className="text-[14px] font-bold text-right tabular-nums tracking-tight"
                    style={{ color: stat.valueColor ?? "#ffffff" }}
                  >
                    {stat.value}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );

  const shellClass =
    "relative overflow-hidden w-full rounded-2xl p-3.5 sm:p-4 text-left focus:outline-none transition-all duration-200";
  const shellStyle = { background: GRADIENT, boxShadow: "0 10px 28px rgba(15,47,143,0.28)" };

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${shellClass} active:scale-[0.99]`}
        style={shellStyle}
        aria-label={ariaLabel ?? title}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={shellClass} style={shellStyle} aria-label={ariaLabel}>
      {inner}
    </div>
  );
}

function ApprovedPriceEndorsementPanel({ dark }: { dark: boolean }) {
  const [view, setView] = useState<"detailed" | "summary">("detailed");
  const textPrimary = dark ? "#ffffff" : "#0a1a4a";
  const textMuted = dark ? "rgba(255,255,255,0.82)" : FIELD_TEXT_MUTED;
  const cardBg = dark ? "rgba(30,41,59,0.72)" : "#ffffff";
  const cardBorder = dark ? "rgba(255,255,255,0.10)" : "rgba(15,47,143,0.10)";
  const summaryAccent = dark ? "#93c5fd" : "#0f2f8f";
  const rowBorder = dark ? "rgba(255,255,255,0.08)" : "rgba(15,47,143,0.08)";
  const groupBadgeBg = dark ? "#0f2f8f" : "#0f2f8f";

  return (
    <div className="flex flex-col gap-4">
      <GradientInfoHeroCard
        icon={<CircleDollarSign size={17} style={{ color: "#ffffff" }} />}
        title={APE_SUMMARY.reference}
        subtitle={APE_SUMMARY.category}
        showArrow={false}
        stats={[
          { label: "Permit Volume", value: APE_SUMMARY.permitVolume },
          { label: "Endorsed Value", value: APE_SUMMARY.endorsedValue },
          { label: "Endorsed Lines", value: APE_SUMMARY.endorsedLines },
        ]}
      />

      {/* Detailed / Summary tabs — same pattern as Log Inventory / Schedule */}
      <div
        className="flex gap-0.5 p-1 rounded-2xl w-full"
        style={{
          background: dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.88)",
          border: `1px solid ${cardBorder}`,
          boxShadow: dark ? "none" : "0 2px 10px rgba(15,47,143,0.05)",
        }}
        role="tablist"
        aria-label="APE view"
      >
        {(["detailed", "summary"] as const).map(tab => {
          const active = view === tab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setView(tab)}
              className="flex-1 h-10 rounded-xl text-sm font-semibold focus:outline-none transition-all duration-200 active:scale-[0.98]"
              style={{
                background: active ? GRADIENT : "transparent",
                color: active ? "#ffffff" : textMuted,
                boxShadow: active ? "0 4px 12px rgba(15,47,143,0.25)" : "none",
              }}
            >
              {tab === "detailed" ? "Detailed" : "Summary"}
            </button>
          );
        })}
      </div>

      {view === "detailed" ? (
        <div className="flex flex-col gap-2.5">
          {APE_LINE_ITEMS.map(item => (
            <div
              key={item.id}
              className="rounded-2xl px-3.5 py-3.5 flex flex-col gap-2.5"
              style={{
                background: cardBg,
                border: `1px solid ${cardBorder}`,
                boxShadow: dark ? "none" : "0 2px 10px rgba(15,47,143,0.05)",
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="inline-flex items-center h-6 px-2.5 rounded-md text-[11px] font-bold"
                  style={{ background: groupBadgeBg, color: "#ffffff" }}
                >
                  {item.group}
                </span>
                <span
                  className="inline-flex items-center h-6 px-2.5 rounded-md text-[11px] font-bold tracking-wide"
                  style={{
                    background: dark ? "rgba(255,255,255,0.06)" : "rgba(15,47,143,0.06)",
                    color: summaryAccent,
                    border: `1px solid ${cardBorder}`,
                  }}
                >
                  {item.code}
                </span>
              </div>

              <p className="text-[17px] font-bold tracking-tight leading-tight" style={{ color: textPrimary }}>
                {item.species}
              </p>

              <div className="flex flex-col gap-1.5">
                {([
                  ["Product Type", item.productType, false],
                  ["Permit Volume", item.permitVolume, false],
                  ["Unit Price (FOB/m³)", item.unitPrice, false],
                  ["Total Price", item.totalPrice, true],
                ] as const).map(([label, value, bold], i) => (
                  <div
                    key={label}
                    className="flex items-baseline justify-between gap-3 pt-1.5"
                    style={{ borderTop: i === 0 ? undefined : `1px solid ${rowBorder}` }}
                  >
                    <p className="text-[12px] font-medium" style={{ color: textMuted }}>{label}</p>
                    <p
                      className={`text-[13px] text-right tabular-nums ${bold ? "font-bold" : "font-semibold"}`}
                      style={{ color: textPrimary }}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {APE_SUMMARY_BY_PRODUCT.map(row => (
            <div
              key={row.productType}
              className="rounded-2xl px-3.5 py-3.5 flex flex-col gap-2.5"
              style={{
                background: cardBg,
                border: `1px solid ${cardBorder}`,
                boxShadow: dark ? "none" : "0 2px 10px rgba(15,47,143,0.05)",
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="inline-flex items-center h-6 px-2.5 rounded-md text-[11px] font-bold"
                  style={{ background: groupBadgeBg, color: "#ffffff" }}
                >
                  {row.productType}
                </span>
                <span
                  className="inline-flex items-center h-6 px-2.5 rounded-md text-[11px] font-bold tracking-wide"
                  style={{
                    background: dark ? "rgba(255,255,255,0.06)" : "rgba(15,47,143,0.06)",
                    color: summaryAccent,
                    border: `1px solid ${cardBorder}`,
                  }}
                >
                  {row.lines}
                </span>
              </div>
              {([
                ["Permit Volume", row.permitVolume, true],
                ["Unit Price (FOB/m³)", row.unitPrice, false],
                ["Total", row.total, true],
              ] as const).map(([label, value, bold]) => (
                <div
                  key={label}
                  className="flex items-baseline justify-between gap-3 pt-1.5"
                  style={{ borderTop: `1px solid ${rowBorder}` }}
                >
                  <p className="text-[12px] font-medium" style={{ color: textMuted }}>{label}</p>
                  <p
                    className={`text-[13px] text-right tabular-nums ${bold ? "font-bold" : "font-semibold"}`}
                    style={{ color: textPrimary }}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ApprovedPriceEndorsementScreen({
  dark,
  onBack,
}: {
  dark: boolean;
  onBack: () => void;
}) {
  const t = useInspectionInfoTheme(dark);
  const swipe = useSwipeBack(onBack);

  return (
    <div
      className="min-h-screen w-full transition-colors duration-300 animate-fadeIn"
      style={{ background: t.bg, fontFamily: "'Inter', sans-serif" }}
      {...swipe}
    >
      <AppHeaderBar dark={dark}>
        <div className="flex items-center gap-3">
          <BackCardButton onClick={onBack} dark={dark} />
          <div className="min-w-0">
            <h1 className="text-[18px] font-bold tracking-tight leading-snug" style={{ color: t.textPrimary }}>
              Approved Price Endorsement
            </h1>
          </div>
        </div>
      </AppHeaderBar>

      <div
        className="w-full max-w-[480px] mx-auto flex flex-col px-5 pt-5 gap-4"
        style={{ paddingBottom: BOTTOM_NAV_PAD }}
      >
        <ApprovedPriceEndorsementPanel dark={dark} />
      </div>
    </div>
  );
}

interface DeclaredLogItem {
  id: string;
  group: string;
  speciesCode: string;
  serialNo: string;
  productName: string;
  logSize: string;
  permitVolume: string;
}

const DECLARED_LOG_ITEMS: DeclaredLogItem[] = [
  {
    id: "1",
    group: "Group 2",
    speciesCode: "PNG-NGW-001",
    serialNo: "151-651RN-0000000003",
    productName: "New Guinea Walnut",
    logSize: "L 48.00 / D 28.00",
    permitVolume: "2.956 m³",
  },
  {
    id: "2",
    group: "Group 1",
    speciesCode: "PNG-KWI-002",
    serialNo: "151-651RN-0000000004",
    productName: "Kwila",
    logSize: "L 44.00 / D 25.00",
    permitVolume: "2.160 m³",
  },
  {
    id: "3",
    group: "Group 1",
    speciesCode: "PNG-MAL-003",
    serialNo: "151-651RN-0000000005",
    productName: "Malas",
    logSize: "L 40.00 / D 24.00",
    permitVolume: "1.810 m³",
  },
  {
    id: "4",
    group: "Group 3",
    speciesCode: "PNG-BUR-004",
    serialNo: "151-651RN-0000000006",
    productName: "Burckella",
    logSize: "L 42.00 / D 26.00",
    permitVolume: "2.236 m³",
  },
];

function DeclaredLogDetailsScreen({
  task,
  dark,
  onBack,
}: {
  task: InspectionTask;
  dark: boolean;
  onBack: () => void;
}) {
  const t = useInspectionInfoTheme(dark);
  const swipe = useSwipeBack(onBack);
  const logs = DECLARED_LOG_ITEMS;
  const shipmentRef = task.shipment.replace(/^#/, "") || "SHP-992831-TX";
  const totalVolume = "13.488 m³";
  const summaryAccent = dark ? "#93c5fd" : "#0f2f8f";
  const cardBg = dark ? "rgba(30,41,59,0.72)" : "#ffffff";
  const cardBorder = dark ? "rgba(255,255,255,0.10)" : "rgba(15,47,143,0.10)";
  const rowBorder = dark ? "rgba(255,255,255,0.08)" : "rgba(15,47,143,0.08)";

  return (
    <div
      className="min-h-screen w-full transition-colors duration-300 animate-fadeIn"
      style={{ background: t.bg, fontFamily: "'Inter', sans-serif" }}
      {...swipe}
    >
      <AppHeaderBar dark={dark}>
        <div className="flex items-center gap-3">
          <BackCardButton onClick={onBack} dark={dark} />
          <div className="min-w-0">
            <h1 className="text-[18px] font-bold tracking-tight leading-snug" style={{ color: t.textPrimary }}>
              Declared Log Details
            </h1>
          </div>
        </div>
      </AppHeaderBar>

      <div
        className="w-full max-w-[480px] mx-auto flex flex-col px-5 pt-5 gap-3"
        style={{ paddingBottom: BOTTOM_NAV_PAD }}
      >
        <GradientInfoHeroCard
          icon={<Layers size={17} style={{ color: "#ffffff" }} />}
          title="Declared Logs"
          subtitle={shipmentRef}
          showArrow={false}
          stats={[
            { label: "Logs Declared", value: String(logs.length) },
            { label: "Total Permit Volume", value: totalVolume },
          ]}
        />

        {/* Log cards */}
        {logs.map(item => (
          <div
            key={item.id}
            className="rounded-2xl px-3.5 py-3.5 flex flex-col gap-2.5"
            style={{
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              boxShadow: dark ? "none" : "0 2px 10px rgba(15,47,143,0.05)",
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className="inline-flex items-center h-6 px-2.5 rounded-md text-[11px] font-bold"
                style={{ background: "#0f2f8f", color: "#ffffff" }}
              >
                {item.group}
              </span>
              <span
                className="inline-flex items-center h-6 px-2.5 rounded-md text-[11px] font-bold tracking-wide"
                style={{
                  background: dark ? "rgba(255,255,255,0.06)" : "rgba(15,47,143,0.06)",
                  color: summaryAccent,
                  border: `1px solid ${cardBorder}`,
                }}
              >
                {item.speciesCode}
              </span>
            </div>

            <p className="text-[15px] font-bold tracking-tight leading-snug break-all" style={{ color: t.textPrimary }}>
              {item.serialNo}
            </p>

            <div className="flex flex-col gap-1.5">
              {([
                ["Product Name", item.productName, false],
                ["Log Size (L / D)", item.logSize, false],
                ["Permit Volume", item.permitVolume, true],
              ] as const).map(([label, value, bold], i) => (
                <div
                  key={label}
                  className="flex items-baseline justify-between gap-3 pt-1.5"
                  style={{ borderTop: i === 0 ? undefined : `1px solid ${rowBorder}` }}
                >
                  <p className="text-[12px] font-medium" style={{ color: t.textMuted }}>{label}</p>
                  <p
                    className={`text-[13px] text-right ${bold ? "font-bold tabular-nums" : "font-semibold"}`}
                    style={{ color: t.textPrimary }}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface VolumeVarianceItem {
  id: string;
  group: string;
  code: string;
  species: string;
  permitVol: string;
  declaredVol: string;
  difference: string;
  differencePct: string;
  remarks: string;
}

const VOLUME_VARIANCE_ITEMS: VolumeVarianceItem[] = [
  {
    id: "1",
    group: "Group 1",
    code: "BUR",
    species: "Burckella",
    permitVol: "153.000 m³",
    declaredVol: "121.574 m³",
    difference: "-31.428 m³",
    differencePct: "-20.5%",
    remarks: "*****",
  },
  {
    id: "2",
    group: "Group 1",
    code: "CAL",
    species: "Calophyllum",
    permitVol: "38.000 m³",
    declaredVol: "55.238 m³",
    difference: "+17.238 m³",
    differencePct: "+45.4%",
    remarks: "*****",
  },
  {
    id: "3",
    group: "Group 1",
    code: "DIL",
    species: "Dillenia",
    permitVol: "178.500 m³",
    declaredVol: "162.100 m³",
    difference: "-16.400 m³",
    differencePct: "-9.2%",
    remarks: "*****",
  },
  {
    id: "4",
    group: "Group 2",
    code: "KWI",
    species: "Kwila",
    permitVol: "320.000 m³",
    declaredVol: "298.450 m³",
    difference: "-21.550 m³",
    differencePct: "-6.7%",
    remarks: "*****",
  },
  {
    id: "5",
    group: "Group 2",
    code: "TAU",
    species: "Taun",
    permitVol: "265.000 m³",
    declaredVol: "271.200 m³",
    difference: "+6.200 m³",
    differencePct: "+2.3%",
    remarks: "*****",
  },
];

function PermittedVsDeclaredScreen({
  dark,
  onBack,
}: {
  dark: boolean;
  onBack: () => void;
}) {
  const t = useInspectionInfoTheme(dark);
  const swipe = useSwipeBack(onBack);
  const items = VOLUME_VARIANCE_ITEMS;
  const alertColor = "#d4183d";
  const summaryAccent = dark ? "#93c5fd" : "#0f2f8f";
  const cardBg = dark ? "rgba(30,41,59,0.72)" : "#ffffff";
  const cardBorder = dark ? "rgba(255,255,255,0.10)" : "rgba(15,47,143,0.10)";
  const rowBorder = dark ? "rgba(255,255,255,0.08)" : "rgba(15,47,143,0.08)";

  return (
    <div
      className="min-h-screen w-full transition-colors duration-300 animate-fadeIn"
      style={{ background: t.bg, fontFamily: "'Inter', sans-serif" }}
      {...swipe}
    >
      <AppHeaderBar dark={dark}>
        <div className="flex items-center gap-3">
          <BackCardButton onClick={onBack} dark={dark} />
          <div className="min-w-0">
            <h1 className="text-[18px] font-bold tracking-tight leading-snug" style={{ color: t.textPrimary }}>
              Permitted vs Declared
            </h1>
          </div>
        </div>
      </AppHeaderBar>

      <div
        className="w-full max-w-[480px] mx-auto flex flex-col px-5 pt-5 gap-3"
        style={{ paddingBottom: BOTTOM_NAV_PAD }}
      >
        <GradientInfoHeroCard
          icon={<Scale size={17} style={{ color: "#ffffff" }} />}
          title="SAW/VENEER"
          subtitle=""
          showArrow={false}
          stats={[
            { label: "Species Lines", value: "11" },
            { label: "Flagged Variances", value: "10", valueColor: "#fecaca" },
          ]}
        />

        {items.map(item => (
          <div
            key={item.id}
            className="rounded-2xl px-3.5 py-3.5 flex flex-col gap-2.5"
            style={{
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              boxShadow: dark ? "none" : "0 2px 10px rgba(15,47,143,0.05)",
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className="inline-flex items-center h-6 px-2.5 rounded-md text-[11px] font-bold"
                style={{ background: "#0f2f8f", color: "#ffffff" }}
              >
                {item.group}
              </span>
              <span
                className="inline-flex items-center h-6 px-2.5 rounded-md text-[11px] font-bold tracking-wide"
                style={{
                  background: dark ? "rgba(255,255,255,0.06)" : "rgba(15,47,143,0.06)",
                  color: summaryAccent,
                  border: `1px solid ${cardBorder}`,
                }}
              >
                {item.code}
              </span>
            </div>

            <p className="text-[17px] font-bold tracking-tight leading-tight" style={{ color: t.textPrimary }}>
              {item.species}
            </p>

            <div className="flex flex-col gap-1.5">
              {([
                ["Permit Vol.", item.permitVol, false, undefined],
                ["Declared Vol.", item.declaredVol, true, undefined],
                ["Difference", item.difference, false, undefined],
                ["Difference %", item.differencePct, true, alertColor],
                ["Remarks", item.remarks, false, undefined],
              ] as const).map(([label, value, bold, color], i) => (
                <div
                  key={label}
                  className="flex items-baseline justify-between gap-3 pt-1.5"
                  style={{ borderTop: i === 0 ? undefined : `1px solid ${rowBorder}` }}
                >
                  <p className="text-[12px] font-medium" style={{ color: t.textMuted }}>{label}</p>
                  <p
                    className={`text-[13px] text-right tabular-nums ${bold ? "font-bold" : "font-semibold"}`}
                    style={{ color: color ?? t.textPrimary }}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function useInspectionInfoTheme(dark: boolean) {
  return {
    bg: dark ? "#0f172a" : "#eef2fb",
    textPrimary: dark ? "#ffffff" : "#0a1a4a",
    textMuted: dark ? "rgba(255,255,255,0.65)" : "#5a6a99",
    textFaint: dark ? "rgba(255,255,255,0.70)" : FIELD_TEXT_FAINT,
    cardBg: dark ? "rgba(30, 41, 59, 0.72)" : "#ffffff",
    cardBorder: dark ? "rgba(255,255,255,0.08)" : "rgba(15,47,143,0.08)",
    cardShadow: dark ? "0 1px 0 rgba(255,255,255,0.04)" : "0 1px 2px rgba(15,47,143,0.05), 0 8px 24px rgba(15,47,143,0.06)",
    rowDivider: dark ? "rgba(255,255,255,0.08)" : "rgba(15,47,143,0.08)",
    iconBg: dark ? "rgba(255,255,255,0.10)" : "rgba(15,47,143,0.08)",
    iconColor: dark ? "#ffffff" : "#0f2f8f",
    badgeBg: dark ? "rgba(255,255,255,0.10)" : "rgba(15,47,143,0.07)",
    badgeColor: dark ? "#ffffff" : "#0f2f8f",
    chevronColor: dark ? "rgba(255,255,255,0.65)" : FIELD_TEXT_FAINT,
    alertIconBg: "rgba(212,24,61,0.12)",
    groupLabel: dark ? "rgba(255,255,255,0.45)" : "#6b7aa8",
  };
}

/** Left-edge swipe-back — arms only near the screen edge so vertical scroll stays free. */
function useSwipeBack(onBack: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const EDGE_PX = 28;
  const MIN_DX = 72;
  const MAX_DY = 56;

  return {
    onTouchStart: (e: TouchEvent<HTMLElement>) => {
      const t = e.touches[0];
      const rect = e.currentTarget.getBoundingClientRect();
      // Only gestures that begin on the left edge count as swipe-back.
      if (t.clientX - rect.left > EDGE_PX) {
        start.current = null;
        return;
      }
      start.current = { x: t.clientX, y: t.clientY };
    },
    onTouchMove: (e: TouchEvent<HTMLElement>) => {
      if (!start.current) return;
      const t = e.touches[0];
      const dx = t.clientX - start.current.x;
      const dy = Math.abs(t.clientY - start.current.y);
      // Bail out early if the finger is clearly scrolling vertically.
      if (dy > MAX_DY && dy > Math.abs(dx)) start.current = null;
    },
    onTouchEnd: (e: TouchEvent<HTMLElement>) => {
      if (!start.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.current.x;
      const dy = Math.abs(t.clientY - start.current.y);
      start.current = null;
      if (dx >= MIN_DX && dy < MAX_DY) onBack();
    },
    onTouchCancel: () => {
      start.current = null;
    },
  };
}

function InspectionInfoSkeleton({ dark }: { dark: boolean }) {
  const shimmer = dark ? "animate-shimmer-dark" : "animate-shimmer";
  return (
    <div className="w-full max-w-[480px] mx-auto flex flex-col px-5 py-6 gap-6">
      <div className="flex flex-col gap-2">
        <div className={`h-3 w-24 rounded ${shimmer}`} />
        <div className={`h-[168px] rounded-[18px] ${shimmer}`} />
      </div>
      <div className="flex flex-col gap-2">
        <div className={`h-3 w-32 rounded ${shimmer}`} />
        <div className={`h-[168px] rounded-[18px] ${shimmer}`} />
      </div>
    </div>
  );
}

function MaterialSymbol({
  name,
  size = 22,
  filled = false,
  className = "",
  style,
}: {
  name: string;
  size?: number;
  filled?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
        ...style,
      }}
      aria-hidden
    >
      {name}
    </span>
  );
}

interface ShipmentDetailsData {
  referenceNo: string;
  requestDate: string;
  status: "Active" | "Approved" | "Pending";
  exporter: string;
  projectSite: string;
  loadingPoint: string;
  permitNo: string;
  licenceNo: string;
  advisedVolume: string;
  shipmentId: string;
}

function getShipmentDetailsData(task: InspectionTask): ShipmentDetailsData {
  return {
    referenceNo: "20",
    requestDate: "07/15/2026",
    status: task.status === "complete" ? "Approved" : task.status === "inprogress" ? "Active" : "Pending",
    exporter: task.exporter,
    projectSite: "Mahaweli Forest Block A",
    loadingPoint: "L-001",
    permitNo: "P-001",
    licenceNo: "L-1234",
    advisedVolume: "10,134.000 m³",
    shipmentId: task.shipment,
  };
}

function ShipmentDetailsScreen({
  task,
  dark,
  onBack,
  data: dataProp,
}: {
  task: InspectionTask;
  dark: boolean;
  onBack: () => void;
  data?: Partial<ShipmentDetailsData>;
}) {
  const data = { ...getShipmentDetailsData(task), ...dataProp };
  const swipe = useSwipeBack(onBack);
  const [copied, setCopied] = useState(false);

  const bg = dark
    ? "radial-gradient(ellipse at top, #1a2744 0%, #0f172a 55%)"
    : "radial-gradient(ellipse at top, #e8eefc 0%, #F8F9FA 50%, #eef2fb 100%)";
  const cardBg = dark ? "rgba(30, 41, 59, 0.55)" : "rgba(255, 255, 255, 0.78)";
  const glass = { backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" } as const;
  const textPrimary = dark ? "#ffffff" : "#0a1a4a";
  const textMuted = dark ? "rgba(255,255,255,0.82)" : FIELD_TEXT_MUTED;
  const accent = "#0f2f8f";
  const elevation = dark
    ? "0 8px 32px rgba(0,0,0,0.4)"
    : "0 4px 24px rgba(15,47,143,0.10), 0 1px 0 rgba(255,255,255,0.8) inset";
  const cardBorder = dark ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(15,47,143,0.08)";
  const heroGradient = "linear-gradient(145deg, #1a45b5 0%, #0f2f8f 48%, #0a1f6b 100%)";

  const copyPermit = async () => {
    try {
      await navigator.clipboard.writeText(data.permitNo);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard may be unavailable */
    }
  };

  return (
    <div
      className="relative min-h-screen w-full transition-colors duration-300 animate-fadeIn flex flex-col"
      style={{ background: bg, fontFamily: "'Inter', sans-serif" }}
      {...swipe}
    >
      <AppHeaderBar dark={dark}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="field-touch w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 focus:outline-none pressable"
            style={{
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
              background: cardBg,
              color: accent,
              border: cardBorder,
              boxShadow: elevation,
            }}
            aria-label="Go back"
          >
            <MaterialSymbol name="arrow_back" size={22} />
          </button>
          <h1 className="flex-1 min-w-0 text-[18px] font-bold tracking-tight truncate" style={{ color: textPrimary }}>
            Shipment Details
          </h1>
        </div>
      </AppHeaderBar>

      <div className="flex-1 w-full max-w-[480px] mx-auto flex flex-col px-4 pt-2 pb-5 gap-3 overflow-y-auto">
        {/* Hero gradient glass card */}
        <section
          className="relative overflow-hidden rounded-3xl p-4 animate-riseIn"
          style={{
            background: heroGradient,
            boxShadow: "0 16px 40px rgba(15,47,143,0.35), 0 0 0 1px rgba(255,255,255,0.08) inset",
          }}
        >
          {/* Frosted orbs */}
          <div
            className="pointer-events-none absolute -top-10 -right-8 w-40 h-40 rounded-full"
            style={{ background: "rgba(255,255,255,0.12)", filter: "blur(2px)" }}
          />
          <div
            className="pointer-events-none absolute -bottom-16 -left-10 w-48 h-48 rounded-full"
            style={{ background: "rgba(224,0,37,0.18)", filter: "blur(4px)" }}
          />

          <div className="relative z-10 flex flex-col gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.65)" }}>
                Reference No
              </p>
              <p className="text-[28px] font-bold tracking-tight leading-none mt-1 text-white">#{data.referenceNo}</p>
              <p className="text-[12px] mt-1 font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>
                Requested {data.requestDate}
              </p>
            </div>

            {/* Volume focal metric — frosted glass panel */}
            <div
              className="rounded-2xl px-3 py-2.5"
              style={{
                ...glass,
                background: "linear-gradient(180deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.08) 100%)",
                border: "1px solid rgba(255,255,255,0.28)",
                boxShadow: "0 10px 28px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.12)",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: "linear-gradient(145deg, rgba(255,255,255,0.30), rgba(255,255,255,0.10))",
                    color: "#ffffff",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.40), 0 4px 12px rgba(0,0,0,0.22)",
                    border: "1px solid rgba(255,255,255,0.22)",
                  }}
                >
                  <MaterialSymbol name="straighten" size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "rgba(255,255,255,0.65)" }}>
                    Advised Volume
                  </p>
                  <p className="text-[22px] font-bold tracking-tight leading-snug text-white mt-0.5 break-words">
                    {data.advisedVolume}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Exporter & Location */}
        <section
          className="rounded-3xl p-4 animate-riseIn"
          style={{
            ...glass,
            background: cardBg,
            border: cardBorder,
            boxShadow: elevation,
            ["--rise-delay" as string]: "60ms",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(15,47,143,0.10)", color: accent }}
            >
              <MaterialSymbol name="location_on" size={18} />
            </div>
            <h2 className="text-[12px] font-bold uppercase tracking-[0.08em]" style={{ color: accent }}>
              Exporter &amp; Location
            </h2>
          </div>

          <div className="flex flex-col gap-2.5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: textMuted }}>Exporter Name</p>
              <p className="text-[15px] font-bold mt-0.5 leading-snug break-words" style={{ color: textPrimary }}>{data.exporter}</p>
            </div>
            <div
              className="h-px w-full"
              style={{ background: dark ? "rgba(255,255,255,0.08)" : "rgba(15,47,143,0.06)" }}
            />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: textMuted }}>Site</p>
              <p className="text-[15px] font-bold mt-0.5 leading-snug break-words" style={{ color: textPrimary }}>{data.projectSite}</p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: textMuted }}>Loading Point</p>
              <span
                className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] font-bold"
                style={{
                  background: dark ? "rgba(15,47,143,0.35)" : "rgba(15,47,143,0.08)",
                  color: accent,
                  border: cardBorder,
                }}
              >
                <MaterialSymbol name="local_shipping" size={15} />
                {data.loadingPoint}
              </span>
            </div>
          </div>
        </section>

        {/* Permit Credentials */}
        <section
          className="rounded-3xl p-4 animate-riseIn"
          style={{
            ...glass,
            background: cardBg,
            border: cardBorder,
            boxShadow: elevation,
            ["--rise-delay" as string]: "110ms",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(15,47,143,0.10)", color: accent }}
            >
              <MaterialSymbol name="verified_user" size={18} />
            </div>
            <h2 className="text-[12px] font-bold uppercase tracking-[0.08em]" style={{ color: accent }}>
              Permit Credentials
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div
              className="rounded-2xl px-3 py-2.5 flex flex-col gap-1 min-w-0"
              style={{
                background: dark ? "rgba(15,47,143,0.25)" : "rgba(15,47,143,0.05)",
                border: cardBorder,
              }}
            >
              <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>Permit Number</p>
              <div className="flex items-center gap-1.5">
                <span className="text-[15px] font-bold truncate" style={{ color: textPrimary }}>{data.permitNo}</span>
                <button
                  type="button"
                  onClick={copyPermit}
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 focus:outline-none active:scale-[0.94] transition-transform"
                  style={{ background: dark ? "rgba(255,255,255,0.08)" : "#ffffff", color: accent, boxShadow: elevation }}
                  aria-label="Copy permit number"
                >
                  <MaterialSymbol name={copied ? "check" : "content_copy"} size={14} />
                </button>
              </div>
            </div>
            <div
              className="rounded-2xl px-3 py-2.5 flex flex-col gap-1 min-w-0"
              style={{
                background: dark ? "rgba(15,47,143,0.25)" : "rgba(15,47,143,0.05)",
                border: cardBorder,
              }}
            >
              <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>Licence Number</p>
              <span className="text-[15px] font-bold truncate" style={{ color: textPrimary }}>{data.licenceNo}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function VesselDetailsScreen({
  task,
  dark,
  onBack,
}: {
  task: InspectionTask;
  dark: boolean;
  onBack: () => void;
}) {
  const swipe = useSwipeBack(onBack);
  const eta = task.day === "today" ? "08/02/2026" : task.day === "tomorrow" ? "09/02/2026" : "12/02/2026";
  const vesselName = "MV Pacific Cedar";
  const vesselAgent = "Oceanic Shipping Agencies";
  const vesselContact = "+675 321 4478";

  const bg = dark
    ? "radial-gradient(ellipse at top, #1a2744 0%, #0f172a 55%)"
    : "radial-gradient(ellipse at top, #e8eefc 0%, #F8F9FA 50%, #eef2fb 100%)";
  const cardBg = dark ? "rgba(30, 41, 59, 0.55)" : "rgba(255, 255, 255, 0.78)";
  const glass = { backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" } as const;
  const textPrimary = dark ? "#ffffff" : "#0a1a4a";
  const textMuted = dark ? "rgba(255,255,255,0.82)" : FIELD_TEXT_MUTED;
  const accent = "#0f2f8f";
  const elevation = dark
    ? "0 8px 32px rgba(0,0,0,0.4)"
    : "0 4px 24px rgba(15,47,143,0.10), 0 1px 0 rgba(255,255,255,0.8) inset";
  const cardBorder = dark ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(15,47,143,0.08)";
  const heroGradient = "linear-gradient(145deg, #1a45b5 0%, #0f2f8f 48%, #0a1f6b 100%)";

  return (
    <div
      className="relative min-h-screen w-full transition-colors duration-300 animate-fadeIn flex flex-col"
      style={{ background: bg, fontFamily: "'Inter', sans-serif" }}
      {...swipe}
    >
      <AppHeaderBar dark={dark}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="field-touch w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 focus:outline-none pressable"
            style={{
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
              background: cardBg,
              color: accent,
              border: cardBorder,
              boxShadow: elevation,
            }}
            aria-label="Go back"
          >
            <MaterialSymbol name="arrow_back" size={22} />
          </button>
          <h1 className="flex-1 min-w-0 text-[18px] font-bold tracking-tight truncate" style={{ color: textPrimary }}>
            Vessel Details
          </h1>
        </div>
      </AppHeaderBar>

      <div className="flex-1 w-full max-w-[480px] mx-auto flex flex-col px-4 pt-2 pb-5 gap-3 overflow-y-auto">
        {/* Hero — Shipment Details style applied */}
        <section
          className="relative overflow-hidden rounded-3xl p-4 animate-riseIn"
          style={{
            background: heroGradient,
            boxShadow: "0 16px 40px rgba(15,47,143,0.35), 0 0 0 1px rgba(255,255,255,0.08) inset",
          }}
        >
          {/* Frosted orbs — same as Shipment Details */}
          <div
            className="pointer-events-none absolute -top-10 -right-8 w-40 h-40 rounded-full"
            style={{ background: "rgba(255,255,255,0.12)", filter: "blur(2px)" }}
          />
          <div
            className="pointer-events-none absolute -bottom-16 -left-10 w-48 h-48 rounded-full"
            style={{ background: "rgba(224,0,37,0.18)", filter: "blur(4px)" }}
          />

          <div className="relative z-10 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.65)" }}>
                  Vessel Name
                </p>
                {/* Exact match to Shipment "#20" typography */}
                <p className="text-[28px] font-bold tracking-tight leading-none mt-1 text-white">{vesselName}</p>
                <p className="text-[12px] mt-1 font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>
                  Vessel ETA as declared in the inspection request.
                </p>
              </div>
              {/* Vessel logo — ACTIVE badge positioning (h-7 / rounded-full / flex-shrink-0) */}
              <span
                className="inline-flex items-center justify-center gap-1.5 h-7 px-3 rounded-full flex-shrink-0"
                style={{
                  background: "linear-gradient(145deg, rgba(255,255,255,0.30), rgba(255,255,255,0.10))",
                  color: "#ffffff",
                  border: "1px solid rgba(255,255,255,0.28)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), 0 4px 12px rgba(0,0,0,0.18)",
                }}
                aria-hidden
              >
                <MaterialSymbol name="sailing" size={16} />
              </span>
            </div>

            {/* ETA — exact Advised Volume metric hierarchy */}
            <div
              className="rounded-2xl px-3 py-2.5"
              style={{
                ...glass,
                background: "linear-gradient(180deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.08) 100%)",
                border: "1px solid rgba(255,255,255,0.28)",
                boxShadow: "0 10px 28px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.12)",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: "linear-gradient(145deg, rgba(255,255,255,0.30), rgba(255,255,255,0.10))",
                    color: "#ffffff",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.40), 0 4px 12px rgba(0,0,0,0.22)",
                    border: "1px solid rgba(255,255,255,0.22)",
                  }}
                >
                  <MaterialSymbol name="event" size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "rgba(255,255,255,0.65)" }}>
                    Estimated Arrival
                  </p>
                  <p className="text-[22px] font-bold tracking-tight leading-snug text-white mt-0.5 break-words">
                    {eta}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Agent & Contact — exact Exporter & Location card classes */}
        <section
          className="rounded-3xl p-4 animate-riseIn"
          style={{
            ...glass,
            background: cardBg,
            border: cardBorder,
            boxShadow: elevation,
            ["--rise-delay" as string]: "60ms",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(15,47,143,0.10)", color: accent }}
            >
              <MaterialSymbol name="support_agent" size={18} />
            </div>
            <h2 className="text-[12px] font-bold uppercase tracking-[0.08em]" style={{ color: accent }}>
              Agent &amp; Contact
            </h2>
          </div>

          <div className="flex flex-col gap-2.5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: textMuted }}>Vessel Agent</p>
              <p className="text-[15px] font-bold mt-0.5 leading-snug break-words" style={{ color: textPrimary }}>{vesselAgent}</p>
            </div>
            <div
              className="h-px w-full"
              style={{ background: dark ? "rgba(255,255,255,0.08)" : "rgba(15,47,143,0.06)" }}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: textMuted }}>Vessel Contact</p>
              <span
                className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] font-bold"
                style={{
                  background: dark ? "rgba(15,47,143,0.35)" : "rgba(15,47,143,0.08)",
                  color: accent,
                  border: cardBorder,
                }}
              >
                <MaterialSymbol name="call" size={15} />
                {vesselContact}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function CargoDetailsScreen({
  dark,
  onBack,
}: {
  dark: boolean;
  onBack: () => void;
}) {
  const swipe = useSwipeBack(onBack);
  const buyerName = "Shandong Timber Import Co.";
  const buyerAddress = "No. 88 Haigang Road, Qingdao, Shandong, China";
  const portOfDischarge = "Qingdao, China";

  const bg = dark
    ? "radial-gradient(ellipse at top, #1a2744 0%, #0f172a 55%)"
    : "radial-gradient(ellipse at top, #e8eefc 0%, #F8F9FA 50%, #eef2fb 100%)";
  const cardBg = dark ? "rgba(30, 41, 59, 0.55)" : "rgba(255, 255, 255, 0.78)";
  const glass = { backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" } as const;
  const textPrimary = dark ? "#ffffff" : "#0a1a4a";
  const textMuted = dark ? "rgba(255,255,255,0.82)" : FIELD_TEXT_MUTED;
  const accent = "#0f2f8f";
  const elevation = dark
    ? "0 8px 32px rgba(0,0,0,0.4)"
    : "0 4px 24px rgba(15,47,143,0.10), 0 1px 0 rgba(255,255,255,0.8) inset";
  const cardBorder = dark ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(15,47,143,0.08)";
  const heroGradient = "linear-gradient(145deg, #1a45b5 0%, #0f2f8f 48%, #0a1f6b 100%)";

  return (
    <div
      className="relative min-h-screen w-full transition-colors duration-300 animate-fadeIn flex flex-col"
      style={{ background: bg, fontFamily: "'Inter', sans-serif" }}
      {...swipe}
    >
      <AppHeaderBar dark={dark}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="field-touch w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 focus:outline-none pressable"
            style={{
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
              background: cardBg,
              color: accent,
              border: cardBorder,
              boxShadow: elevation,
            }}
            aria-label="Go back"
          >
            <MaterialSymbol name="arrow_back" size={22} />
          </button>
          <h1 className="flex-1 min-w-0 text-[18px] font-bold tracking-tight truncate" style={{ color: textPrimary }}>
            Cargo Details
          </h1>
        </div>
      </AppHeaderBar>

      <div className="flex-1 w-full max-w-[480px] mx-auto flex flex-col px-4 pt-2 pb-5 gap-3 overflow-y-auto">
        {/* Hero — Buyer (Shipment Details hero style) */}
        <section
          className="relative overflow-hidden rounded-3xl p-4 animate-riseIn"
          style={{
            background: heroGradient,
            boxShadow: "0 16px 40px rgba(15,47,143,0.35), 0 0 0 1px rgba(255,255,255,0.08) inset",
          }}
        >
          <div
            className="pointer-events-none absolute -top-10 -right-8 w-40 h-40 rounded-full"
            style={{ background: "rgba(255,255,255,0.12)", filter: "blur(2px)" }}
          />
          <div
            className="pointer-events-none absolute -bottom-16 -left-10 w-48 h-48 rounded-full"
            style={{ background: "rgba(224,0,37,0.18)", filter: "blur(4px)" }}
          />

          <div className="relative z-10 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.65)" }}>
                  Buyer
                </p>
                <p className="text-[22px] font-bold tracking-tight leading-snug mt-1 text-white break-words">{buyerName}</p>
              </div>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: "linear-gradient(145deg, rgba(255,255,255,0.30), rgba(255,255,255,0.10))",
                  color: "#ffffff",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.40), 0 4px 12px rgba(0,0,0,0.22)",
                  border: "1px solid rgba(255,255,255,0.22)",
                }}
              >
                <MaterialSymbol name="storefront" size={22} />
              </div>
            </div>

            <div
              className="rounded-2xl px-3 py-2.5"
              style={{
                ...glass,
                background: "linear-gradient(180deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.08) 100%)",
                border: "1px solid rgba(255,255,255,0.28)",
                boxShadow: "0 10px 28px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.12)",
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: "linear-gradient(145deg, rgba(255,255,255,0.30), rgba(255,255,255,0.10))",
                    color: "#ffffff",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.40), 0 4px 12px rgba(0,0,0,0.22)",
                    border: "1px solid rgba(255,255,255,0.22)",
                  }}
                >
                  <MaterialSymbol name="home_pin" size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "rgba(255,255,255,0.65)" }}>
                    Buyer Address
                  </p>
                  <p className="text-[15px] font-bold tracking-tight leading-snug text-white mt-0.5 break-words">
                    {buyerAddress}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Destination — Port of Discharge */}
        <section
          className="rounded-3xl p-4 animate-riseIn"
          style={{
            ...glass,
            background: cardBg,
            border: cardBorder,
            boxShadow: elevation,
            ["--rise-delay" as string]: "60ms",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(15,47,143,0.10)", color: accent }}
            >
              <MaterialSymbol name="anchor" size={18} />
            </div>
            <h2 className="text-[12px] font-bold uppercase tracking-[0.08em]" style={{ color: accent }}>
              Destination
            </h2>
          </div>

          <div className="flex items-center">
            <span
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] font-bold"
              style={{
                background: dark ? "rgba(15,47,143,0.35)" : "rgba(15,47,143,0.08)",
                color: accent,
                border: cardBorder,
              }}
            >
              <MaterialSymbol name="public" size={15} />
              {portOfDischarge}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}

type AttachmentFile = {
  fileName: string;
  category: string;
  uploaded: string;
  size: string;
};

const ATTACHMENT_FILES: AttachmentFile[] = [
  {
    fileName: "Export_Permit_P-001.pdf",
    category: "PERMIT",
    uploaded: "07/15/2026",
    size: "412 KB",
  },
  {
    fileName: "Price_Endorsement_APE-2026-0417.pdf",
    category: "APE",
    uploaded: "07/15/2026",
    size: "268 KB",
  },
  {
    fileName: "Log_Manifest_SHP-992831-TX.png",
    category: "MANIFEST",
    uploaded: "07/16/2026",
    size: "96 KB",
  },
];

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ACCEPTED_ATTACHMENT_MIME = "image/jpeg,image/png,application/pdf";
const ACCEPTED_ATTACHMENT_EXTS = ["jpg", "jpeg", "png", "pdf"];
const ACCEPTED_EVIDENCE_MIME = "image/jpeg,image/png,image/webp";
const ACCEPTED_EVIDENCE_EXTS = ["jpg", "jpeg", "png", "webp"];

type EvidencePhoto = {
  id: string;
  name: string;
  previewUrl: string;
  size: string;
};

function formatAttachmentSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

function parseAttachment(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  const ext = (dot >= 0 ? fileName.slice(dot + 1) : "").toUpperCase();
  const base = (dot >= 0 ? fileName.slice(0, dot) : fileName).replace(/_/g, " ");
  const kind: "spreadsheet" | "image" | "document" =
    ext === "XLSX" || ext === "XLS" || ext === "CSV"
      ? "spreadsheet"
      : ext === "PNG" || ext === "JPG" || ext === "JPEG" || ext === "WEBP"
        ? "image"
        : "document";
  return {
    title: base,
    ext: ext || "FILE",
    kind,
    icon: kind === "spreadsheet" ? "table_chart" : kind === "image" ? "image" : "picture_as_pdf",
  };
}

function AttachmentFileCard({
  file,
  dark = false,
  index = 0,
  onDelete,
}: {
  file: AttachmentFile;
  dark?: boolean;
  index?: number;
  onDelete?: () => void;
}) {
  const parsed = parseAttachment(file.fileName);
  const textPrimary = dark ? "#ffffff" : "#0a1a4a";
  const textMuted = dark ? "rgba(255,255,255,0.82)" : FIELD_TEXT_MUTED;
  const cardBg = dark ? "rgba(30, 41, 59, 0.55)" : "rgba(255, 255, 255, 0.78)";
  const cardBorder = dark ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(15,47,143,0.08)";
  const elevation = dark
    ? "0 8px 32px rgba(0,0,0,0.4)"
    : "0 4px 24px rgba(15,47,143,0.10), 0 1px 0 rgba(255,255,255,0.8) inset";
  const accent = "#0f2f8f";
  const iconTone =
    parsed.kind === "spreadsheet"
      ? dark
        ? { background: "rgba(16,185,129,0.18)", color: "#34d399" }
        : { background: "#ecfdf5", color: "#059669" }
      : parsed.kind === "image"
        ? dark
          ? { background: "rgba(59,130,246,0.18)", color: "#60a5fa" }
          : { background: "#eff6ff", color: "#2563eb" }
        : dark
          ? { background: "rgba(224,0,37,0.18)", color: "#f87171" }
          : { background: "#fef2f2", color: "#dc2626" };

  return (
    <div
      className="w-full rounded-3xl p-4 animate-riseIn"
      style={{
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        background: cardBg,
        border: cardBorder,
        boxShadow: elevation,
        ["--rise-delay" as string]: `${60 + index * 50}ms`,
      }}
    >
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={iconTone}>
          <MaterialSymbol name={parsed.icon} size={22} />
        </div>

        <div className="min-w-0 flex-1">
          {/* Title gets full row width — badge moved below to avoid awkward wraps */}
          <p
            className="text-[15px] font-bold leading-snug truncate"
            style={{ color: textPrimary }}
            title={parsed.title}
          >
            {parsed.title}
          </p>

          <div className={`flex items-center gap-2 mt-1.5 flex-wrap text-xs ${dark ? "" : "text-slate-500"}`} style={dark ? { color: textMuted } : undefined}>
            <span
              className="inline-flex items-center h-5 px-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide flex-shrink-0"
              style={{
                background: dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)",
                color: dark ? "rgba(255,255,255,0.7)" : "#64748b",
              }}
            >
              .{parsed.ext}
            </span>
            <span className="min-w-0 truncate">
              Uploaded {file.uploaded} <span aria-hidden>•</span> {file.size}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 self-center">
          <button
            type="button"
            className="w-10 h-10 rounded-xl flex items-center justify-center focus:outline-none active:scale-95 transition-transform"
            style={{
              background: dark ? "rgba(15,47,143,0.35)" : "rgba(15,47,143,0.08)",
              color: accent,
              border: cardBorder,
            }}
            aria-label={`View ${parsed.title}`}
          >
            <MaterialSymbol name="visibility" size={20} />
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="w-10 h-10 rounded-xl flex items-center justify-center focus:outline-none active:scale-95 transition-transform"
              style={{
                background: dark ? "rgba(220,38,38,0.18)" : "#fef2f2",
                color: dark ? "#f87171" : "#dc2626",
                border: dark ? "1px solid rgba(248,113,113,0.25)" : "1px solid rgba(220,38,38,0.16)",
              }}
              aria-label={`Delete ${parsed.title}`}
            >
              <Trash2 size={17} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function RequestAttachmentsScreen({
  dark,
  onBack,
}: {
  dark: boolean;
  onBack: () => void;
}) {
  const swipe = useSwipeBack(onBack);
  const files = ATTACHMENT_FILES;

  const bg = dark
    ? "radial-gradient(ellipse at top, #1a2744 0%, #0f172a 55%)"
    : "radial-gradient(ellipse at top, #e8eefc 0%, #F8F9FA 50%, #eef2fb 100%)";
  const cardBg = dark ? "rgba(30, 41, 59, 0.55)" : "rgba(255, 255, 255, 0.78)";
  const glass = { backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" } as const;
  const textPrimary = dark ? "#ffffff" : "#0a1a4a";
  const textMuted = dark ? "rgba(255,255,255,0.82)" : FIELD_TEXT_MUTED;
  const accent = "#0f2f8f";
  const elevation = dark
    ? "0 8px 32px rgba(0,0,0,0.4)"
    : "0 4px 24px rgba(15,47,143,0.10), 0 1px 0 rgba(255,255,255,0.8) inset";
  const cardBorder = dark ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(15,47,143,0.08)";
  const heroGradient = "linear-gradient(145deg, #1a45b5 0%, #0f2f8f 48%, #0a1f6b 100%)";

  return (
    <div
      className="relative min-h-screen w-full transition-colors duration-300 animate-fadeIn flex flex-col"
      style={{ background: bg, fontFamily: "'Inter', sans-serif" }}
      {...swipe}
    >
      <AppHeaderBar dark={dark}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="field-touch w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 focus:outline-none pressable"
            style={{
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
              background: cardBg,
              color: accent,
              border: cardBorder,
              boxShadow: elevation,
            }}
            aria-label="Go back"
          >
            <MaterialSymbol name="arrow_back" size={22} />
          </button>
          <h1 className="flex-1 min-w-0 text-[18px] font-bold tracking-tight truncate" style={{ color: textPrimary }}>
            Attachments
          </h1>
        </div>
      </AppHeaderBar>

      <div className="flex-1 w-full max-w-[480px] mx-auto flex flex-col px-4 pt-2 pb-5 gap-3 overflow-y-auto">
        {/* Summary hero — Shipment Details style */}
        <section
          className="relative overflow-hidden rounded-3xl p-4 animate-riseIn"
          style={{
            background: heroGradient,
            boxShadow: "0 16px 40px rgba(15,47,143,0.35), 0 0 0 1px rgba(255,255,255,0.08) inset",
          }}
        >
          <div
            className="pointer-events-none absolute -top-10 -right-8 w-40 h-40 rounded-full"
            style={{ background: "rgba(255,255,255,0.12)", filter: "blur(2px)" }}
          />
          <div
            className="pointer-events-none absolute -bottom-16 -left-10 w-48 h-48 rounded-full"
            style={{ background: "rgba(224,0,37,0.18)", filter: "blur(4px)" }}
          />

          <div className="relative z-10 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.65)" }}>
                  Attachments
                </p>
                <p className="text-[22px] font-bold tracking-tight leading-snug mt-1 text-white">Documents</p>
                <p className="text-[12px] mt-1 font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>
                  Submitted by the exporter with this request. View only.
                </p>
              </div>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: "linear-gradient(145deg, rgba(255,255,255,0.30), rgba(255,255,255,0.10))",
                  color: "#ffffff",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.40), 0 4px 12px rgba(0,0,0,0.22)",
                  border: "1px solid rgba(255,255,255,0.22)",
                }}
              >
                <MaterialSymbol name="attach_file" size={22} />
              </div>
            </div>

            <div
              className="rounded-2xl px-3 py-2.5"
              style={{
                ...glass,
                background: "linear-gradient(180deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.08) 100%)",
                border: "1px solid rgba(255,255,255,0.28)",
                boxShadow: "0 10px 28px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.12)",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: "linear-gradient(145deg, rgba(255,255,255,0.30), rgba(255,255,255,0.10))",
                    color: "#ffffff",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.40), 0 4px 12px rgba(0,0,0,0.22)",
                    border: "1px solid rgba(255,255,255,0.22)",
                  }}
                >
                  <MaterialSymbol name="folder_open" size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "rgba(255,255,255,0.65)" }}>
                    Files Attached
                  </p>
                  <p className="text-[22px] font-bold tracking-tight leading-snug text-white mt-0.5">{files.length}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Document list — usability-focused cards */}
        {files.map((file, i) => (
          <AttachmentFileCard key={file.fileName} file={file} dark={dark} index={i} />
        ))}
      </div>
    </div>
  );
}

function InspectionInfoSectionDetailScreen({
  task,
  section,
  dark,
  onBack,
}: {
  task: InspectionTask;
  section: InspectionInfoSection;
  dark: boolean;
  onBack: () => void;
}) {
  if (section.id === "shipment") {
    return <ShipmentDetailsScreen task={task} dark={dark} onBack={onBack} />;
  }
  if (section.id === "vessel") {
    return <VesselDetailsScreen task={task} dark={dark} onBack={onBack} />;
  }
  if (section.id === "cargo") {
    return <CargoDetailsScreen dark={dark} onBack={onBack} />;
  }
  if (section.id === "attachments") {
    return <RequestAttachmentsScreen dark={dark} onBack={onBack} />;
  }

  const fields = getInspectionInfoSectionFields(section.id, task);
  const t = useInspectionInfoTheme(dark);
  const swipe = useSwipeBack(onBack);

  return (
    <div
      className="min-h-screen w-full transition-colors duration-300 animate-fadeIn"
      style={{ background: t.bg, fontFamily: "'Inter', sans-serif" }}
      {...swipe}
    >
      <AppHeaderBar dark={dark}>
        <div className="flex items-center gap-3">
          <BackCardButton onClick={onBack} dark={dark} />
          <div className="min-w-0">
            <h1 className="text-[18px] font-bold tracking-tight leading-snug" style={{ color: t.textPrimary }}>{section.title}</h1>
            <p className="text-xs truncate" style={{ color: t.textMuted }}>{task.shipment}</p>
          </div>
        </div>
      </AppHeaderBar>

      <div
        className="w-full max-w-[480px] mx-auto flex flex-col px-5 pt-6 gap-5"
        style={{ paddingBottom: BOTTOM_NAV_PAD }}
      >
        <div
          className="rounded-[20px] px-4 py-3.5 flex items-center gap-3 animate-riseIn"
          style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, boxShadow: t.cardShadow }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: section.alert ? t.alertIconBg : t.iconBg,
              color: section.alert ? "#d4183d" : t.iconColor,
            }}
          >
            {section.icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: t.textFaint }}>Section</p>
            <p className="text-sm font-semibold truncate mt-0.5" style={{ color: t.textPrimary }}>{section.badge}</p>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider flex-shrink-0" style={{ color: t.textMuted }}>
            <Lock size={10} /> Read Only
          </span>
        </div>

        <div
          className="rounded-[20px] overflow-hidden animate-riseIn"
          style={{
            background: t.cardBg,
            border: `1px solid ${t.cardBorder}`,
            boxShadow: t.cardShadow,
            ["--rise-delay" as string]: "50ms",
          }}
        >
          {fields.map(([label, val], i) => (
            <div
              key={label}
              className="px-4 py-3.5 flex items-start justify-between gap-4"
              style={{ borderTop: i === 0 ? undefined : `1px solid ${t.rowDivider}` }}
            >
              <p className="text-[13px] font-medium flex-shrink-0 pt-0.5" style={{ color: t.textMuted }}>{label}</p>
              <p className="text-[14px] font-semibold text-right break-words leading-snug" style={{ color: t.textPrimary }}>{val}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InspectionInfoDetailsScreen({
  task,
  dark,
  onBack,
  onOpenApe,
  onOpenDeclaredLogs,
  onOpenVolumeVariance,
}: {
  task: InspectionTask;
  dark: boolean;
  onBack: () => void;
  onOpenApe: () => void;
  onOpenDeclaredLogs: () => void;
  onOpenVolumeVariance: () => void;
}) {
  const [expandedSectionId, setExpandedSectionId] = useState<InspectionInfoSectionId | null>(null);
  const [loading, setLoading] = useState(true);
  const sections = getInspectionInfoSections(task);
  const t = useInspectionInfoTheme(dark);
  const swipe = useSwipeBack(onBack);

  useEffect(() => {
    setLoading(true);
    setExpandedSectionId(null);
    const id = window.setTimeout(() => setLoading(false), 520);
    return () => window.clearTimeout(id);
  }, [task.id]);

  const navigateSections = new Set<InspectionInfoSectionId>(["ape", "declared-logs", "volume-variance"]);

  const toggleSection = (id: InspectionInfoSectionId) => {
    if (id === "ape") {
      onOpenApe();
      return;
    }
    if (id === "declared-logs") {
      onOpenDeclaredLogs();
      return;
    }
    if (id === "volume-variance") {
      onOpenVolumeVariance();
      return;
    }
    setExpandedSectionId(prev => (prev === id ? null : id));
  };

  return (
    <div
      className="min-h-screen w-full transition-colors duration-300 animate-fadeIn"
      style={{ background: t.bg, fontFamily: "'Inter', sans-serif" }}
      {...swipe}
    >
      <AppHeaderBar dark={dark}>
        <div className="flex items-center gap-3">
          <BackCardButton onClick={onBack} dark={dark} />
          <div className="min-w-0">
            <h1 className="text-[18px] font-bold tracking-tight" style={{ color: t.textPrimary }}>Inspection Info</h1>
          </div>
        </div>
      </AppHeaderBar>

      {loading ? (
        <InspectionInfoSkeleton dark={dark} />
      ) : (
        <div
          className="w-full max-w-[480px] mx-auto flex flex-col px-5 pt-6 gap-6"
          style={{ paddingBottom: BOTTOM_NAV_PAD }}
        >
          {INSPECTION_INFO_GROUPS.map((group, gIdx) => {
            const rows = sections.filter(s => s.group === group.id);
            if (rows.length === 0) return null;
            return (
              <section key={group.id} className="flex flex-col gap-2 animate-riseIn" style={{ ["--rise-delay" as string]: `${60 + gIdx * 70}ms` }}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] px-1" style={{ color: t.groupLabel }}>
                  {group.label}
                </p>
                <div
                  className="rounded-[18px] overflow-hidden"
                  style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, boxShadow: t.cardShadow }}
                >
                  {rows.map((section, index) => {
                    const isNavigate = navigateSections.has(section.id);
                    const expanded = !isNavigate && expandedSectionId === section.id;
                    const fields = getInspectionInfoSectionFields(section.id, task);
                    return (
                      <div
                        key={section.id}
                        style={{ borderTop: index === 0 ? undefined : `1px solid ${t.rowDivider}` }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSection(section.id)}
                          className="w-full px-3.5 py-3.5 flex items-center gap-3 text-left focus:outline-none active:opacity-70 transition-opacity"
                          aria-expanded={isNavigate ? undefined : expanded}
                          aria-controls={isNavigate ? undefined : `info-panel-${section.id}`}
                          id={`info-trigger-${section.id}`}
                          aria-label={isNavigate ? `Open ${section.title}` : undefined}
                        >
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{
                              background: section.alert ? t.alertIconBg : t.iconBg,
                              color: section.alert ? "#d4183d" : t.iconColor,
                            }}
                          >
                            {section.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[15px] font-semibold leading-snug" style={{ color: t.textPrimary }}>{section.title}</p>
                          </div>
                          <span
                            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isNavigate ? "animate-nudgeRight" : "transition-transform duration-200"}`}
                            style={{
                              background: isNavigate || expanded ? GRADIENT : t.iconBg,
                              color: isNavigate || expanded ? "#ffffff" : t.iconColor,
                              boxShadow: isNavigate || expanded ? "0 2px 8px rgba(15,47,143,0.28)" : "none",
                              transform: !isNavigate && expanded ? "rotate(180deg)" : "rotate(0deg)",
                            }}
                            aria-hidden
                          >
                            {isNavigate ? <ArrowRight size={14} /> : <ChevronDown size={16} />}
                          </span>
                        </button>

                        {!isNavigate && (
                          <div
                            id={`info-panel-${section.id}`}
                            role="region"
                            aria-labelledby={`info-trigger-${section.id}`}
                            className="grid transition-[grid-template-rows] duration-200 ease-out"
                            style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
                          >
                            <div className="overflow-hidden">
                              <div
                                className="px-3.5 pb-3.5 pt-0.5 flex flex-col gap-0"
                                style={{
                                  background: dark ? "rgba(15,23,42,0.35)" : "rgba(240,244,255,0.85)",
                                  borderTop: expanded ? `1px solid ${t.rowDivider}` : undefined,
                                }}
                              >
                                {fields.map(([label, val], i) => (
                                  <div
                                    key={label}
                                    className="py-2.5 flex items-start justify-between gap-4"
                                    style={{ borderTop: i === 0 ? undefined : `1px solid ${t.rowDivider}` }}
                                  >
                                    <p className="text-[12px] font-medium flex-shrink-0 pt-0.5" style={{ color: t.textMuted }}>{label}</p>
                                    <p className="text-[13px] font-semibold text-right break-words leading-snug" style={{ color: t.textPrimary }}>{val}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatDisplayDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

function parseISODateLocal(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function toISODateLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function CompactBlueDatePicker({
  value,
  onChange,
  dark = false,
}: {
  value: string;
  onChange: (iso: string) => void;
  dark?: boolean;
}) {
  const selected = value ? parseISODateLocal(value) : new Date();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (open && value) {
      const d = parseISODateLocal(value);
      setView(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [open, value]);

  const year = view.getFullYear();
  const month = view.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = view.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const selectedIso = value;

  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const fieldBg = dark ? "rgba(15, 23, 42, 0.85)" : "#f8faff";
  const fieldBorder = dark ? "rgba(255,255,255,0.12)" : "#dce4f5";
  const fieldBorderOpen = dark ? "rgba(96,165,250,0.55)" : "rgba(15,47,143,0.45)";
  const textPrimary = dark ? "#ffffff" : "#0a1a4a";
  const textMuted = dark ? "rgba(255,255,255,0.82)" : FIELD_TEXT_MUTED;
  const panelBg = dark ? "rgba(15, 23, 42, 0.98)" : "#f8faff";
  const panelBorder = dark ? "rgba(255,255,255,0.12)" : "rgba(15,47,143,0.12)";
  const navBtnBg = dark ? "rgba(255,255,255,0.08)" : "rgba(15,47,143,0.06)";
  const navBtnColor = dark ? "#93c5fd" : "#0f2f8f";

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="pressable field-touch w-full min-h-12 h-12 rounded-xl px-4 text-sm text-left flex items-center justify-between focus:outline-none"
        style={{
          background: fieldBg,
          color: textPrimary,
          border: open ? `1.5px solid ${fieldBorderOpen}` : `1px solid ${fieldBorder}`,
          boxShadow: open
            ? (dark ? "0 0 0 3px rgba(59,130,246,0.18)" : "0 0 0 3px rgba(15,47,143,0.10)")
            : "none",
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span style={{ color: value ? textPrimary : (dark ? "rgba(255,255,255,0.70)" : FIELD_TEXT_FAINT) }}>
          {value ? formatDisplayDate(value) : "Select date"}
        </span>
        <Calendar size={16} style={{ color: textMuted, flexShrink: 0 }} />
      </button>

      {open && (
        <div
          className="mt-2 rounded-2xl p-3 animate-riseIn"
          style={{
            background: panelBg,
            border: `1px solid ${panelBorder}`,
          }}
          role="dialog"
          aria-label="Choose date"
        >
          <div className="flex items-center justify-between mb-2.5 px-0.5">
            <button
              type="button"
              onClick={() => setView(new Date(year, month - 1, 1))}
              className="field-touch w-12 h-12 rounded-lg flex items-center justify-center focus:outline-none"
              style={{ background: navBtnBg, color: navBtnColor }}
              aria-label="Previous month"
            >
              <ArrowLeft size={15} />
            </button>
            <p className="text-[13px] font-bold" style={{ color: textPrimary }}>{monthLabel}</p>
            <button
              type="button"
              onClick={() => setView(new Date(year, month + 1, 1))}
              className="field-touch w-12 h-12 rounded-lg flex items-center justify-center focus:outline-none"
              style={{ background: navBtnBg, color: navBtnColor }}
              aria-label="Next month"
            >
              <ArrowRight size={15} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={`${d}-${i}`} className="h-7 flex items-center justify-center text-[10px] font-semibold" style={{ color: dark ? "rgba(255,255,255,0.70)" : FIELD_TEXT_FAINT }}>
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              if (day == null) return <div key={`e-${i}`} className="h-8" />;
              const iso = toISODateLocal(new Date(year, month, day));
              const isSelected = iso === selectedIso;
              const isToday = iso === todayISODate();
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                  className="h-8 rounded-lg text-[12px] font-semibold focus:outline-none transition-colors"
                  style={{
                    background: isSelected ? GRADIENT : isToday ? (dark ? "rgba(59,130,246,0.16)" : "rgba(15,47,143,0.08)") : "transparent",
                    color: isSelected ? "#ffffff" : textPrimary,
                    boxShadow: isSelected ? "0 4px 10px rgba(15,47,143,0.28)" : "none",
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StartSubInspectionDialog({
  stepKey,
  date,
  onDateChange,
  onCancel,
  onConfirm,
  overlayBox,
  mode = "start",
  dark = false,
}: {
  stepKey: "preShipment" | "loading";
  date: string;
  onDateChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  overlayBox: { top: number; left: number; width: number; height: number };
  mode?: "start" | "continue" | "finish";
  dark?: boolean;
}) {
  const stepLabel = stepKey === "preShipment" ? "Pre-Shipment Inspection" : "Loading Inspection";
  const title = mode === "finish"
    ? `Finish ${stepLabel}`
    : mode === "continue"
      ? `Continue ${stepLabel}`
      : `Start ${stepLabel}`;
  const confirmLabel = mode === "finish" ? "Finish" : mode === "continue" ? "Continue" : "Start";
  const dateLabel = mode === "finish" ? "End Date" : "Date";
  const textPrimary = dark ? "#ffffff" : "#0a1a4a";
  const panelBg = dark ? "#1e293b" : "#ffffff";
  const panelBorder = dark ? "rgba(255,255,255,0.16)" : "rgba(15,47,143,0.18)";
  const secondaryBtn = {
    background: dark ? "rgba(255,255,255,0.08)" : "#ffffff",
    color: textPrimary,
    border: `1.5px solid ${dark ? "rgba(255,255,255,0.22)" : "rgba(15,47,143,0.28)"}`,
  } as const;

  return createPortal(
    <div
      className="z-[70] flex items-center justify-center px-5"
      style={{
        position: "fixed",
        top: overlayBox.top,
        left: overlayBox.left,
        width: overlayBox.width,
        height: overlayBox.height,
      }}
    >
      <button
        type="button"
        className="absolute inset-0 border-0 p-0 cursor-default"
        style={{
          background: dark ? "rgba(2,6,23,0.72)" : "rgba(10,22,70,0.52)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
        aria-label="Close"
        onClick={onCancel}
      />
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl p-5 flex flex-col gap-5 shadow-2xl animate-riseIn"
        style={{ background: panelBg, border: `1px solid ${panelBorder}` }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-inspection-title"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="start-inspection-title" className="text-base font-bold leading-snug" style={{ color: textPrimary }}>
          {title}
        </h2>

        <FormField label={dateLabel} required dark={dark}>
          <CompactBlueDatePicker value={date} onChange={onDateChange} dark={dark} />
        </FormField>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="pressable flex-1 min-h-12 rounded-xl text-sm font-semibold focus:outline-none"
            style={secondaryBtn}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!date}
            className="pressable flex-1 min-h-12 rounded-xl text-sm font-semibold text-white hover:brightness-110 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: GRADIENT, boxShadow: "0 4px 16px rgba(15,47,143,0.35)" }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function InspectionDetailsScreen({ task, progress, onBack, onViewFullInfo, onStartSession, dark = false }: {
  task: InspectionTask;
  progress: InspectionProgress;
  onBack: () => void;
  onViewFullInfo: () => void;
  onStartSession: (key: "preShipment" | "loading", startDate: string, options?: { viewOnly?: boolean }) => void;
  dark?: boolean;
}) {
  const info = getShipmentDetailsData(task);
  const preShipmentDone = progress.preShipment === "completed";
  const [startDialogKey, setStartDialogKey] = useState<"preShipment" | "loading" | null>(null);
  const [startDate, setStartDate] = useState(todayISODate);
  const [overlayBox, setOverlayBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const pageBg = dark
    ? "linear-gradient(165deg, #0b1224 0%, #0f172a 42%, #111827 100%)"
    : undefined;
  const textPrimary = dark ? "#ffffff" : "#0a1a4a";
  const textMuted = dark ? "rgba(255,255,255,0.78)" : FIELD_TEXT_MUTED;
  const cardBg = dark ? "rgba(30, 41, 59, 0.78)" : "#ffffff";
  const cardBorder = dark ? "rgba(255,255,255,0.14)" : "rgba(15,47,143,0.16)";
  const cardBorderActive = dark ? "rgba(96,165,250,0.45)" : "rgba(15,47,143,0.28)";
  const metaBg = dark ? "rgba(255,255,255,0.06)" : "#eef3ff";
  const metaBorder = dark ? "rgba(255,255,255,0.12)" : "rgba(15,47,143,0.14)";
  const nodeBg = dark ? "rgba(15, 23, 42, 0.95)" : "#ffffff";
  const lockedBtnBg = dark ? "rgba(255,255,255,0.08)" : "#e2e8f0";
  const lockedBtnColor = dark ? "rgba(255,255,255,0.55)" : FIELD_TEXT_FAINT;
  const lockedBtnBorder = dark ? "rgba(255,255,255,0.14)" : "rgba(15,47,143,0.16)";
  const timelineLine = dark
    ? "linear-gradient(180deg, rgba(96,165,250,0.45), rgba(96,165,250,0.18))"
    : "linear-gradient(180deg, rgba(15,47,143,0.35), rgba(15,47,143,0.15))";
  const timelineLineGap = dark
    ? "linear-gradient(180deg, rgba(96,165,250,0.18), rgba(96,165,250,0.45))"
    : "linear-gradient(180deg, rgba(15,47,143,0.15), rgba(15,47,143,0.35))";

  const syncOverlayBox = () => {
    const device = document.querySelector(".mobile-device");
    if (device) {
      const r = device.getBoundingClientRect();
      setOverlayBox({ top: r.top, left: r.left, width: r.width, height: r.height });
    } else {
      setOverlayBox({ top: 0, left: 0, width: window.innerWidth, height: window.innerHeight });
    }
  };

  useEffect(() => {
    if (!startDialogKey) return;
    syncOverlayBox();
    const vp = document.querySelector(".mobile-viewport");
    window.addEventListener("resize", syncOverlayBox);
    window.addEventListener("scroll", syncOverlayBox, true);
    vp?.addEventListener("scroll", syncOverlayBox);
    return () => {
      window.removeEventListener("resize", syncOverlayBox);
      window.removeEventListener("scroll", syncOverlayBox, true);
      vp?.removeEventListener("scroll", syncOverlayBox);
    };
  }, [startDialogKey]);

  const openStartDialog = (key: "preShipment" | "loading") => {
    const existing = key === "preShipment"
      ? progress.preShipmentStartDate
      : progress.loadingStartDate;
    setStartDate(existing ?? todayISODate());
    syncOverlayBox();
    setStartDialogKey(key);
  };

  const handleStepAction = (key: "preShipment" | "loading", _isActive: boolean, isDisabled: boolean) => {
    if (isDisabled) return;
    // Completed: open directly in view-only — no start popup, no editing.
    if (progress[key] === "completed") {
      const existing = key === "preShipment"
        ? progress.preShipmentStartDate
        : progress.loadingStartDate;
      onStartSession(key, existing ?? todayISODate(), { viewOnly: true });
      return;
    }
    openStartDialog(key);
  };

  const confirmStart = () => {
    if (!startDialogKey || !startDate) return;
    const key = startDialogKey;
    setStartDialogKey(null);
    onStartSession(key, startDate);
  };

  const swipe = useSwipeBack(onBack);

  return (
    <div
      className={`relative min-h-screen w-full animate-fadeIn ${dark ? "" : "inspection-surface"}`}
      style={{ fontFamily: "'Inter', sans-serif", background: pageBg }}
      {...swipe}
    >
      <AppHeaderBar dark={dark}>
        <div className="flex items-center gap-3">
          <BackCardButton onClick={onBack} dark={dark} />
          <div className="min-w-0">
            <h1 className="text-[18px] font-bold tracking-tight truncate" style={{ color: textPrimary }}>{task.shipment}</h1>
          </div>
        </div>
      </AppHeaderBar>

      <div
        className="w-full max-w-[480px] mx-auto flex flex-col px-4 sm:px-5 pt-5 gap-4"
        style={{ paddingBottom: BOTTOM_NAV_PAD }}
      >

        {/* Inspection Info — read only, tap to view full details */}
        <div className="animate-riseIn" style={{ ["--rise-delay" as string]: "40ms" }}>
          <GradientInfoHeroCard
            icon={<ClipboardList size={17} style={{ color: "#ffffff" }} />}
            title="Inspection Info"
            subtitle={task.border}
            onClick={onViewFullInfo}
            ariaLabel="View full inspection info"
            stats={[
              { label: "Request No.", value: `#${info.referenceNo}` },
              { label: "Concession", value: info.projectSite },
            ]}
          />
        </div>

        <p
          className="mb-2 text-xs font-bold uppercase tracking-wider animate-riseIn"
          style={{ color: textMuted, ["--rise-delay" as string]: "90ms" }}
        >
          Inspection Type
        </p>

        {/* Inspection process — connected timeline (line height auto-matches each card, no overshoot) */}
        <div className="flex flex-col">
          {INSPECTION_STEPS.map((step, idx) => {
            const status = progress[step.key];
            const isDone = status === "completed";
            const isActive = status === "in-progress";
            const isLast = idx === INSPECTION_STEPS.length - 1;
            const isLocked = step.key === "loading" && !preShipmentDone;
            // Completed stays muted but clickable for view/edit; only locked is disabled.
            const isDisabled = isLocked;

            const ctaLabel = isDone
              ? "View"
              : isActive
                ? `Continue ${step.shortLabel}`
                : `Start ${step.shortLabel}`;

            return (
              <div
                key={step.key}
                className="animate-riseIn"
                style={{ ["--rise-delay" as string]: `${140 + idx * 90}ms` }}
              >
                <div className="relative flex gap-4">
                  <div className="flex flex-col items-center flex-shrink-0" style={{ width: 48 }}>
                    <div
                      className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${isActive ? "animate-softPulse" : ""} ${!isLocked && step.key === "loading" ? "animate-unlockPop" : ""}`}
                      style={{
                        background: nodeBg,
                        color: isDone
                          ? (dark ? "#34d399" : "#059669")
                          : isLocked
                            ? (dark ? "rgba(255,255,255,0.55)" : FIELD_TEXT_FAINT)
                            : (dark ? "#93c5fd" : "#0f2f8f"),
                        border: `2px solid ${
                          isDone
                            ? (dark ? "rgba(52,211,153,0.40)" : "rgba(5,150,105,0.35)")
                            : isLocked
                              ? (dark ? "rgba(255,255,255,0.10)" : "rgba(15,47,143,0.12)")
                              : (dark ? "rgba(147,197,253,0.35)" : "rgba(15,47,143,0.18)")
                        }`,
                        boxShadow: isActive
                          ? (dark
                            ? "0 0 0 4px rgba(59,130,246,0.18), 0 0 16px rgba(59,130,246,0.35)"
                            : "0 0 0 4px rgba(15,47,143,0.12), 0 0 16px rgba(15,47,143,0.35)")
                          : (dark ? "0 1px 4px rgba(0,0,0,0.35)" : "0 1px 4px rgba(15,47,143,0.10)"),
                      }}
                    >
                      {isDone ? <CheckCircle2 size={20} /> : isLocked ? <Lock size={18} /> : step.icon}
                    </div>
                    {!isLast && (
                      <div
                        className="w-0.5 flex-1 timeline-connector"
                        style={{
                          background: timelineLine,
                          ["--rise-delay" as string]: `${180 + idx * 90}ms`,
                        }}
                        aria-hidden="true"
                      />
                    )}
                  </div>

                  <div
                    className="flex-1 min-w-0 rounded-2xl p-4 flex flex-col gap-2 transition-shadow duration-300"
                    style={{
                      background: cardBg,
                      border: `1px solid ${isActive ? cardBorderActive : cardBorder}`,
                      boxShadow: isActive
                        ? (dark ? "0 8px 24px rgba(0,0,0,0.35)" : "0 8px 24px rgba(15,47,143,0.12)")
                        : (dark ? "0 1px 4px rgba(0,0,0,0.25)" : "0 1px 4px rgba(15,47,143,0.06)"),
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <h3 className="text-[15px] font-bold" style={{ color: textPrimary }}>
                        {idx + 1}. {step.title}
                      </h3>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: textMuted }}>{step.description}</p>

                    {(() => {
                      const startIso = step.key === "preShipment"
                        ? progress.preShipmentStartDate
                        : progress.loadingStartDate;
                      const endIso = step.key === "preShipment"
                        ? progress.preShipmentEndDate
                        : progress.loadingEndDate;
                      // Fallback dummies until real schedule dates are set.
                      const displayStartIso = startIso ?? todayISODate();
                      const displayEndIso = endIso ?? toISODateLocal(
                        new Date(parseISODateLocal(displayStartIso).getTime() + 2 * 24 * 60 * 60 * 1000),
                      );
                      return (
                        <div
                          className="rounded-xl px-2.5 py-1.5 grid grid-cols-2 gap-2"
                          style={{
                            background: metaBg,
                            border: `1px solid ${metaBorder}`,
                          }}
                        >
                          <div className="min-w-0">
                            <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>
                              Start Date
                            </p>
                            <p className="text-[13px] font-bold mt-0.5 tabular-nums leading-tight" style={{ color: textPrimary }}>
                              {formatDisplayDate(displayStartIso)}
                            </p>
                          </div>
                          <div
                            className="min-w-0 pl-2"
                            style={{ borderLeft: `1px solid ${metaBorder}` }}
                          >
                            <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>
                              End Date
                            </p>
                            <p className="text-[13px] font-bold mt-0.5 tabular-nums leading-tight" style={{ color: textPrimary }}>
                              {formatDisplayDate(displayEndIso)}
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    <div><SubInspectionStatusPill status={status} dark={dark} /></div>

                    <button
                      type="button"
                      onClick={() => handleStepAction(step.key, isActive, isDisabled)}
                      disabled={isDisabled}
                      className="pressable w-full h-12 mt-1 rounded-xl text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 focus:outline-none hover:brightness-110 disabled:hover:brightness-100 disabled:cursor-not-allowed"
                      style={{
                        background: isLocked ? lockedBtnBg : GRADIENT,
                        color: isLocked ? lockedBtnColor : "#ffffff",
                        boxShadow: isLocked ? "none" : "0 4px 16px rgba(15,47,143,0.30)",
                        opacity: isLocked ? 0.55 : 1,
                        border: isLocked ? `1px solid ${lockedBtnBorder}` : "none",
                      }}
                      aria-disabled={isDisabled}
                      aria-label={isDone ? "View completed inspection" : undefined}
                    >
                      {isLocked ? (
                        <><Lock size={15} /> Locked</>
                      ) : isDone ? (
                        <><Eye size={16} strokeWidth={2.25} /> {ctaLabel} <ChevronRight size={16} /></>
                      ) : (
                        <>{ctaLabel} <ChevronRight size={16} /></>
                      )}
                    </button>
                  </div>
                </div>

                {!isLast && (
                  <div className="flex gap-4" aria-hidden="true">
                    <div className="flex justify-center flex-shrink-0" style={{ width: 48 }}>
                      <div
                        className="w-0.5 h-8 timeline-connector"
                        style={{
                          background: timelineLineGap,
                          ["--rise-delay" as string]: `${220 + idx * 90}ms`,
                        }}
                      />
                    </div>
                    <div className="flex-1" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>

      {startDialogKey && overlayBox && (
        <StartSubInspectionDialog
          stepKey={startDialogKey}
          date={startDate}
          onDateChange={setStartDate}
          onCancel={() => setStartDialogKey(null)}
          onConfirm={confirmStart}
          overlayBox={overlayBox}
          dark={dark}
          mode={
            progress[startDialogKey] === "completed" || progress[startDialogKey] === "in-progress"
              ? "continue"
              : "start"
          }
        />
      )}
    </div>
  );
}

// ─── Pre-Shipment Inspection ──────────────────────────────────────────────────

type PreShipmentTab = "verification" | "non-compliance" | "attachments";
type NonComplianceView = "list" | "create";

const PRE_SHIPMENT_VERIFY_STEPS = [
  { id: "physical" as const, label: "Physical verification", hint: "Check volume and capture photos", icon: Scale },
  { id: "sample" as const, label: "Sample verification", hint: "Scan sample QR codes", icon: QrCode },
];

type VerificationStepConfig<T extends string> = {
  id: T;
  label: string;
  hint?: string;
  icon: typeof Scale;
};

function VerificationStepPicker<T extends string>({
  steps,
  activeStep,
  stepComplete,
  onStepSelect,
  allDoneTitle,
  tablistLabel,
}: {
  steps: VerificationStepConfig<T>[];
  activeStep: T;
  stepComplete: boolean[];
  onStepSelect: (step: T) => void;
  allDoneTitle: string;
  tablistLabel: string;
}) {
  const activeIndex = Math.max(0, steps.findIndex(step => step.id === activeStep));
  const allDone = stepComplete.every(Boolean);
  const activeStepConfig = steps[activeIndex];

  return (
    <div
      className="relative overflow-hidden rounded-2xl px-3.5 sm:px-4 py-4 flex flex-col gap-3 animate-riseIn"
      style={{ background: GRADIENT, boxShadow: "0 10px 26px rgba(15,47,143,0.30)", ["--rise-delay" as string]: "60ms" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.00) 58%)" }}
        aria-hidden="true"
      />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.92)" }}>
            {allDone ? "Complete" : "Verification"}
          </p>
          {!allDone && activeStepConfig?.hint && (
            <p className="stepper-choice-hint mt-1">{activeStepConfig.hint}</p>
          )}
          {allDone && (
            <p className="stepper-choice-hint mt-1">{allDoneTitle}</p>
          )}
        </div>
        <span
          className="text-[11px] font-semibold rounded-full px-2.5 py-1 flex-shrink-0 tabular-nums"
          style={{ background: "rgba(255,255,255,0.14)", color: "#ffffff" }}
        >
          {allDone ? `${steps.length}/${steps.length}` : `${activeIndex + 1}/${steps.length}`}
        </span>
      </div>

      <div className="relative z-10 stepper-track" role="tablist" aria-label={tablistLabel}>
        {steps.map((step, i) => {
          const done = stepComplete[i];
          const active = activeIndex === i;
          const switchable = !active;
          const Icon = step.icon;

          return (
            <button
              key={step.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={`${step.label}${done ? ", completed" : active ? ", current" : ", tap to switch"}`}
              onClick={() => onStepSelect(step.id)}
              className={`stepper-choice focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${active ? "stepper-choice--active" : ""} ${done ? "stepper-choice--done" : ""} ${switchable ? "stepper-choice--switch" : ""}`}
            >
              <span className="stepper-choice-head">
                <span className="stepper-choice-icon" aria-hidden="true">
                  {done && !active ? (
                    <CheckCircle2 size={15} strokeWidth={2.25} />
                  ) : (
                    <Icon size={15} strokeWidth={active ? 2.25 : 2} />
                  )}
                </span>
                <span className="stepper-choice-meta">
                  {active ? (
                    <>
                      <span className="stepper-choice-foot-dot" aria-hidden="true" />
                      Current
                    </>
                  ) : (
                    <>
                      {i + 1}
                      <ChevronRight size={12} strokeWidth={2.25} className="stepper-choice-chevron" aria-hidden="true" />
                    </>
                  )}
                </span>
              </span>
              <span className="stepper-choice-label">{step.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PreShipmentVerifyStepper({
  activeStep,
  physicalComplete,
  sampleComplete,
  onStepSelect,
}: {
  activeStep: "physical" | "sample";
  physicalComplete: boolean;
  sampleComplete: boolean;
  onStepSelect: (step: "physical" | "sample") => void;
}) {
  return (
    <VerificationStepPicker
      steps={PRE_SHIPMENT_VERIFY_STEPS}
      activeStep={activeStep}
      stepComplete={[physicalComplete, sampleComplete]}
      onStepSelect={onStepSelect}
      allDoneTitle="Pre-shipment verification complete"
      tablistLabel="Verification steps"
    />
  );
}

const NON_COMPLIANCE_TYPES = [
  "Export License vs Declared Volume",
  "Cargo not prepared for inspection",
  "Incorrect log species declared",
  "Incorrect log grade declared",
  "Less than 95% of cargo declared",
  "Undeclared logs present",
  "Trimming without inspector present",
  "Excess paper trimming (>2%)",
  "Log Specie not on approved price endorsement list",
  "Other",
];

function VerificationFailedDialog({
  overlayBox,
  onDismiss,
  dark = false,
}: {
  overlayBox: { top: number; left: number; width: number; height: number };
  onDismiss: () => void;
  dark?: boolean;
}) {
  const textPrimary = dark ? "#ffffff" : "#0a1a4a";
  const textMuted = dark ? "rgba(255,255,255,0.78)" : FIELD_TEXT_MUTED;
  const panelBg = dark ? "#1e293b" : "#ffffff";
  const panelBorder = dark ? "rgba(255,255,255,0.16)" : "rgba(15,47,143,0.18)";

  return createPortal(
    <div
      className="z-[70] flex items-center justify-center px-5"
      style={{
        position: "fixed",
        top: overlayBox.top,
        left: overlayBox.left,
        width: overlayBox.width,
        height: overlayBox.height,
      }}
    >
      <button
        type="button"
        className="absolute inset-0 border-0 p-0 cursor-default"
        style={{
          background: dark ? "rgba(2,6,23,0.72)" : "rgba(10,22,70,0.52)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
        aria-label="Close"
        onClick={onDismiss}
      />
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl p-5 flex flex-col items-center gap-4 text-center shadow-2xl animate-riseIn"
        style={{ background: panelBg, border: `1px solid ${panelBorder}` }}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="verification-failed-title"
        onClick={e => e.stopPropagation()}
      >
        <span
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(212,24,61,0.10)", color: "#d4183d" }}
        >
          <AlertTriangle size={28} strokeWidth={2.4} />
        </span>
        <h2 id="verification-failed-title" className="text-base font-bold leading-snug" style={{ color: textPrimary }}>
          Verification Could Not Be Completed
        </h2>
        <p className="text-[13px] leading-relaxed" style={{ color: textMuted }}>
          Less than 95% of the declared volume is physically present, so the shipment verification could not be completed. You will be returned to the inspection page.
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="pressable w-full min-h-12 rounded-xl text-sm font-bold text-white focus:outline-none"
          style={{
            background: "linear-gradient(135deg, #e11d48 0%, #be123c 100%)",
            boxShadow: "0 6px 18px rgba(190,18,60,0.28)",
          }}
        >
          Back to Inspection
        </button>
      </div>
    </div>,
    document.body,
  );
}

function PhysicalVerificationScreen({
  task,
  draft,
  onDraftChange,
  onBack,
  onProceed,
  onGoToSample,
  onVerificationFailed,
  viewOnly = false,
  dark = false,
}: {
  task: InspectionTask;
  draft: PhysicalVerificationDraft;
  onDraftChange: (patch: Partial<PhysicalVerificationDraft>) => void;
  onBack: () => void;
  onProceed: () => void;
  onGoToSample: () => void;
  onVerificationFailed: () => void;
  viewOnly?: boolean;
  dark?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<PreShipmentTab>("verification");
  const { volumeOk, photoAdded, nonConformanceReason, physicalStepComplete, sampleStepComplete } = draft;
  const [ncView, setNcView] = useState<NonComplianceView>("list");
  const [selectedNcTypes, setSelectedNcTypes] = useState<string[]>([]);
  const [ncDescription, setNcDescription] = useState("");
  const [evidencePhotos, setEvidencePhotos] = useState<EvidencePhoto[]>([]);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [evidenceSheetOpen, setEvidenceSheetOpen] = useState(false);
  const [photoSheetPurpose, setPhotoSheetPurpose] = useState<"evidence" | "verification">("evidence");
  const photoSheetPurposeRef = useRef<"evidence" | "verification">("evidence");
  const [verificationPhotoPreview, setVerificationPhotoPreview] = useState<string | null>(null);
  const verificationPhotoPreviewRef = useRef<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(!physicalStepComplete);
  const [evidenceSheetBox, setEvidenceSheetBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [failDialogBox, setFailDialogBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [attachments, setAttachments] = useState<AttachmentFile[]>(ATTACHMENT_FILES);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const evidencePhotosRef = useRef(evidencePhotos);
  evidencePhotosRef.current = evidencePhotos;
  photoSheetPurposeRef.current = photoSheetPurpose;

  const syncEvidenceSheetBox = () => {
    const device = document.querySelector(".mobile-device");
    if (device) {
      const r = device.getBoundingClientRect();
      setEvidenceSheetBox({ top: r.top, left: r.left, width: r.width, height: r.height });
    } else {
      setEvidenceSheetBox({ top: 0, left: 0, width: window.innerWidth, height: window.innerHeight });
    }
  };

  useEffect(() => {
    if (!evidenceSheetOpen) return;
    syncEvidenceSheetBox();
    const vp = document.querySelector(".mobile-viewport");
    window.addEventListener("resize", syncEvidenceSheetBox);
    window.addEventListener("scroll", syncEvidenceSheetBox, true);
    vp?.addEventListener("scroll", syncEvidenceSheetBox);
    return () => {
      window.removeEventListener("resize", syncEvidenceSheetBox);
      window.removeEventListener("scroll", syncEvidenceSheetBox, true);
      vp?.removeEventListener("scroll", syncEvidenceSheetBox);
    };
  }, [evidenceSheetOpen]);

  useEffect(() => {
    return () => {
      evidencePhotosRef.current.forEach(photo => URL.revokeObjectURL(photo.previewUrl));
      if (verificationPhotoPreviewRef.current) {
        URL.revokeObjectURL(verificationPhotoPreviewRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setDetailsOpen(!physicalStepComplete);
  }, [physicalStepComplete]);

  const openEvidenceSheet = () => {
    if (viewOnly) return;
    photoSheetPurposeRef.current = "evidence";
    setPhotoSheetPurpose("evidence");
    syncEvidenceSheetBox();
    setEvidenceSheetOpen(true);
  };

  const openVerificationPhotoSheet = () => {
    if (viewOnly || physicalStepComplete) return;
    photoSheetPurposeRef.current = "verification";
    setPhotoSheetPurpose("verification");
    syncEvidenceSheetBox();
    setEvidenceSheetOpen(true);
  };

  const closeEvidenceSheet = () => setEvidenceSheetOpen(false);

  const clearEvidencePhotos = () => {
    setEvidencePhotos(prev => {
      prev.forEach(photo => URL.revokeObjectURL(photo.previewUrl));
      return [];
    });
    setEvidenceError(null);
  };

  const setVerificationPhoto = (previewUrl: string | null) => {
    if (verificationPhotoPreviewRef.current) {
      URL.revokeObjectURL(verificationPhotoPreviewRef.current);
    }
    verificationPhotoPreviewRef.current = previewUrl;
    setVerificationPhotoPreview(previewUrl);
  };

  const handleVerificationPhotoPicked = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    closeEvidenceSheet();
    if (!file) return;

    const ext = file.name.includes(".")
      ? file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase()
      : "";
    const isImage =
      file.type.startsWith("image/") ||
      ACCEPTED_EVIDENCE_EXTS.includes(ext) ||
      ["heic", "heif", "gif", "bmp"].includes(ext) ||
      !file.type;
    if (!isImage || file.size > MAX_ATTACHMENT_BYTES) return;

    setVerificationPhoto(URL.createObjectURL(file));
    onDraftChange({ photoAdded: true });
  };

  const handleEvidencePicked = (event: ChangeEvent<HTMLInputElement>) => {
    if (photoSheetPurposeRef.current === "verification") {
      handleVerificationPhotoPicked(event);
      return;
    }
    const files = event.target.files;
    event.target.value = "";
    closeEvidenceSheet();
    if (!files?.length) return;

    const accepted: EvidencePhoto[] = [];
    let error: string | null = null;

    Array.from(files).forEach(file => {
      const ext = file.name.includes(".")
        ? file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase()
        : "";
      const isImage =
        file.type.startsWith("image/") || ACCEPTED_EVIDENCE_EXTS.includes(ext);
      if (!isImage) {
        error = "Unsupported file type. Choose a JPG, PNG, or WEBP image.";
        return;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        error = `${file.name || "That photo"} is ${formatAttachmentSize(file.size)}. The limit is 10 MB.`;
        return;
      }
      accepted.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name || `Photo ${accepted.length + 1}.jpg`,
        previewUrl: URL.createObjectURL(file),
        size: formatAttachmentSize(file.size),
      });
    });

    if (error) setEvidenceError(error);
    else setEvidenceError(null);
    if (accepted.length) setEvidencePhotos(prev => [...prev, ...accepted]);
  };

  const removeEvidencePhoto = (id: string) => {
    setEvidencePhotos(prev => {
      const target = prev.find(photo => photo.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter(photo => photo.id !== id);
    });
  };

  const handleAttachmentPicked = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so picking the same file twice still fires a change event.
    event.target.value = "";
    if (!file) return;

    const ext = file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase();
    if (!ACCEPTED_ATTACHMENT_EXTS.includes(ext)) {
      setAttachmentError("Unsupported file type. Choose a JPG, PNG, or PDF.");
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachmentError(`That file is ${formatAttachmentSize(file.size)}. The limit is 10 MB.`);
      return;
    }

    setAttachmentError(null);
    setAttachments(prev => [
      ...prev,
      {
        fileName: file.name,
        category: ext === "pdf" ? "DOCUMENT" : "PHOTO",
        uploaded: new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }),
        size: formatAttachmentSize(file.size),
      },
    ]);
  };

  const handleNcTypeToggle = (type: string) => {
    setSelectedNcTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const declaredM3 = task.logs * 21.875;
  const thresholdM3 = declaredM3 * 0.95;
  const declaredAnim = useCountUp(declaredM3, 760, task.id);
  const thresholdAnim = useCountUp(thresholdM3, 820, task.id);

  const formatVol = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const tabs: { id: PreShipmentTab; label: string; short: string }[] = [
    { id: "verification", label: "Verification", short: "Verify" },
    { id: "non-compliance", label: "Non-Compliance", short: "NC" },
    { id: "attachments", label: "Attachments", short: "Files" },
  ];

  const handleBack = () => {
    if (activeTab === "non-compliance" && ncView === "create") {
      setNcView("list");
      return;
    }
    onBack();
  };
  const swipe = useSwipeBack(handleBack);

  const pageBg = dark
    ? "linear-gradient(165deg, #0b1224 0%, #0f172a 42%, #111827 100%)"
    : undefined;
  const textPrimary = dark ? "#ffffff" : "#0a1a4a";
  const textMuted = dark ? "rgba(255,255,255,0.82)" : FIELD_TEXT_MUTED;
  const cardBg = dark ? "rgba(30, 41, 59, 0.78)" : "#ffffff";
  const cardBorder = dark ? "rgba(255,255,255,0.14)" : "rgba(15,47,143,0.16)";
  const cardShadow = dark ? "0 2px 12px rgba(0,0,0,0.28)" : "0 2px 12px rgba(15,47,143,0.06)";
  const chipBg = dark ? "rgba(255,255,255,0.06)" : "#f3f5f9";
  const choiceIdleBg = dark ? "rgba(255,255,255,0.05)" : "#f8fafc";
  const choiceIdleBorder = dark ? "rgba(255,255,255,0.12)" : "rgba(15,47,143,0.14)";
  const choiceIdleText = dark ? "#93c5fd" : "#0f2f8f";
  const checkIdleBg = dark ? "rgba(15,23,42,0.9)" : "#ffffff";
  const fieldBg = dark ? "rgba(15, 23, 42, 0.85)" : "#ffffff";
  const fieldBorder = dark ? "rgba(255,255,255,0.12)" : "rgba(15,47,143,0.16)";
  const dashedBorder = dark ? "rgba(255,255,255,0.16)" : "rgba(15,47,143,0.18)";
  const iconMutedBg = dark ? "rgba(255,255,255,0.08)" : "rgba(15,47,143,0.06)";

  return (
    <div
      className={`h-full-screen w-full flex flex-col overflow-hidden animate-fadeIn ${dark ? "" : "inspection-surface"}`}
      style={{ fontFamily: "'Inter', sans-serif", background: pageBg }}
      {...swipe}
    >
      <AppHeaderBar dark={dark}>
        <div className="flex items-center gap-3 min-w-0">
          <BackCardButton onClick={handleBack} dark={dark} />
          <div className="min-w-0">
            <h1 className="text-[16px] sm:text-[18px] font-bold tracking-tight truncate" style={{ color: textPrimary }}>
              Pre-Shipment Inspection
            </h1>
          </div>
        </div>
      </AppHeaderBar>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
      <div
        className="w-full max-w-[480px] mx-auto flex flex-col px-4 sm:px-5 pt-4 sm:pt-5 gap-4"
        style={{ paddingBottom: BOTTOM_NAV_PAD }}
      >
        {/* Tabs — liquid sliding indicator */}
        <LiquidTabBar
          ariaLabel="Pre-shipment sections"
          dark={dark}
          value={activeTab}
          onChange={id => {
            setActiveTab(id as PreShipmentTab);
            if (id !== "non-compliance") setNcView("list");
          }}
          items={tabs.map(tab => ({
            id: tab.id,
            node: (
              <>
                <span className="sm:hidden truncate block">{tab.short}</span>
                <span className="hidden sm:inline truncate">{tab.label}</span>
              </>
            ),
          }))}
        />

        {activeTab === "verification" && (
        <div key="verification" className="flex flex-col gap-4 animate-panelIn">
        <PreShipmentVerifyStepper
          activeStep="physical"
          physicalComplete={physicalStepComplete}
          sampleComplete={sampleStepComplete}
          onStepSelect={step => {
            if (step === "sample") onGoToSample();
          }}
        />

        {/* Declared volume card */}
        <div
          className="rounded-2xl p-3.5 sm:p-4 flex flex-col gap-4"
          style={{ background: cardBg, border: `1px solid ${cardBorder}`, boxShadow: cardShadow }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: textMuted }}>
            Declared Volume
          </p>
          <div className="flex items-end gap-2 sm:gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[22px] sm:text-[28px] font-bold leading-none tabular-nums break-all" style={{ color: textPrimary }}>
                {formatVol(declaredAnim)}
              </p>
              <p className="text-[11px] sm:text-xs mt-1.5" style={{ color: textMuted }}>m³ declared</p>
            </div>
            <ArrowRight size={18} className="mb-4 sm:mb-5 flex-shrink-0" style={{ color: dark ? "rgba(255,255,255,0.35)" : "#94a3b8" }} />
            <div className="flex-1 min-w-0 text-right">
              <p className="text-[22px] sm:text-[28px] font-bold leading-none tabular-nums break-all" style={{ color: dark ? "#34d399" : "#059669" }}>
                {formatVol(thresholdAnim)}
              </p>
              <p className="text-[11px] sm:text-xs mt-1.5" style={{ color: textMuted }}>m³ threshold (95%)</p>
            </div>
          </div>
          <div
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
            style={{ background: chipBg }}
          >
            <MapPin size={14} className="flex-shrink-0" style={{ color: "#d4183d" }} />
            <p className="text-xs font-medium leading-snug" style={{ color: textPrimary }}>
              {task.location} — {task.exporter}
            </p>
          </div>
        </div>

        {/* Confirmation card */}
        <div
          className="rounded-2xl p-4 flex flex-col gap-4"
          style={{ background: cardBg, border: `1px solid ${cardBorder}`, boxShadow: cardShadow }}
        >
          <div>
            <h2 className="text-[15px] font-bold leading-snug" style={{ color: textPrimary }}>
              Is ≥ 95% of declared volume physically present?
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3.5" role="group" aria-label="Volume confirmation">
            <button
              type="button"
              onClick={() => !viewOnly && !physicalStepComplete && onDraftChange({
                volumeOk: volumeOk === "yes" ? null : "yes",
                physicalStepComplete: false,
              })}
              disabled={viewOnly || physicalStepComplete}
              className={`rounded-2xl min-h-12 px-3.5 py-3.5 flex items-center gap-3 border transition-all duration-200 focus:outline-none pressable ${volumeOk === "yes" ? "animate-selectSpring" : ""} ${viewOnly ? "cursor-default" : ""}`}
              style={{
                background: volumeOk === "yes" ? "rgba(22,163,74,0.10)" : choiceIdleBg,
                borderColor: volumeOk === "yes" ? "rgba(22,163,74,0.55)" : choiceIdleBorder,
                boxShadow: volumeOk === "yes" ? "0 6px 16px rgba(22,163,74,0.20)" : "none",
                opacity: viewOnly ? 0.92 : 1,
              }}
              aria-pressed={volumeOk === "yes"}
            >
              <span
                className={`h-5 w-5 rounded-md border flex items-center justify-center text-[12px] font-black leading-none transition-all duration-200 ${volumeOk === "yes" ? "animate-checkPop" : ""}`}
                style={{
                  background: volumeOk === "yes" ? "#16a34a" : checkIdleBg,
                  borderColor: volumeOk === "yes" ? "#16a34a" : (dark ? "rgba(255,255,255,0.25)" : "rgba(15,47,143,0.25)"),
                  color: "#ffffff",
                }}
              >
                {volumeOk === "yes" ? "✓" : ""}
              </span>
              <span className="text-sm font-bold" style={{ color: volumeOk === "yes" ? (dark ? "#86efac" : "#166534") : choiceIdleText }}>
                Yes
              </span>
            </button>

            <button
              type="button"
              onClick={() => !viewOnly && !physicalStepComplete && onDraftChange({
                volumeOk: volumeOk === "no" ? null : "no",
                physicalStepComplete: false,
              })}
              disabled={viewOnly || physicalStepComplete}
              className={`rounded-2xl min-h-12 px-3.5 py-3.5 flex items-center gap-3 border transition-all duration-200 focus:outline-none pressable ${volumeOk === "no" ? "animate-selectSpring" : ""} ${viewOnly ? "cursor-default" : ""}`}
              style={{
                background: volumeOk === "no" ? "rgba(212,24,61,0.08)" : choiceIdleBg,
                borderColor: volumeOk === "no" ? "rgba(212,24,61,0.45)" : choiceIdleBorder,
                boxShadow: volumeOk === "no" ? "0 6px 16px rgba(212,24,61,0.16)" : "none",
                opacity: viewOnly ? 0.92 : 1,
              }}
              aria-pressed={volumeOk === "no"}
            >
              <span
                className={`h-5 w-5 rounded-md border flex items-center justify-center text-[12px] font-black leading-none transition-all duration-200 ${volumeOk === "no" ? "animate-checkPop" : ""}`}
                style={{
                  background: volumeOk === "no" ? "#d4183d" : checkIdleBg,
                  borderColor: volumeOk === "no" ? "#d4183d" : (dark ? "rgba(255,255,255,0.25)" : "rgba(15,47,143,0.25)"),
                  color: "#ffffff",
                }}
              >
                {volumeOk === "no" ? "✓" : ""}
              </span>
              <span className="text-sm font-bold" style={{ color: volumeOk === "no" ? (dark ? "#fda4af" : "#9f1239") : choiceIdleText }}>
                No
              </span>
            </button>
          </div>

          {/* After submit: only answer shows; reason/photo toggle open/close */}
          {(volumeOk === "yes" || volumeOk === "no") && physicalStepComplete && (
            <button
              type="button"
              onClick={() => setDetailsOpen(o => !o)}
              className="pressable w-full min-h-12 rounded-xl px-3.5 py-3 flex items-center justify-between gap-3 focus:outline-none"
              style={{
                background: dark ? "rgba(255,255,255,0.04)" : "#f5f8ff",
                border: `1px solid ${cardBorder}`,
              }}
              aria-expanded={detailsOpen}
            >
              <span className="text-[12px] font-semibold" style={{ color: textPrimary }}>
                Reason & photo
              </span>
              <ChevronDown
                size={16}
                style={{
                  color: textMuted,
                  transform: detailsOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                }}
              />
            </button>
          )}

          {(volumeOk === "yes" || volumeOk === "no") && (!physicalStepComplete || detailsOpen) && (
            <div
              className="rounded-2xl p-3.5 flex flex-col gap-3"
              style={{
                background: volumeOk === "no" ? "#fff6f8" : "rgba(22,163,74,0.08)",
                border: volumeOk === "no" ? "1px solid rgba(212,24,61,0.20)" : "1px solid rgba(22,163,74,0.28)",
              }}
            >
              <div>
                <p
                  className="text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: volumeOk === "no" ? "#9f1239" : "#166534" }}
                >
                  Reason
                </p>
                <textarea
                  value={nonConformanceReason}
                  onChange={e => {
                    if (viewOnly || physicalStepComplete) return;
                    onDraftChange({ nonConformanceReason: e.target.value });
                  }}
                  rows={3}
                  placeholder={viewOnly ? "No reason recorded" : "Enter reason"}
                  readOnly={viewOnly || physicalStepComplete}
                  className="w-full mt-2 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none"
                  style={{
                    background: fieldBg,
                    border: volumeOk === "no" ? "1px solid rgba(212,24,61,0.25)" : "1px solid rgba(22,163,74,0.30)",
                    color: textPrimary,
                    cursor: viewOnly || physicalStepComplete ? "default" : undefined,
                  }}
                />
              </div>

              <div>
                <p
                  className="text-[11px] font-semibold uppercase tracking-wider mb-2"
                  style={{ color: volumeOk === "no" ? "#9f1239" : "#166534" }}
                >
                  Add Photo
                </p>
                <button
                  type="button"
                  onClick={openVerificationPhotoSheet}
                  disabled={viewOnly || physicalStepComplete}
                  className="w-full rounded-xl px-3 py-3.5 flex flex-col items-center justify-center gap-1.5 focus:outline-none active:scale-[0.99] transition-all disabled:active:scale-100 overflow-hidden"
                  style={{
                    background: photoAdded ? "rgba(22,163,74,0.10)" : "#ffffff",
                    border: photoAdded
                      ? "2px dashed rgba(22,163,74,0.45)"
                      : volumeOk === "no"
                        ? "2px dashed rgba(212,24,61,0.28)"
                        : "2px dashed rgba(22,163,74,0.32)",
                    opacity: viewOnly || physicalStepComplete ? 0.9 : 1,
                    cursor: viewOnly || physicalStepComplete ? "default" : undefined,
                  }}
                >
                  {verificationPhotoPreview ? (
                    <img
                      src={verificationPhotoPreview}
                      alt="Attached"
                      className="w-full max-h-36 object-cover rounded-lg"
                    />
                  ) : (
                    <span
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{
                        background: photoAdded
                          ? "rgba(22,163,74,0.16)"
                          : volumeOk === "no"
                            ? "rgba(212,24,61,0.10)"
                            : "rgba(22,163,74,0.12)",
                        color: photoAdded ? "#16a34a" : volumeOk === "no" ? "#d4183d" : "#166534",
                      }}
                    >
                      <Camera size={18} />
                    </span>
                  )}
                  <span
                    className="text-[12px] font-bold"
                    style={{ color: photoAdded ? "#166534" : volumeOk === "no" ? "#9f1239" : "#0a1a4a" }}
                  >
                    {photoAdded ? "Photo attached" : viewOnly || physicalStepComplete ? "No photo" : "Add Photo"}
                  </span>
                  <span
                    className="text-[10px] font-medium text-center leading-snug"
                    style={{ color: "#5a6a99" }}
                  >
                    {viewOnly || physicalStepComplete
                      ? (photoAdded ? "Photo saved with response" : "No photo attached")
                      : photoAdded
                        ? "Tap to change photo"
                        : "Take photo or upload from gallery"}
                  </span>
                </button>
              </div>

              {!viewOnly && !physicalStepComplete && (
                <button
                  type="button"
                  onClick={() => {
                    if (!nonConformanceReason.trim()) return;
                    onDraftChange({ physicalStepComplete: true });
                    if (volumeOk === "no") {
                      const device = document.querySelector(".mobile-device");
                      if (device) {
                        const r = device.getBoundingClientRect();
                        setFailDialogBox({ top: r.top, left: r.left, width: r.width, height: r.height });
                      } else {
                        setFailDialogBox({ top: 0, left: 0, width: window.innerWidth, height: window.innerHeight });
                      }
                    }
                  }}
                  disabled={!nonConformanceReason.trim()}
                  className="pressable w-full min-h-12 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 focus:outline-none disabled:opacity-45 disabled:cursor-not-allowed"
                  style={{
                    background: volumeOk === "no"
                      ? "linear-gradient(135deg, #e11d48 0%, #be123c 100%)"
                      : "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                    boxShadow: !nonConformanceReason.trim()
                      ? "none"
                      : volumeOk === "no"
                        ? "0 6px 18px rgba(190,18,60,0.28)"
                        : "0 6px 18px rgba(22,163,74,0.30)",
                  }}
                >
                  Submit
                </button>
              )}

              {!viewOnly && physicalStepComplete && (
                <button
                  type="button"
                  onClick={() => onDraftChange({ physicalStepComplete: false })}
                  className="self-start text-[12px] font-semibold focus:outline-none"
                  style={{ color: dark ? "#93c5fd" : "#0f2f8f" }}
                >
                  Edit response
                </button>
              )}
            </div>
          )}
        </div>

        {failDialogBox && (
          <VerificationFailedDialog
            overlayBox={failDialogBox}
            dark={dark}
            onDismiss={() => {
              setFailDialogBox(null);
              onVerificationFailed();
            }}
          />
        )}

        {!viewOnly && physicalStepComplete && (
          <button
            type="button"
            onClick={onProceed}
            className="w-full min-h-[48px] rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 focus:outline-none active:scale-[0.98] transition-all animate-riseIn"
            style={{ background: GRADIENT, boxShadow: "0 6px 18px rgba(15,47,143,0.30)" }}
          >
            Next: Sample Verification
            <ChevronRight size={16} />
          </button>
        )}

        {viewOnly && (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 min-w-0 h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2 focus:outline-none active:scale-[0.98]"
              style={{
                background: dark ? "rgba(30, 41, 59, 0.78)" : "#ffffff",
                color: textPrimary,
                border: `1px solid ${dark ? "rgba(255,255,255,0.12)" : "rgba(15,47,143,0.14)"}`,
                boxShadow: dark ? "none" : "0 2px 8px rgba(15,47,143,0.06)",
              }}
            >
              Close
            </button>
            <button
              type="button"
              onClick={onGoToSample}
              className="flex-1 min-w-0 h-12 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-1.5 focus:outline-none active:scale-[0.98] transition-all"
              style={{ background: GRADIENT, boxShadow: "0 6px 18px rgba(15,47,143,0.30)" }}
            >
              <span className="truncate">View Sample</span>
              <ChevronRight size={16} className="flex-shrink-0" />
            </button>
          </div>
        )}
        </div>
        )}

        {activeTab === "non-compliance" && ncView === "list" && (
          <div className="flex flex-col gap-4 animate-panelIn">
            {!viewOnly && (
            <button
              type="button"
              onClick={() => setNcView("create")}
              className="pressable w-full min-h-12 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 focus:outline-none"
              style={{ background: GRADIENT, boxShadow: "0 4px 14px rgba(15,47,143,0.28)" }}
            >
              <Plus size={16} />
              New Notice of Discrepancy
            </button>
            )}

            <div
              className="rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-2"
              style={{
                background: cardBg,
                border: `2px dashed ${dashedBorder}`,
                boxShadow: cardShadow,
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-1"
                style={{ background: iconMutedBg, color: dark ? "rgba(255,255,255,0.45)" : "#94a3b8" }}
              >
                <ClipboardList size={22} />
              </div>
              <p className="text-[12px] font-medium" style={{ color: dark ? "rgba(255,255,255,0.70)" : FIELD_TEXT_FAINT }}>
                No Notices of Discrepancy filed yet.
              </p>
            </div>
          </div>
        )}

        {activeTab === "non-compliance" && ncView === "create" && (
          <div className="flex flex-col gap-4 animate-panelIn">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-bold" style={{ color: textPrimary }}>
                Non-Compliance Description <span style={{ color: "#d4183d" }}>*</span>
              </label>
              <textarea
                rows={4}
                value={ncDescription}
                onChange={e => setNcDescription(e.target.value)}
                placeholder="Describe the discrepancy observed..."
                className="w-full p-3 text-[12px] rounded-xl focus:outline-none resize-none"
                style={{
                  background: fieldBg,
                  border: `1px solid ${fieldBorder}`,
                  color: textPrimary,
                  boxShadow: cardShadow,
                }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>
                Type of Non-Compliance
              </label>
              <div
                className="rounded-2xl overflow-hidden flex flex-col"
                style={{
                  background: cardBg,
                  border: `1px solid ${cardBorder}`,
                  boxShadow: cardShadow,
                }}
              >
                <div className="px-3.5 pt-3 pb-2">
                  <p className="text-[13px] font-bold" style={{ color: textPrimary }}>
                    Non-Compliance Records
                  </p>
                </div>

                <div className="px-3 pb-3 flex flex-col gap-2 max-h-56 overflow-y-auto overscroll-contain">
                  {NON_COMPLIANCE_TYPES.map(type => {
                    const checked = selectedNcTypes.includes(type);
                    return (
                      <label
                        key={type}
                        className="flex items-center gap-3 cursor-pointer rounded-full px-3 py-2.5 transition-all active:scale-[0.99]"
                        style={{
                          background: checked
                            ? (dark ? "rgba(59,130,246,0.16)" : "rgba(15,47,143,0.06)")
                            : (dark ? "rgba(255,255,255,0.03)" : "#ffffff"),
                          border: checked
                            ? (dark ? "1.5px solid rgba(96,165,250,0.45)" : "1.5px solid rgba(15,47,143,0.35)")
                            : (dark ? "1.5px solid rgba(255,255,255,0.10)" : "1.5px solid rgba(15,47,143,0.12)"),
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleNcTypeToggle(type)}
                          className="w-4 h-4 flex-shrink-0 rounded accent-[#0f2f8f]"
                        />
                        <span className="text-[14px] font-medium leading-snug" style={{ color: textPrimary }}>
                          {type}
                        </span>
                      </label>
                    );
                  })}
                </div>

                <div
                  className="px-3.5 py-2.5"
                  style={{
                    background: dark ? "rgba(255,255,255,0.04)" : "rgba(15,47,143,0.05)",
                    borderTop: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(15,47,143,0.08)"}`,
                  }}
                >
                  <p className="text-[12px] font-semibold" style={{ color: textMuted }}>
                    Summary:{" "}
                    <span style={{ color: dark ? "#93c5fd" : "#0f2f8f" }}>
                      {selectedNcTypes.length} selected
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>
                Evidence Photos
              </p>

              <button
                type="button"
                onClick={openEvidenceSheet}
                className="rounded-2xl px-4 py-5 flex flex-col items-center justify-center gap-2 focus:outline-none active:scale-[0.99] transition-all"
                style={{
                  background: cardBg,
                  border: `2px dashed ${dashedBorder}`,
                  boxShadow: cardShadow,
                }}
              >
                <span
                  className="w-11 h-11 rounded-2xl flex items-center justify-center"
                  style={{ background: iconMutedBg, color: dark ? "#93c5fd" : "#0f2f8f" }}
                >
                  <Camera size={20} />
                </span>
                <span className="text-[13px] font-bold" style={{ color: textPrimary }}>
                  Add Evidence Photo
                </span>
                <span className="text-[11px] font-medium text-center" style={{ color: textMuted }}>
                  Take a photo or upload from gallery
                </span>
              </button>

              {evidenceError && (
                <p className="text-[11px] font-medium px-0.5" style={{ color: "#d4183d" }} role="alert">
                  {evidenceError}
                </p>
              )}

              {evidencePhotos.length > 0 && (
                <div className="flex flex-col gap-2 animate-riseIn">
                  <div className="flex items-center justify-between px-0.5">
                    <p className="text-[11px] font-semibold" style={{ color: textMuted }}>
                      {evidencePhotos.length} photo{evidencePhotos.length === 1 ? "" : "s"} attached
                    </p>
                    <button
                      type="button"
                      onClick={clearEvidencePhotos}
                      className="text-[11px] font-semibold focus:outline-none active:opacity-70"
                      style={{ color: "#0f2f8f" }}
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {evidencePhotos.map((photo, i) => (
                      <div
                        key={photo.id}
                        className="relative aspect-square rounded-xl overflow-hidden animate-riseIn"
                        style={{
                          ["--rise-delay" as string]: `${40 + i * 40}ms`,
                          background: "#ffffff",
                          border: "1px solid rgba(15,47,143,0.12)",
                          boxShadow: "0 2px 8px rgba(15,47,143,0.06)",
                        }}
                      >
                        <img
                          src={photo.previewUrl}
                          alt={photo.name}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeEvidencePhoto(photo.id)}
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center focus:outline-none active:scale-95"
                          style={{
                            background: "rgba(10,26,74,0.72)",
                            color: "#ffffff",
                            backdropFilter: "blur(6px)",
                          }}
                          aria-label={`Remove ${photo.name}`}
                        >
                          <X size={12} strokeWidth={2.5} />
                        </button>
                        <div
                          className="absolute inset-x-0 bottom-0 px-1.5 py-1"
                          style={{ background: "linear-gradient(180deg, transparent, rgba(10,26,74,0.72))" }}
                        >
                          <p className="text-[9px] font-medium text-white truncate">{photo.size}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setNcView("list");
                setNcDescription("");
                setSelectedNcTypes([]);
                clearEvidencePhotos();
              }}
              className="w-full h-12 rounded-xl text-[12px] font-bold uppercase tracking-wider text-white flex items-center justify-center focus:outline-none active:scale-[0.98]"
              style={{ background: GRADIENT, boxShadow: "0 4px 14px rgba(15,47,143,0.28)" }}
            >
              Submit Notice of Discrepancy
            </button>
          </div>
        )}

        {activeTab === "attachments" && (
          <div className="flex flex-col gap-4 animate-panelIn">
            <input
              ref={attachmentInputRef}
              type="file"
              accept={ACCEPTED_ATTACHMENT_MIME}
              onChange={handleAttachmentPicked}
              className="hidden"
            />

            {!viewOnly && (
            <button
              type="button"
              onClick={() => attachmentInputRef.current?.click()}
              className="rounded-2xl p-6 flex flex-col items-center justify-center gap-2 focus:outline-none active:scale-[0.99] transition-all"
              style={{
                background: cardBg,
                border: `2px dashed ${dashedBorder}`,
                boxShadow: cardShadow,
              }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: iconMutedBg, color: textMuted }}
              >
                <Upload size={18} />
              </div>
              <p className="text-[12px] font-bold" style={{ color: textPrimary }}>+ Add Photo or Document</p>
              <p className="text-[10px]" style={{ color: dark ? "rgba(255,255,255,0.70)" : FIELD_TEXT_FAINT }}>JPG, PNG, or PDF up to 10MB</p>
            </button>
            )}

            {attachmentError && (
              <p
                role="alert"
                className="text-[11px] font-semibold rounded-xl px-3 py-2.5"
                style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid rgba(220,38,38,0.18)" }}
              >
                {attachmentError}
              </p>
            )}

            {attachments.map((file, i) => (
              <AttachmentFileCard
                key={`${file.fileName}-${i}`}
                file={file}
                index={i}
                dark={dark}
                onDelete={viewOnly ? undefined : () => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
              />
            ))}
          </div>
        )}
      </div>
      </div>

      {evidenceSheetOpen && evidenceSheetBox && createPortal(
        <div
          className="z-[60] flex flex-col justify-end"
          style={{
            position: "fixed",
            top: evidenceSheetBox.top,
            left: evidenceSheetBox.left,
            width: evidenceSheetBox.width,
            height: evidenceSheetBox.height,
          }}
        >
          <button
            type="button"
            className="absolute inset-0 border-0 p-0 cursor-default"
            style={{
              background: dark ? "rgba(2,6,23,0.62)" : "rgba(10,22,70,0.45)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
            aria-label="Close"
            onClick={closeEvidenceSheet}
          />
          <div
            className="relative z-10 w-full rounded-t-[28px] px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col gap-5 animate-sheetUp"
            style={{
              background: dark ? "#1e293b" : "#ffffff",
              boxShadow: dark ? "0 -12px 40px rgba(0,0,0,0.45)" : "0 -12px 40px rgba(15,47,143,0.18)",
            }}
            role="dialog"
            aria-modal="true"
            aria-label={photoSheetPurpose === "verification" ? "Add photo" : "Add evidence photo"}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-1 rounded-full" style={{ background: dark ? "rgba(255,255,255,0.20)" : "rgba(15,47,143,0.18)" }} />
              <div className="w-full flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: textMuted }}>
                  {photoSheetPurpose === "verification" ? "Add Photo" : "Add Evidence Photo"}
                </p>
                <button
                  type="button"
                  onClick={closeEvidenceSheet}
                  className="field-touch w-12 h-12 rounded-xl flex items-center justify-center focus:outline-none"
                  style={{ background: iconMutedBg, color: dark ? "#93c5fd" : "#0f2f8f" }}
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: textMuted }}>
                Source
              </p>
              {/* Label + capture input keeps the tap in the same user gesture so mobile OS opens the camera. */}
              <label
                className="w-full h-12 rounded-2xl px-4 flex items-center gap-3 text-left focus-within:outline-none active:scale-[0.99] transition-all cursor-pointer"
                style={{
                  background: dark ? "rgba(15,23,42,0.85)" : "#ffffff",
                  border: `1.5px solid ${dark ? "rgba(255,255,255,0.12)" : "rgba(15,47,143,0.12)"}`,
                  boxShadow: dark ? "none" : "0 2px 10px rgba(15,47,143,0.04)",
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleEvidencePicked}
                  className="sr-only"
                />
                <span
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: iconMutedBg, color: dark ? "#93c5fd" : "#0f2f8f" }}
                >
                  <Camera size={16} />
                </span>
                <span className="flex-1 min-w-0 text-sm font-semibold" style={{ color: textPrimary }}>
                  Take Photo
                </span>
                <ChevronRight size={16} style={{ color: textMuted }} />
              </label>
              <label
                className="w-full h-12 rounded-2xl px-4 flex items-center gap-3 text-left focus-within:outline-none active:scale-[0.99] transition-all cursor-pointer"
                style={{
                  background: dark ? "rgba(15,23,42,0.85)" : "#ffffff",
                  border: `1.5px solid ${dark ? "rgba(255,255,255,0.12)" : "rgba(15,47,143,0.12)"}`,
                  boxShadow: dark ? "none" : "0 2px 10px rgba(15,47,143,0.04)",
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  multiple={photoSheetPurpose === "evidence"}
                  onChange={handleEvidencePicked}
                  className="sr-only"
                />
                <span
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: iconMutedBg, color: dark ? "#93c5fd" : "#0f2f8f" }}
                >
                  <ImageIcon size={16} />
                </span>
                <span className="flex-1 min-w-0 text-sm font-semibold" style={{ color: textPrimary }}>
                  Upload from Gallery
                </span>
                <ChevronRight size={16} style={{ color: textMuted }} />
              </label>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

// ─── Sample Verification ──────────────────────────────────────────────────────

type ScanStatus = "verified" | "flagged";

interface ScannedSampleLog {
  code: string;
  scannedAt: string;
  status: ScanStatus;
  log: RegisterLogFormData;
  /** Declared / previously recorded values used for the verification diff. */
  previous: RegisterLogFormData;
  /** Inspector values captured during verification (shown again on edit). */
  inspectorMeasurements?: MeasurementValues;
  inspectorComment?: string;
}

const SCAN_STATUS_META: Record<ScanStatus, { label: string; bg: string; color: string }> = {
  verified: { label: "Verified", bg: "rgba(5,150,105,0.16)", color: "#047857" },
  flagged: { label: "Flagged", bg: "rgba(180,83,9,0.18)", color: "#92400e" },
};

/** Mock QR payloads the simulated scanner cycles through, one per successful scan. */
const SAMPLE_QR_POOL: { code: string; status: ScanStatus; log: RegisterLogFormData; previous: RegisterLogFormData }[] = [
  {
    code: "SSC-QR-0000000014",
    status: "verified",
    log: {
      serialNo: "0000000014", regDate: "2026-07-12", productGroup: "Group 1", productType: "Saw/Veneer", productName: "Taun",
      lotNumber: "LOT-2026-042", length: "10.4", diameter: "11.6",
      diameter1: "11.6", diameter2: "11.4", diameter3: "11.2", diameter4: "11.0",
      volume: "12.4", defectVolume: "0.8",
      note: "Sample drawn from stack A — bark intact, no visible defects.", status: "AVAILABLE",
    },
    previous: {
      serialNo: "0000000014", regDate: "2026-07-12", productGroup: "Group 1", productType: "Saw/Veneer", productName: "Taun",
      lotNumber: "LOT-2026-042", length: "10.0", diameter: "11.0",
      diameter1: "11.0", diameter2: "10.8", diameter3: "10.6", diameter4: "10.5",
      volume: "12.0", defectVolume: "1.2",
      note: "Declared by exporter — pending sample verification.", status: "AVAILABLE",
    },
  },
  {
    code: "SSC-QR-0000000027",
    status: "flagged",
    log: {
      serialNo: "0000000027", regDate: "2026-07-12", productGroup: "Group 1", productType: "Round Log", productName: "Kwila",
      lotNumber: "LOT-2026-042", length: "9.8", diameter: "13.2",
      diameter1: "13.2", diameter2: "13.0", diameter3: "12.8", diameter4: "12.6",
      volume: "13.9", defectVolume: "1.4",
      note: "Minor end split recorded during sample verification.", status: "AVAILABLE",
    },
    previous: {
      serialNo: "0000000027", regDate: "2026-07-12", productGroup: "Group 1", productType: "Round Log", productName: "Kwila",
      lotNumber: "LOT-2026-040", length: "9.8", diameter: "12.5",
      diameter1: "12.5", diameter2: "12.4", diameter3: "12.2", diameter4: "12.0",
      volume: "13.0", defectVolume: "0.9",
      note: "Exporter declared dimensions.", status: "AVAILABLE",
    },
  },
  {
    code: "SSC-QR-0000000031",
    status: "verified",
    log: {
      serialNo: "0000000031", regDate: "2026-07-13", productGroup: "Group 2", productType: "Sawn Timber", productName: "Erima",
      lotNumber: "LOT-2026-043", length: "11.2", diameter: "10.4",
      diameter1: "10.4", diameter2: "10.4", diameter3: "10.2", diameter4: "10.2",
      volume: "11.6", defectVolume: "0.5",
      note: "Dimensions match the declared manifest entry.", status: "AVAILABLE",
    },
    previous: {
      serialNo: "0000000031", regDate: "2026-07-13", productGroup: "Group 2", productType: "Sawn Timber", productName: "Erima",
      lotNumber: "LOT-2026-043", length: "11.0", diameter: "10.4",
      diameter1: "10.4", diameter2: "10.3", diameter3: "10.2", diameter4: "10.1",
      volume: "11.2", defectVolume: "0.5",
      note: "Dimensions match the declared manifest entry.", status: "AVAILABLE",
    },
  },
  {
    code: "SSC-QR-0000000045",
    status: "verified",
    log: {
      serialNo: "0000000045", regDate: "2026-07-13", productGroup: "Group 2", productType: "Flitch", productName: "Calophyllum",
      lotNumber: "LOT-2026-043", length: "10.0", diameter: "12.0",
      diameter1: "12.0", diameter2: "11.8", diameter3: "11.6", diameter4: "11.5",
      volume: "12.8", defectVolume: "1.1",
      note: "Sample verified against exporter declared log details.", status: "AVAILABLE",
    },
    previous: {
      serialNo: "0000000045", regDate: "2026-07-10", productGroup: "Group 2", productType: "Flitch", productName: "Calophyllum",
      lotNumber: "LOT-2026-043", length: "10.0", diameter: "12.0",
      diameter1: "12.0", diameter2: "11.9", diameter3: "11.7", diameter4: "11.6",
      volume: "12.0", defectVolume: "1.1",
      note: "Awaiting physical sample check.", status: "PENDING",
    },
  },
];

type LogCompareField = {
  key: keyof RegisterLogFormData;
  label: string;
  unit?: string;
};

const LOG_COMPARE_FIELDS: LogCompareField[] = [
  { key: "serialNo", label: "Serial No" },
  { key: "regDate", label: "Reg Date" },
  { key: "productGroup", label: "Product Group" },
  { key: "productType", label: "Product Type" },
  { key: "productName", label: "Product Name" },
  { key: "lotNumber", label: "Lot Number" },
  { key: "diameter", label: "Avg.diamete", unit: "cm" },
  { key: "length", label: "Length", unit: "m" },
  { key: "diameter1", label: "D1", unit: "cm" },
  { key: "diameter2", label: "D2", unit: "cm" },
  { key: "diameter3", label: "D3", unit: "cm" },
  { key: "diameter4", label: "D4", unit: "cm" },
  { key: "volume", label: "Volume", unit: "m³" },
  { key: "defectVolume", label: "Defect Volume", unit: "m³" },
  { key: "note", label: "Note" },
  { key: "status", label: "Status" },
];

function formatCompareValue(field: LogCompareField, value: string) {
  if (!value) return "—";
  if (field.key === "regDate" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${m}/${d}/${y}`;
  }
  return field.unit ? `${value} ${field.unit}` : value;
}

function getChangedLogFields(previous: RegisterLogFormData, current: RegisterLogFormData) {
  return LOG_COMPARE_FIELDS.filter(field => previous[field.key] !== current[field.key]);
}

function formatScanTime(d: Date) {
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

type ScannerPhase = "idle" | "scanning" | "detected";
type ScanToastTone = "duplicate" | "success" | "info";
interface ScanToast {
  message: string;
  tone: ScanToastTone;
}

/** Mock capture timings — kept short so tap-to-scan feels production-responsive. */
const SCAN_DETECT_MS = 420;
const SCAN_CONFIRM_MS = 360;
const SCAN_TOAST_MS = 2600;
const SCAN_DUPLICATE_TOAST_MS = 4800;

const CORNER_BRACKETS = [
  { key: "tl", className: "top-0 left-0 border-t-[3px] border-l-[3px]", radius: "14px 0 0 0" },
  { key: "tr", className: "top-0 right-0 border-t-[3px] border-r-[3px]", radius: "0 14px 0 0" },
  { key: "bl", className: "bottom-0 left-0 border-b-[3px] border-l-[3px]", radius: "0 0 0 14px" },
  { key: "br", className: "bottom-0 right-0 border-b-[3px] border-r-[3px]", radius: "0 0 14px 0" },
];

/** Shared QR capture frame — tap-to-scan shutter lives inside the viewfinder. */
function QrTapViewfinder({
  phase,
  dark = false,
  viewOnly = false,
  disabled = false,
  danger = false,
  detectedLabel,
  idleHint = "Ready when you are",
  scanningHint = "Hold steady over the log QR",
  onToggleScan,
}: {
  phase: ScannerPhase;
  dark?: boolean;
  viewOnly?: boolean;
  disabled?: boolean;
  danger?: boolean;
  detectedLabel?: string;
  idleHint?: string;
  scanningHint?: string;
  onToggleScan: () => void;
}) {
  const detected = phase === "detected";
  const scanning = phase === "scanning";
  const locked = viewOnly || disabled || detected;
  const frameColor = detected
    ? (danger ? "#d4183d" : "#16a34a")
    : scanning
      ? (dark ? "#93c5fd" : "#0f2f8f")
      : (dark ? "rgba(255,255,255,0.28)" : "#c3cee6");
  const textMuted = dark ? "rgba(255,255,255,0.82)" : FIELD_TEXT_MUTED;

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div
        className="relative flex items-center justify-center"
        style={{ width: "min(280px, 78vw)", aspectRatio: "1 / 1" }}
      >
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            inset: "-18%",
            background: detected
              ? danger
                ? "radial-gradient(circle, rgba(212,24,61,0.18) 0%, transparent 68%)"
                : "radial-gradient(circle, rgba(22,163,74,0.18) 0%, transparent 68%)"
              : scanning
                ? (dark
                  ? "radial-gradient(circle, rgba(59,130,246,0.22) 0%, transparent 68%)"
                  : "radial-gradient(circle, rgba(26,69,181,0.16) 0%, transparent 68%)")
                : (dark
                  ? "radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 68%)"
                  : "radial-gradient(circle, rgba(15,47,143,0.08) 0%, transparent 68%)"),
            transition: "background 0.35s ease",
          }}
          aria-hidden="true"
        />

        {detected && (
          <div
            className={`detect-success-ring${danger ? " detect-success-ring-danger" : ""}`}
            aria-hidden="true"
          />
        )}

        <button
          type="button"
          disabled={locked && !scanning}
          onClick={() => {
            if (viewOnly || disabled || detected) return;
            onToggleScan();
          }}
          className="absolute inset-0 rounded-[1.75rem] overflow-hidden transition-all duration-300 focus:outline-none disabled:cursor-default pressable"
          style={{
            background: dark ? "rgba(30, 41, 59, 0.55)" : "rgba(255,255,255,0.28)",
            border: `1px solid ${detected
              ? (danger ? "rgba(212,24,61,0.40)" : "rgba(22,163,74,0.40)")
              : scanning
                ? (dark ? "rgba(147,197,253,0.35)" : "rgba(15,47,143,0.28)")
                : (dark ? "rgba(255,255,255,0.12)" : "rgba(15,47,143,0.12)")}`,
            boxShadow: detected
              ? danger
                ? "0 12px 36px rgba(212,24,61,0.18)"
                : "0 12px 36px rgba(22,163,74,0.18)"
              : (dark ? "0 12px 36px rgba(0,0,0,0.35)" : "0 12px 36px rgba(15,47,143,0.10)"),
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
          aria-label={
            viewOnly
              ? "Scanner view only"
              : scanning
                ? "Cancel scan"
                : detected
                  ? "QR captured"
                  : "Start scanning"
          }
        >
          <img
            src={qrCode}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-contain p-9 transition-opacity duration-300 pointer-events-none"
            style={{ opacity: detected ? 0.92 : scanning ? 0.34 : 0.14 }}
          />

          {scanning && (
            <div
              className="absolute left-0 right-0 h-[2px] animate-qrSweep pointer-events-none"
              style={{
                background: "linear-gradient(90deg, rgba(26,69,181,0) 0%, #1a45b5 50%, rgba(26,69,181,0) 100%)",
                boxShadow: "0 0 12px rgba(26,69,181,0.65)",
              }}
              aria-hidden="true"
            />
          )}

          {detected && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ background: dark ? "rgba(15,23,42,0.55)" : "rgba(240,244,255,0.55)" }}
            >
              <span
                className="w-16 h-16 rounded-full flex items-center justify-center animate-checkPop"
                style={{
                  background: danger ? "#d4183d" : "#16a34a",
                  boxShadow: danger
                    ? "0 10px 28px rgba(212,24,61,0.48), 0 0 0 4px rgba(255,255,255,0.55)"
                    : "0 10px 28px rgba(22,163,74,0.48), 0 0 0 4px rgba(255,255,255,0.55)",
                }}
              >
                {danger
                  ? <AlertTriangle size={30} strokeWidth={2.5} style={{ color: "#ffffff" }} />
                  : <CheckCircle2 size={32} strokeWidth={2.5} style={{ color: "#ffffff" }} />}
              </span>
            </div>
          )}

          {phase === "idle" && !viewOnly && !disabled && (
            <span
              className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 pb-5 pt-10 pointer-events-none"
              style={{
                background: dark
                  ? "linear-gradient(180deg, transparent 0%, rgba(15,23,42,0.72) 70%)"
                  : "linear-gradient(180deg, transparent 0%, rgba(10,26,74,0.55) 70%)",
              }}
            >
              <span
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{
                  background: GRADIENT,
                  boxShadow: "0 8px 24px rgba(15,47,143,0.40), inset 0 0 0 3px rgba(255,255,255,0.22)",
                }}
              >
                <ScanLine size={22} style={{ color: "#ffffff" }} />
              </span>
              <span className="text-[12px] font-bold tracking-wide" style={{ color: "#ffffff" }}>
                Tap to scan
              </span>
            </span>
          )}

          {phase === "idle" && (viewOnly || disabled) && (
            <span
              className="absolute inset-x-0 bottom-0 flex justify-center pb-5 pt-10 pointer-events-none"
              style={{
                background: dark
                  ? "linear-gradient(180deg, transparent 0%, rgba(15,23,42,0.72) 70%)"
                  : "linear-gradient(180deg, transparent 0%, rgba(10,26,74,0.45) 70%)",
              }}
            >
              <span className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
                {viewOnly ? "View only" : "Waiting…"}
              </span>
            </span>
          )}

          {scanning && (
            <span
              className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-1.5 pb-4 pt-8 pointer-events-none"
              style={{
                background: dark
                  ? "linear-gradient(180deg, transparent 0%, rgba(15,23,42,0.55) 75%)"
                  : "linear-gradient(180deg, transparent 0%, rgba(10,26,74,0.40) 75%)",
              }}
            >
              <span
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-bold"
                style={{
                  background: "rgba(255,255,255,0.92)",
                  color: "#0f2f8f",
                  boxShadow: "0 4px 14px rgba(15,47,143,0.18)",
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#0f2f8f" }} />
                Searching…
              </span>
              <span className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.8)" }}>
                Tap to cancel
              </span>
            </span>
          )}
        </button>

        {CORNER_BRACKETS.map(corner => (
          <span
            key={corner.key}
            aria-hidden="true"
            className={`absolute w-8 h-8 transition-colors duration-300 pointer-events-none ${corner.className}`}
            style={{ borderColor: frameColor, borderRadius: corner.radius }}
          />
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 min-h-[22px] px-2">
        {detected ? (
          <>
            {danger
              ? <AlertTriangle size={16} strokeWidth={2.5} style={{ color: "#d4183d" }} />
              : <CheckCircle2 size={16} strokeWidth={2.5} style={{ color: "#16a34a" }} />}
            <p
              className="text-[14px] font-extrabold truncate tracking-wide"
              style={{
                color: danger ? "#d4183d" : "#15803d",
                textShadow: dark ? "0 1px 2px rgba(0,0,0,0.55)" : "0 1px 0 rgba(255,255,255,0.85)",
              }}
            >
              {detectedLabel ?? "QR captured"}
            </p>
          </>
        ) : scanning ? (
          <p className="text-[11px] font-semibold text-center" style={{ color: textMuted }}>
            {scanningHint}
          </p>
        ) : (
          <p className="text-[11px] font-semibold text-center" style={{ color: dark ? "rgba(255,255,255,0.70)" : FIELD_TEXT_FAINT }}>
            {viewOnly ? "Scanning disabled" : idleHint}
          </p>
        )}
      </div>
    </div>
  );
}

const SCAN_GLASS = {
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  background: "rgba(255,255,255,0.42)",
  border: "1px solid rgba(15,47,143,0.10)",
  boxShadow: "0 8px 28px rgba(15,47,143,0.06)",
} as const;

/** Shared history list — frosted rows on the tinted page, not solid white cards. */
function ScannedHistoryList({
  records,
  targetVolumeM3,
  onSelect,
  dark = false,
}: {
  records: ScannedSampleLog[];
  targetVolumeM3: number;
  onSelect: (code: string) => void;
  dark?: boolean;
}) {
  const scanned = records.length;
  const scannedVolume = records.reduce((sum, record) => {
    const raw = Number(record.log.volume || record.previous.volume);
    return sum + (Number.isNaN(raw) ? 0 : raw);
  }, 0);
  const safeTarget = Math.max(0.1, targetVolumeM3);
  const progress = Math.min(1, scannedVolume / safeTarget);
  const percent = progress * 100;
  const formatVol = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const textPrimary = dark ? "#ffffff" : "#0a1a4a";
  const textMuted = dark ? "rgba(255,255,255,0.78)" : FIELD_TEXT_MUTED;
  const accent = dark ? "#93c5fd" : "#0f2f8f";
  const cardBg = dark ? "rgba(30, 41, 59, 0.78)" : "#ffffff";
  const cardBorder = dark ? "rgba(255,255,255,0.14)" : "rgba(15,47,143,0.16)";

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        boxShadow: dark ? "0 2px 12px rgba(0,0,0,0.28)" : "0 2px 12px rgba(15,47,143,0.05)",
      }}
    >
      <div className="px-3.5 pt-3.5 pb-3 flex flex-col gap-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: accent }}>
          Total Scanned Volume
        </p>

        <div className="flex items-end justify-between gap-2">
          <p className="min-w-0 leading-none">
            <span className="text-[22px] font-bold tabular-nums" style={{ color: textPrimary }}>
              {formatVol(scannedVolume)} m³
            </span>
            <span className="text-[13px] font-medium ml-1.5" style={{ color: dark ? "rgba(255,255,255,0.55)" : FIELD_TEXT_FAINT }}>
              / {formatVol(safeTarget)} m³ target
            </span>
          </p>
          <span className="text-[15px] font-bold tabular-nums flex-shrink-0" style={{ color: textPrimary }}>
            {percent.toFixed(1)}%
          </span>
        </div>

        <div
          className="h-2.5 w-full rounded-full overflow-hidden"
          style={{ background: dark ? "rgba(255,255,255,0.10)" : "rgba(15,47,143,0.10)" }}
          role="progressbar"
          aria-valuenow={Number(percent.toFixed(1))}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Total scanned volume progress"
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress * 100}%`,
              background: dark ? "#60a5fa" : "#0f2f8f",
            }}
          />
        </div>
      </div>

      <div
        className="px-3.5 py-2.5 flex items-baseline justify-between gap-2"
        style={{
          borderTop: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(15,47,143,0.08)"}`,
          background: dark ? "rgba(255,255,255,0.03)" : "rgba(15,47,143,0.03)",
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: textMuted }}>
          Scanned QR Codes
        </p>
        <span className="text-[11px] font-semibold flex-shrink-0" style={{ color: dark ? "rgba(255,255,255,0.55)" : FIELD_TEXT_FAINT }}>
          {scanned} scanned
        </span>
      </div>

      {records.length === 0 ? (
        <div className="px-4 py-7 flex flex-col items-center gap-2 text-center">
          <span
            className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: dark ? "rgba(255,255,255,0.08)" : "rgba(15,47,143,0.08)", color: accent }}
          >
            <QrCode size={20} />
          </span>
          <p className="text-[13px] font-bold" style={{ color: textPrimary }}>No QR codes scanned yet</p>
          <p className="text-[11px] leading-relaxed max-w-[220px]" style={{ color: textMuted }}>
            Align a log QR in the frame above — captures show up here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col px-2 pb-2 gap-1.5">
          {records.map((record, i) => {
            const meta = SCAN_STATUS_META[record.status];
            const hasEdits = Boolean(record.inspectorMeasurements);
            return (
              <button
                key={record.code}
                type="button"
                onClick={() => onSelect(record.code)}
                className="w-full text-left rounded-xl px-3 py-3 flex items-center gap-3 animate-riseIn focus:outline-none active:scale-[0.99] transition-transform"
                style={{
                  background: dark ? "rgba(255,255,255,0.04)" : "rgba(15,47,143,0.04)",
                  border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(15,47,143,0.08)"}`,
                  ["--rise-delay" as string]: `${40 + i * 45}ms`,
                }}
                aria-label={`View details for ${record.code}`}
              >
                <span
                  className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: dark ? "rgba(59,130,246,0.18)" : "rgba(15,47,143,0.10)", color: accent }}
                >
                  <QrCode size={20} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <p className="text-[14px] font-bold truncate" style={{ color: textPrimary }}>
                      {record.code}
                    </p>
                    <span
                      className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-bold uppercase tracking-wide flex-shrink-0"
                      style={{ background: meta.bg, color: meta.color }}
                    >
                      {meta.label}
                    </span>
                    {hasEdits && (
                      <span
                        className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-bold uppercase tracking-wide flex-shrink-0"
                        style={{
                          background: dark ? "rgba(59,130,246,0.18)" : "rgba(15,47,143,0.12)",
                          color: accent,
                        }}
                      >
                        Edited
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] mt-1 truncate" style={{ color: textMuted }}>
                    {record.scannedAt} <span aria-hidden>·</span> {record.log.productName}
                  </p>
                </div>

                <ChevronRight size={17} className="flex-shrink-0" style={{ color: dark ? "rgba(255,255,255,0.35)" : "#94a3b8" }} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SampleVerificationScanScreen({
  scanCount,
  records,
  targetVolumeM3,
  physicalComplete = false,
  sampleComplete = false,
  noSamplesAvailable = false,
  noSamplesReason = "",
  onNoSamplesChange,
  onBack,
  onGoToPhysical,
  onScanned,
  onOpenRecord,
  onFinishInspection,
  viewOnly = false,
  dark = false,
}: {
  scanCount: number;
  records: ScannedSampleLog[];
  targetVolumeM3: number;
  physicalComplete?: boolean;
  sampleComplete?: boolean;
  noSamplesAvailable?: boolean;
  noSamplesReason?: string;
  onNoSamplesChange?: (patch: { noSamplesAvailable?: boolean; noSamplesReason?: string }) => void;
  onBack: () => void;
  onGoToPhysical?: () => void;
  onScanned: (record: ScannedSampleLog) => void;
  onOpenRecord: (code: string) => void;
  onFinishInspection: () => void;
  viewOnly?: boolean;
  dark?: boolean;
}) {
  const [phase, setPhase] = useState<ScannerPhase>("idle");
  const [finishPulse, setFinishPulse] = useState(false);
  const [activeTab, setActiveTab] = useState<PreShipmentTab>("verification");
  const [ncView, setNcView] = useState<NonComplianceView>("list");
  const [selectedNcTypes, setSelectedNcTypes] = useState<string[]>([]);
  const [ncDescription, setNcDescription] = useState("");
  const [attachments, setAttachments] = useState<AttachmentFile[]>(ATTACHMENT_FILES);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const next = SAMPLE_QR_POOL[scanCount % SAMPLE_QR_POOL.length];

  const completionGate = evaluatePreShipmentCompletion(
    {
      ...EMPTY_PHYSICAL_VERIFICATION,
      physicalStepComplete: physicalComplete,
      sampleStepComplete: sampleComplete,
      noSamplesAvailable,
      noSamplesReason,
    },
    records.length,
  );
  const canFinish = viewOnly || completionGate.canComplete;
  const hasScans = records.length > 0;

  // Simulated capture: the frame "finds" a code, shows a confirmation beat, then advances.
  useEffect(() => {
    if (viewOnly || phase !== "scanning") return;
    const timer = setTimeout(() => setPhase("detected"), SCAN_DETECT_MS);
    return () => clearTimeout(timer);
  }, [phase, viewOnly]);

  useEffect(() => {
    if (viewOnly || phase !== "detected") return;
    const timer = setTimeout(
      () => onScanned({
        code: next.code,
        scannedAt: formatScanTime(new Date()),
        status: next.status,
        log: next.log,
        previous: next.previous,
      }),
      SCAN_CONFIRM_MS,
    );
    return () => clearTimeout(timer);
  }, [phase, next, onScanned, viewOnly]);

  // Scans take precedence — clear the no-samples waiver once a sample exists.
  useEffect(() => {
    if (viewOnly || !hasScans || !noSamplesAvailable) return;
    onNoSamplesChange?.({ noSamplesAvailable: false, noSamplesReason: "" });
  }, [hasScans, noSamplesAvailable, onNoSamplesChange, viewOnly]);

  const detected = phase === "detected";
  const scanning = phase === "scanning";
  const frameColor = detected
    ? "#16a34a"
    : scanning
      ? (dark ? "#93c5fd" : "#0f2f8f")
      : (dark ? "rgba(255,255,255,0.65)" : FIELD_TEXT_FAINT);

  const handleBack = () => {
    if (activeTab === "non-compliance" && ncView === "create") {
      setNcView("list");
      return;
    }
    onBack();
  };
  const swipe = useSwipeBack(handleBack);
  const pageBg = dark
    ? "linear-gradient(165deg, #0b1224 0%, #0f172a 42%, #111827 100%)"
    : "#f0f4ff";
  const textPrimary = dark ? "#ffffff" : "#0a1a4a";
  const textMuted = dark ? "rgba(255,255,255,0.78)" : FIELD_TEXT_MUTED;
  const textFaint = dark ? "rgba(255,255,255,0.55)" : FIELD_TEXT_FAINT;
  const cardBg = dark ? "rgba(30, 41, 59, 0.78)" : "#ffffff";
  const cardBorder = dark ? "rgba(255,255,255,0.14)" : "rgba(15,47,143,0.14)";
  const cardShadow = dark ? "0 2px 12px rgba(0,0,0,0.28)" : "0 2px 12px rgba(15,47,143,0.06)";
  const fieldBg = dark ? "rgba(15, 23, 42, 0.85)" : "#ffffff";
  const fieldBorder = dark ? "rgba(255,255,255,0.16)" : "rgba(15,47,143,0.22)";
  const dashedBorder = dark ? "rgba(255,255,255,0.22)" : "rgba(15,47,143,0.28)";
  const iconMutedBg = dark ? "rgba(255,255,255,0.10)" : "rgba(15,47,143,0.08)";

  const tabs: { id: PreShipmentTab; label: string; short: string }[] = [
    { id: "verification", label: "Verification", short: "Verify" },
    { id: "non-compliance", label: "Non-Compliance", short: "NC" },
    { id: "attachments", label: "Attachments", short: "Files" },
  ];

  const handleNcTypeToggle = (type: string) => {
    setSelectedNcTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type],
    );
  };

  const handleAttachmentPicked = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const ext = file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase();
    if (!ACCEPTED_ATTACHMENT_EXTS.includes(ext)) {
      setAttachmentError("Unsupported file type. Choose a JPG, PNG, or PDF.");
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachmentError(`That file is ${formatAttachmentSize(file.size)}. The limit is 10 MB.`);
      return;
    }

    setAttachmentError(null);
    setAttachments(prev => [
      ...prev,
      {
        fileName: file.name,
        category: ext === "pdf" ? "DOCUMENT" : "PHOTO",
        uploaded: new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }),
        size: formatAttachmentSize(file.size),
      },
    ]);
  };

  const runFinishInspection = () => {
    if (viewOnly) {
      onBack();
      return;
    }
    if (!completionGate.canComplete) return;
    onFinishInspection();
  };

  return (
    <div
      className="min-h-screen w-full animate-fadeIn"
      style={{ background: pageBg, fontFamily: "'Inter', sans-serif" }}
      {...swipe}
    >
      <AppHeaderBar dark={dark}>
        <div className="flex items-center gap-3 min-w-0">
          <BackCardButton onClick={handleBack} dark={dark} />
          <div className="min-w-0">
            <h1 className="text-[16px] sm:text-[18px] font-bold tracking-tight truncate" style={{ color: textPrimary }}>
              Sample Verification
            </h1>
          </div>
        </div>
      </AppHeaderBar>

      <div
        className="w-full max-w-[480px] mx-auto min-h-screen flex flex-col px-5 pt-5 gap-4"
        style={{ paddingBottom: BOTTOM_NAV_PAD }}
      >
        <LiquidTabBar
          ariaLabel="Pre-shipment sections"
          dark={dark}
          value={activeTab}
          onChange={id => {
            setActiveTab(id as PreShipmentTab);
            if (id !== "non-compliance") setNcView("list");
          }}
          items={tabs.map(tab => ({
            id: tab.id,
            node: (
              <>
                <span className="sm:hidden truncate block">{tab.short}</span>
                <span className="hidden sm:inline truncate">{tab.label}</span>
              </>
            ),
          }))}
        />

        {activeTab === "verification" && (
        <div key="verification" className="flex flex-col gap-6 animate-panelIn">
        <PreShipmentVerifyStepper
          activeStep="sample"
          physicalComplete={physicalComplete}
          sampleComplete={sampleComplete}
          onStepSelect={step => {
            if (step === "physical") (onGoToPhysical ?? onBack)();
          }}
        />

        {/* Scanner — shared tap-to-scan viewfinder */}
        <section className="flex flex-col items-center gap-3">
          <QrTapViewfinder
            phase={phase}
            dark={dark}
            viewOnly={viewOnly}
            detectedLabel={`${next.code} captured`}
            idleHint="Ready when you are"
            scanningHint="Hold steady over the log QR"
            onToggleScan={() => {
              if (phase === "idle") setPhase("scanning");
              else if (phase === "scanning") setPhase("idle");
            }}
          />
        </section>

        {/* Scanned history — stays below the scanner and grows with every capture */}
        <ScannedHistoryList records={records} targetVolumeM3={targetVolumeM3} onSelect={onOpenRecord} dark={dark} />

        {!viewOnly && !hasScans && (
          <div
            className="rounded-2xl p-4 flex flex-col gap-3"
            style={{
              background: cardBg,
              border: `1.5px solid ${cardBorder}`,
              boxShadow: cardShadow,
            }}
          >
            <label
              className="flex items-start gap-3 cursor-pointer min-h-12"
            >
              <input
                type="checkbox"
                checked={noSamplesAvailable}
                onChange={e => onNoSamplesChange?.({
                  noSamplesAvailable: e.target.checked,
                  noSamplesReason: e.target.checked ? noSamplesReason : "",
                })}
                className="mt-1 w-5 h-5 flex-shrink-0 rounded accent-[#0f2f8f]"
              />
              <span className="min-w-0">
                <span className="block text-[14px] font-bold" style={{ color: textPrimary }}>
                  No Samples Available
                </span>
                <span className="block text-[12px] font-medium mt-0.5 leading-snug" style={{ color: textMuted }}>
                  Use this only when you cannot scan any sample logs on site.
                </span>
              </span>
            </label>
            {noSamplesAvailable && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="no-samples-reason" className="text-[12px] font-bold" style={{ color: textPrimary }}>
                  Reason <span style={{ color: "#d4183d" }}>*</span>
                </label>
                <textarea
                  id="no-samples-reason"
                  rows={3}
                  value={noSamplesReason}
                  onChange={e => onNoSamplesChange?.({ noSamplesReason: e.target.value })}
                  placeholder="Explain why no samples are available..."
                  className="w-full p-3 text-[13px] font-medium rounded-xl focus:outline-none resize-none min-h-[72px]"
                  style={{
                    background: fieldBg,
                    border: `1.5px solid ${noSamplesReason.trim()
                      ? fieldBorder
                      : (dark ? "rgba(251,191,36,0.45)" : "rgba(180,120,20,0.45)")}`,
                    color: textPrimary,
                  }}
                  required
                />
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => (onGoToPhysical ?? onBack)()}
            className="pressable flex-1 min-w-0 min-h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 focus:outline-none"
            style={{
              background: dark ? "rgba(30, 41, 59, 0.78)" : "#ffffff",
              color: textPrimary,
              border: `1.5px solid ${dark ? "rgba(255,255,255,0.18)" : "rgba(15,47,143,0.22)"}`,
              boxShadow: dark ? "none" : "0 2px 8px rgba(15,47,143,0.06)",
            }}
            aria-label="Back"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <button
            type="button"
            onClick={runFinishInspection}
            disabled={!viewOnly && (!canFinish || finishPulse)}
            className={`pressable flex-1 min-w-0 min-h-12 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 focus:outline-none disabled:cursor-not-allowed ${finishPulse ? "animate-finishSuccess" : ""}`}
            style={{
              background: canFinish || viewOnly ? GRADIENT : (dark ? "rgba(255,255,255,0.14)" : "#64748b"),
              boxShadow: canFinish || viewOnly ? "0 6px 18px rgba(15,47,143,0.30)" : "none",
              opacity: !viewOnly && !canFinish ? 0.72 : 1,
            }}
            aria-disabled={!viewOnly && !canFinish}
            title={!viewOnly && !canFinish ? completionGate.blockers[0] : undefined}
          >
            {viewOnly ? "Close" : finishPulse ? "Completed" : "Finish Inspection"}
            {!viewOnly && <CheckCircle2 size={16} className={finishPulse ? "animate-checkPop" : undefined} />}
          </button>
        </div>
        </div>
        )}

        {activeTab === "non-compliance" && ncView === "list" && (
          <div className="flex flex-col gap-4 animate-panelIn">
            {!viewOnly && (
              <button
                type="button"
                onClick={() => setNcView("create")}
                className="pressable w-full min-h-12 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 focus:outline-none"
                style={{ background: GRADIENT, boxShadow: "0 4px 14px rgba(15,47,143,0.28)" }}
              >
                <Plus size={16} />
                New Notice of Discrepancy
              </button>
            )}
            <div
              className="rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-2"
              style={{
                background: cardBg,
                border: `2px dashed ${dashedBorder}`,
                boxShadow: cardShadow,
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-1"
                style={{ background: iconMutedBg, color: textFaint }}
              >
                <ClipboardList size={22} />
              </div>
              <p className="text-[12px] font-medium" style={{ color: textMuted }}>
                No Notices of Discrepancy filed yet.
              </p>
            </div>
          </div>
        )}

        {activeTab === "non-compliance" && ncView === "create" && (
          <div className="flex flex-col gap-4 animate-panelIn">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-bold" style={{ color: textPrimary }}>
                Non-Compliance Description <span style={{ color: "#d4183d" }}>*</span>
              </label>
              <textarea
                rows={4}
                value={ncDescription}
                onChange={e => setNcDescription(e.target.value)}
                placeholder="Describe the discrepancy observed..."
                className="w-full p-3 text-[12px] rounded-xl focus:outline-none resize-none"
                style={{
                  background: fieldBg,
                  border: `1px solid ${fieldBorder}`,
                  color: textPrimary,
                  boxShadow: cardShadow,
                }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>
                Type of Non-Compliance
              </label>
              <div
                className="rounded-2xl overflow-hidden flex flex-col"
                style={{
                  background: cardBg,
                  border: `1px solid ${cardBorder}`,
                  boxShadow: cardShadow,
                }}
              >
                <div className="px-3.5 pt-3 pb-2">
                  <p className="text-[13px] font-bold" style={{ color: textPrimary }}>
                    Non-Compliance Records
                  </p>
                </div>
                <div className="px-3 pb-3 flex flex-col gap-2 max-h-56 overflow-y-auto overscroll-contain">
                  {NON_COMPLIANCE_TYPES.map(type => {
                    const checked = selectedNcTypes.includes(type);
                    return (
                      <label
                        key={type}
                        className="flex items-center gap-3 cursor-pointer rounded-full px-3 py-2.5 transition-all active:scale-[0.99]"
                        style={{
                          background: checked
                            ? (dark ? "rgba(59,130,246,0.16)" : "rgba(15,47,143,0.06)")
                            : (dark ? "rgba(255,255,255,0.03)" : "#ffffff"),
                          border: checked
                            ? (dark ? "1.5px solid rgba(96,165,250,0.45)" : "1.5px solid rgba(15,47,143,0.35)")
                            : (dark ? "1.5px solid rgba(255,255,255,0.10)" : "1.5px solid rgba(15,47,143,0.12)"),
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleNcTypeToggle(type)}
                          className="w-4 h-4 flex-shrink-0 rounded accent-[#0f2f8f]"
                        />
                        <span className="text-[14px] font-medium leading-snug" style={{ color: textPrimary }}>
                          {type}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <div
                  className="px-3.5 py-2.5"
                  style={{
                    background: dark ? "rgba(255,255,255,0.04)" : "rgba(15,47,143,0.05)",
                    borderTop: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(15,47,143,0.08)"}`,
                  }}
                >
                  <p className="text-[12px] font-semibold" style={{ color: textMuted }}>
                    Summary:{" "}
                    <span style={{ color: dark ? "#93c5fd" : "#0f2f8f" }}>
                      {selectedNcTypes.length} selected
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setNcView("list");
                setNcDescription("");
                setSelectedNcTypes([]);
              }}
              className="w-full h-12 rounded-xl text-[12px] font-bold uppercase tracking-wider text-white flex items-center justify-center focus:outline-none active:scale-[0.98]"
              style={{ background: GRADIENT, boxShadow: "0 4px 14px rgba(15,47,143,0.28)" }}
            >
              Submit Notice of Discrepancy
            </button>
          </div>
        )}

        {activeTab === "attachments" && (
          <div className="flex flex-col gap-4 animate-panelIn">
            <input
              ref={attachmentInputRef}
              type="file"
              accept={ACCEPTED_ATTACHMENT_MIME}
              onChange={handleAttachmentPicked}
              className="hidden"
            />
            {!viewOnly && (
              <button
                type="button"
                onClick={() => attachmentInputRef.current?.click()}
                className="rounded-2xl p-6 flex flex-col items-center justify-center gap-2 focus:outline-none active:scale-[0.99] transition-all"
                style={{
                  background: cardBg,
                  border: `2px dashed ${dashedBorder}`,
                  boxShadow: cardShadow,
                }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: iconMutedBg, color: textMuted }}
                >
                  <Upload size={18} />
                </div>
                <p className="text-[12px] font-bold" style={{ color: textPrimary }}>+ Add Photo or Document</p>
                <p className="text-[11px] font-medium" style={{ color: textFaint }}>JPG, PNG, or PDF up to 10MB</p>
              </button>
            )}
            {attachmentError && (
              <p
                role="alert"
                className="text-[11px] font-semibold rounded-xl px-3 py-2.5"
                style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid rgba(220,38,38,0.18)" }}
              >
                {attachmentError}
              </p>
            )}
            {attachments.map((file, i) => (
              <AttachmentFileCard
                key={`${file.fileName}-${i}`}
                file={file}
                index={i}
                dark={dark}
                onDelete={viewOnly ? undefined : () => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type MeasurementValues = {
  diameter1: string;
  diameter2: string;
  diameter3: string;
  diameter4: string;
  diameter: string;
  length: string;
  volume: string;
  defectVolume: string;
};

const EMPTY_INSPECTOR_MEASUREMENTS: MeasurementValues = {
  diameter1: "",
  diameter2: "",
  diameter3: "",
  diameter4: "",
  diameter: "",
  length: "",
  volume: "",
  defectVolume: "",
};

function measurementsFromLog(data: RegisterLogFormData): MeasurementValues {
  return {
    diameter1: data.diameter1,
    diameter2: data.diameter2,
    diameter3: data.diameter3,
    diameter4: data.diameter4,
    diameter: data.diameter,
    length: data.length,
    volume: data.volume,
    defectVolume: data.defectVolume,
  };
}

/** Demo history for completed inspections opened via View. */
function buildCompletedSampleScans(): ScannedSampleLog[] {
  const now = Date.now();
  return [...SAMPLE_QR_POOL].reverse().map((item, index) => {
    const inspector = measurementsFromLog(item.log);
    return {
      code: item.code,
      scannedAt: formatScanTime(new Date(now - index * 7 * 60_000)),
      status: item.status,
      log: item.log,
      previous: item.previous,
      inspectorMeasurements: {
        diameter1: formatMeasurementOneDecimal(inspector.diameter1),
        diameter2: formatMeasurementOneDecimal(inspector.diameter2),
        diameter3: formatMeasurementOneDecimal(inspector.diameter3),
        diameter4: formatMeasurementOneDecimal(inspector.diameter4),
        diameter: formatMeasurementOneDecimal(inspector.diameter),
        length: formatMeasurementOneDecimal(inspector.length),
        volume: formatMeasurementOneDecimal(inspector.volume),
        defectVolume: formatMeasurementOneDecimal(inspector.defectVolume),
      },
      inspectorComment:
        item.status === "flagged"
          ? "Minor end split recorded — accepted with note."
          : "Sample verified against declared log details.",
    };
  });
}

const MEASUREMENT_ROWS: {
  key: keyof MeasurementValues;
  label: string;
  unit?: string;
  required?: boolean;
  inspectorInput?: boolean;
}[] = [
  { key: "diameter1", label: "D1", unit: "cm", inspectorInput: true },
  { key: "diameter2", label: "D2", unit: "cm", inspectorInput: true },
  { key: "diameter3", label: "D3", unit: "cm", inspectorInput: true },
  { key: "diameter4", label: "D4", unit: "cm", inspectorInput: true },
  { key: "diameter", label: "Avg.diamete", unit: "cm", required: true, inspectorInput: true },
  { key: "length", label: "Length", unit: "m", required: true },
  { key: "volume", label: "Volume", unit: "m³", required: true },
  { key: "defectVolume", label: "Defect Vol.", unit: "m³", required: true, inspectorInput: true },
];

/** Format numeric measurement values to one decimal place (e.g. 12 → 12.0). */
function formatMeasurementOneDecimal(value: string) {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  const num = Number(trimmed);
  if (Number.isNaN(num)) return trimmed;
  return num.toFixed(1);
}

function displayMeasurementOneDecimal(value: string) {
  const formatted = formatMeasurementOneDecimal(value);
  return formatted === "" ? "—" : formatted;
}

function isMeasurementChanged(exporterVal: string, inspectorVal: string) {
  const prev = formatMeasurementOneDecimal(exporterVal);
  const curr = formatMeasurementOneDecimal(inspectorVal);
  return prev !== "" && curr !== "" && prev !== curr;
}

function MeasurementCompareTable({
  exporter,
  inspector,
  onInspectorChange,
  inspectorReadOnly = false,
  dark = false,
}: {
  exporter: MeasurementValues;
  inspector: MeasurementValues;
  onInspectorChange?: (patch: Partial<MeasurementValues>) => void;
  inspectorReadOnly?: boolean;
  dark?: boolean;
}) {
  const textPrimary = dark ? "#ffffff" : "#0a1a4a";
  const textMuted = dark ? "rgba(255,255,255,0.82)" : FIELD_TEXT_MUTED;
  const accent = dark ? "#93c5fd" : "#0f2f8f";
  const cardBg = dark ? "rgba(30, 41, 59, 0.78)" : "#ffffff";
  const cardBorder = dark ? "rgba(255,255,255,0.10)" : "rgba(15,47,143,0.10)";
  const rowBorder = dark ? "rgba(255,255,255,0.08)" : "rgba(15,47,143,0.06)";
  const exporterCellBg = dark ? "rgba(255,255,255,0.05)" : "rgba(15,47,143,0.04)";
  const exporterCellBorder = dark ? "rgba(255,255,255,0.10)" : "rgba(15,47,143,0.08)";

  return (
    <div
      className="w-full overflow-hidden rounded-2xl"
      style={{
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        boxShadow: dark ? "0 2px 12px rgba(0,0,0,0.28)" : "0 2px 12px rgba(15,47,143,0.05)",
      }}
    >
      <div
        className="grid items-center px-3 py-2.5"
        style={{
          gridTemplateColumns: "minmax(4.5rem, 1.1fr) 1fr 1fr",
          background: cardBg,
          borderBottom: `1px solid ${cardBorder}`,
        }}
      >
        <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>
          Parameters
        </p>
        <p className="text-[12px] font-bold uppercase tracking-wider text-center" style={{ color: textMuted }}>
          Exporter
        </p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-center" style={{ color: accent }}>
          Inspector
        </p>
      </div>

      {MEASUREMENT_ROWS.map((row, index) => {
        const exporterVal = exporter[row.key];
        const inspectorVal = inspector[row.key];
        const changed = isMeasurementChanged(exporterVal, inspectorVal);
        const showInspectorInput = !inspectorReadOnly && row.inspectorInput;

        return (
          <div
            key={row.key}
            className="grid items-center px-3 py-2"
            style={{
              gridTemplateColumns: "minmax(4.5rem, 1.1fr) 1fr 1fr",
              gap: "0.5rem",
              background: changed
                ? (dark ? "rgba(59,130,246,0.10)" : "rgba(15,47,143,0.035)")
                : cardBg,
              borderBottom: index === MEASUREMENT_ROWS.length - 1 ? "none" : `1px solid ${rowBorder}`,
            }}
          >
            <div className="min-w-0 flex items-start gap-1.5">
              <span
                className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{
                  background: changed ? accent : "transparent",
                  boxShadow: changed ? (dark ? "0 0 0 3px rgba(59,130,246,0.22)" : "0 0 0 3px rgba(15,47,143,0.14)") : undefined,
                }}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-[12px] font-semibold leading-tight" style={{ color: textPrimary }}>
                  {row.label}
                  {row.required && <span className="text-red-500 ml-0.5">*</span>}
                </p>
                {row.unit && (
                  <p className="text-[9px] font-medium mt-0.5" style={{ color: dark ? "rgba(255,255,255,0.70)" : FIELD_TEXT_FAINT }}>
                    {row.unit}
                  </p>
                )}
              </div>
            </div>

            <div
              className="min-h-[36px] rounded-xl px-2 flex items-center justify-center text-[12px] font-semibold tabular-nums"
              style={{
                background: exporterCellBg,
                border: `1px solid ${exporterCellBorder}`,
                color: textMuted,
                fontSize: "12px",
                fontWeight: 600,
                lineHeight: "16px",
              }}
            >
              {displayMeasurementOneDecimal(exporterVal)}
            </div>

            {showInspectorInput ? (
              <input
                className="w-full min-h-[36px] rounded-xl px-2 text-center tabular-nums outline-none focus:border-blue-400"
                style={{
                  background: changed
                    ? (dark ? "rgba(59,130,246,0.12)" : "rgba(15,47,143,0.06)")
                    : (dark ? "rgba(15,23,42,0.85)" : "#ffffff"),
                  border: `1px solid ${changed
                    ? (dark ? "rgba(96,165,250,0.45)" : "rgba(15,47,143,0.35)")
                    : (dark ? "rgba(255,255,255,0.12)" : "#dce4f5")}`,
                  color: textMuted,
                  boxShadow: changed ? (dark ? "0 0 0 2px rgba(59,130,246,0.14)" : "0 0 0 2px rgba(15,47,143,0.08)") : undefined,
                  fontSize: "12px",
                  fontWeight: 600,
                  lineHeight: "16px",
                  fontFamily: "inherit",
                }}
                inputMode="decimal"
                value={inspectorVal}
                placeholder="--"
                onChange={e => onInspectorChange?.({ [row.key]: e.target.value })}
                onBlur={() => {
                  const formatted = formatMeasurementOneDecimal(inspectorVal);
                  if (formatted !== inspectorVal) {
                    onInspectorChange?.({ [row.key]: formatted });
                  }
                }}
              />
            ) : (
              <div
                className="min-h-[36px] rounded-xl px-2 flex items-center justify-center text-[12px] font-semibold tabular-nums"
                style={{
                  background: changed
                    ? (dark ? "rgba(59,130,246,0.12)" : "rgba(15,47,143,0.08)")
                    : (dark ? "rgba(15,23,42,0.85)" : "#ffffff"),
                  border: `1px solid ${changed
                    ? (dark ? "rgba(96,165,250,0.40)" : "rgba(15,47,143,0.28)")
                    : (dark ? "rgba(255,255,255,0.12)" : "#dce4f5")}`,
                  color: changed ? accent : textMuted,
                  fontSize: "12px",
                  fontWeight: 600,
                  lineHeight: "16px",
                }}
              >
                {displayMeasurementOneDecimal(inspectorVal)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function QrDetailsScreen({
  record,
  onBack,
  onFinish,
  viewOnly = false,
  dark = false,
}: {
  record: ScannedSampleLog;
  onBack: () => void;
  onFinish: (result: { measurements: MeasurementValues; comment: string }) => void;
  viewOnly?: boolean;
  dark?: boolean;
}) {
  const log = record.log;
  const exporter = record.previous;
  const exporterMeasurements = measurementsFromLog(exporter);
  const [inspectorMeasurements, setInspectorMeasurements] = useState<MeasurementValues>(() => {
    if (record.inspectorMeasurements) return record.inspectorMeasurements;
    return {
      ...EMPTY_INSPECTOR_MEASUREMENTS,
      length: formatMeasurementOneDecimal(exporterMeasurements.length),
      volume: formatMeasurementOneDecimal(exporterMeasurements.volume),
    };
  });
  const [inspectorComment, setInspectorComment] = useState(record.inspectorComment ?? "");
  const [commentTouched, setCommentTouched] = useState(false);
  const pageBg = dark
    ? "linear-gradient(165deg, #0b1224 0%, #0f172a 42%, #111827 100%)"
    : "#f0f4ff";
  const textPrimary = dark ? "#ffffff" : "#0a1a4a";
  const textMuted = dark ? "rgba(255,255,255,0.82)" : FIELD_TEXT_MUTED;
  const fieldBg = dark ? "rgba(15, 23, 42, 0.85)" : "#ffffff";
  const fieldBorder = dark ? "rgba(255,255,255,0.12)" : "#dce4f5";
  const readOnlyStyle = {
    background: fieldBg,
    border: `1px solid ${fieldBorder}`,
    color: textMuted,
    cursor: "not-allowed" as const,
  };
  const editableStyle = {
    background: fieldBg,
    border: `1px solid ${fieldBorder}`,
    color: textPrimary,
  };
  const swipe = useSwipeBack(onBack);

  const hasChanges = MEASUREMENT_ROWS.some(row =>
    isMeasurementChanged(exporterMeasurements[row.key], inspectorMeasurements[row.key]),
  );
  const commentRequired = hasChanges;
  const commentValid = !commentRequired || inspectorComment.trim().length > 0;
  const commentError = commentTouched && commentRequired && !inspectorComment.trim();
  const isEditingSaved = Boolean(record.inspectorMeasurements);

  const handleVerifySubmit = () => {
    if (commentRequired && !inspectorComment.trim()) {
      setCommentTouched(true);
      return;
    }
    onFinish({ measurements: inspectorMeasurements, comment: inspectorComment.trim() });
  };

  return (
    <div
      className="min-h-screen w-full animate-fadeIn"
      style={{ background: pageBg, fontFamily: "'Inter', sans-serif" }}
      {...swipe}
    >
      <AppHeaderBar dark={dark}>
        <div className="flex items-center gap-3 min-w-0">
          <BackCardButton onClick={onBack} dark={dark} />
          <div className="min-w-0">
            <h1 className="text-[16px] sm:text-[18px] font-bold tracking-tight truncate" style={{ color: textPrimary }}>
              {isEditingSaved ? "Edit QR Verification" : "Scanned QR Details"}
            </h1>
          </div>
        </div>
      </AppHeaderBar>

      <div className="w-full max-w-[480px] mx-auto min-h-screen flex flex-col">
        <div className="flex flex-col gap-5 px-5 pt-6" style={{ paddingBottom: BOTTOM_NAV_PAD }}>

          <FormField label="Serial No" required dark={dark}>
            <input className={inputCls} style={readOnlyStyle} value={log.serialNo} readOnly />
          </FormField>

          <FormField label="Reg Date" required dark={dark}>
            <input type="date" className={inputCls} style={{ ...readOnlyStyle, paddingRight: "2.5rem" }} value={log.regDate} readOnly />
          </FormField>

          <FormField label="Product Group" required dark={dark}>
            <input className={inputCls} style={readOnlyStyle} value={log.productGroup} readOnly />
          </FormField>

          <FormField label="Product Type" required dark={dark}>
            <input className={inputCls} style={readOnlyStyle} value={log.productType} readOnly />
          </FormField>

          <FormField label="Product Name" required dark={dark}>
            <input className={inputCls} style={readOnlyStyle} value={log.productName} readOnly />
          </FormField>

          <FormField label="Lot Number" dark={dark}>
            <input className={inputCls} style={readOnlyStyle} value={log.lotNumber} readOnly />
          </FormField>

          <div className="flex flex-col gap-2.5">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: textMuted }}>Measurements</p>
            <MeasurementCompareTable
              exporter={exporterMeasurements}
              inspector={inspectorMeasurements}
              inspectorReadOnly={viewOnly}
              dark={dark}
              onInspectorChange={viewOnly ? undefined : patch => setInspectorMeasurements(prev => ({ ...prev, ...patch }))}
            />
          </div>

          {hasChanges && (
            <FormField label="Inspector comment" required={!viewOnly} dark={dark}>
              <textarea
                className={inputCls}
                style={{
                  ...(viewOnly ? readOnlyStyle : editableStyle),
                  resize: "none",
                  minHeight: "96px",
                  border: commentError ? "1px solid #ef4444" : (viewOnly ? readOnlyStyle.border : editableStyle.border),
                }}
                rows={3}
                value={inspectorComment}
                placeholder="Add a comment about the changes…"
                readOnly={viewOnly}
                onChange={e => !viewOnly && setInspectorComment(e.target.value)}
                onBlur={() => !viewOnly && setCommentTouched(true)}
              />
              {commentError && (
                <p className="text-[11px] font-medium" style={{ color: "#ef4444" }}>
                  Comment is required when measurements are changed.
                </p>
              )}
            </FormField>
          )}

          <FormField label="Note" required dark={dark}>
            <textarea className={inputCls} style={{ ...readOnlyStyle, resize: "none" }} rows={3} value={log.note} readOnly />
          </FormField>

          <FormField label="Status" dark={dark}>
            <input className={inputCls} style={readOnlyStyle} value={log.status} readOnly />
          </FormField>

          <FormField label="Image" dark={dark}>
            <div
              className="w-full rounded-xl overflow-hidden"
              style={{ border: `1px solid ${fieldBorder}`, background: fieldBg }}
            >
              <img src={logEntryPhoto} alt="Scanned log — timber" className="w-full h-52 object-contain p-2" />
            </div>
          </FormField>

          <div className="flex items-center gap-3 pt-1">
            {viewOnly ? (
              <button
                type="button"
                onClick={onBack}
                className="w-full min-h-[48px] rounded-xl text-sm font-bold text-white flex items-center justify-center focus:outline-none active:scale-[0.98] transition-all"
                style={{ background: GRADIENT, boxShadow: "0 4px 16px rgba(15,47,143,0.35)" }}
              >
                Close
              </button>
            ) : (
              <>
            <button
              type="button"
              onClick={onBack}
              className="flex-1 min-h-[48px] rounded-xl text-sm font-bold flex items-center justify-center focus:outline-none active:scale-[0.98] transition-all"
              style={{
                background: dark ? "rgba(255,255,255,0.06)" : "#ffffff",
                border: `1px solid ${fieldBorder}`,
                color: dark ? "#93c5fd" : "#0f2f8f",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleVerifySubmit}
              disabled={!commentValid}
              className="flex-1 min-h-[48px] rounded-xl text-sm font-bold text-white flex items-center justify-center gap-1.5 focus:outline-none active:scale-[0.98] transition-all px-2 disabled:opacity-50"
              style={{ background: GRADIENT, boxShadow: "0 4px 16px rgba(15,47,143,0.35)" }}
            >
              <CheckCircle2 size={15} className="flex-shrink-0" />
              <span className="truncate">Verify & Submit</span>
            </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
// ─── Log Information Hub (Actions) ────────────────────────────────────────────

function LogInformationHubScreen({
  dark,
  onBack,
  onScanLog,
  onOpenInventory,
}: {
  dark: boolean;
  onBack: () => void;
  onScanLog: () => void;
  onOpenInventory: () => void;
}) {
  const bg = dark ? "#0f172a" : "#f0f4ff";
  const textPrimary = dark ? "#ffffff" : "#0a1a4a";
  const textMuted = dark ? "rgba(255,255,255,0.82)" : FIELD_TEXT_MUTED;
  const cardBg = dark ? "rgba(30, 41, 59, 0.55)" : "rgba(255, 255, 255, 0.55)";
  const cardBorder = dark ? "rgba(255,255,255,0.1)" : "rgba(15,47,143,0.14)";
  const iconColor = dark ? "#ffffff" : "#0f2f8f";
  const iconBg = dark ? "rgba(255,255,255,0.1)" : "rgba(15,47,143,0.08)";
  const subCardGlass = { backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" } as const;

  return (
    <div className="min-h-screen w-full transition-colors duration-300 animate-fadeIn" style={{ background: bg, fontFamily: "'Inter', sans-serif" }}>
      <AppHeaderBar dark={dark}>
        <div className="flex items-center gap-3">
          <BackCardButton onClick={onBack} dark={dark} />
          <div className="min-w-0">
            <h1 className="text-[18px] font-bold tracking-tight" style={{ color: textPrimary }}>Log Inventory</h1>
          </div>
        </div>
      </AppHeaderBar>

      <div
        className="w-full max-w-[480px] mx-auto flex flex-col px-5 pt-5 gap-4"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: textMuted }}>Actions</p>

        <button
          type="button"
          onClick={onScanLog}
          className="w-full rounded-2xl p-5 flex items-center gap-5 text-left group transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] focus:outline-none shadow-sm hover:shadow-md"
          style={{ ...subCardGlass, background: cardBg, border: `1px solid ${cardBorder}` }}
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 animate-iconWell" style={{ background: iconBg }}>
            <ScanLine size={26} className="animate-iconScan" style={{ color: iconColor }} />
          </div>
          <div className="flex-1">
            <p className="text-base font-bold" style={{ color: textPrimary }}>Scan Log</p>
            <p className="text-xs mt-0.5" style={{ color: textMuted }}>Scan a QR code to view or register a log</p>
          </div>
          <ChevronRight size={18} style={{ color: textMuted }} className="group-hover:translate-x-0.5 transition-transform duration-150" />
        </button>

        <button
          type="button"
          onClick={onOpenInventory}
          className="w-full rounded-2xl p-5 flex items-center gap-5 text-left group transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] focus:outline-none shadow-sm hover:shadow-md"
          style={{ ...subCardGlass, background: cardBg, border: `1px solid ${cardBorder}` }}
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 animate-iconWell" style={{ background: iconBg }}>
            <Package size={26} className="animate-iconPackage" style={{ color: iconColor }} />
          </div>
          <div className="flex-1">
            <p className="text-base font-bold" style={{ color: textPrimary }}>Log Inventory</p>
            <p className="text-xs mt-0.5" style={{ color: textMuted }}>Update stock and material records</p>
          </div>
          <ChevronRight size={18} style={{ color: textMuted }} className="group-hover:translate-x-0.5 transition-transform duration-150" />
        </button>
      </div>
    </div>
  );
}

// ─── Log Inventory Screen ─────────────────────────────────────────────────────

function LogInventoryScreen({ dark, onBack, isCU = false }: {
  dark: boolean;
  onBack: () => void;
  exporter?: string;
  concession?: string;
  isCU?: boolean;
}) {
  const bg = dark ? "#0f172a" : "#f0f4ff";
  const textPrimary = dark ? "#ffffff" : "#0a1a4a";
  const textMuted = dark ? "rgba(255,255,255,0.6)" : "#5a6a99";

  return (
    <div className="min-h-screen w-full transition-colors duration-300 animate-fadeIn" style={{ background: bg, fontFamily: "'Inter', sans-serif" }}>
      <AppHeaderBar dark={dark}>
        <div className="flex items-center gap-3">
          <BackCardButton onClick={onBack} dark={dark} />
          <div className="min-w-0">
            <h1 className="text-[18px] font-bold tracking-tight" style={{ color: textPrimary }}>
              Log Inventory
            </h1>
          </div>
        </div>
      </AppHeaderBar>

      <div
        className="w-full max-w-[480px] mx-auto min-h-screen flex flex-col px-5 pt-5 gap-5"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex flex-col gap-2 pb-6">
          {INVENTORY_ITEMS.map(item => (
            <InventoryRow key={item.id} item={item} dark={dark} showModified={!isCU} showChangeQr={!isCU} />
          ))}
          {INVENTORY_ITEMS.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Package size={36} style={{ color: textMuted, opacity: 0.4 }} />
              <p className="text-sm" style={{ color: textMuted }}>No records found.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Loading Inspection — Allocate + Damage (BR-06 / BR-07) ───────────────────

/** Overall shipment ±10% volume tolerance (FR-07.3). */
const LOADING_VOLUME_TOLERANCE = 0.1;

/** Demo declared/permitted volume for the active loading shipment (m³). */
const LOADING_DECLARED_VOLUME_M3 = 12;

interface LoadingPoolLog {
  code: string;
  serialNo: string;
  productName: string;
  volume: number;
}

interface AllocatedLoadedLog {
  id: string;
  code: string;
  serialNo: string;
  productName: string;
  volume: number;
  scannedAt: string;
  bargeStackId: string;
  bargeStackLabel: string;
  /** True when reported damaged and excluded from loaded volume (FR-07.2). */
  excluded: boolean;
}

interface BargeStack {
  id: string;
  label: string;
  loadType?: string;
  capacity?: string;
}

const DEFAULT_BARGE_STACKS: BargeStack[] = [
  { id: "barge-b-204", label: "Barge B-204 (Deck Load)", loadType: "Barge", capacity: "120" },
  { id: "barge-b-205", label: "Barge B-205 (Hold A)", loadType: "Barge", capacity: "180" },
  { id: "stack-s-12", label: "Stack S-12 (Port side)", loadType: "Stack", capacity: "80" },
  { id: "stack-s-08", label: "Stack S-08 (Starboard)", loadType: "Stack", capacity: "75" },
];

const BARGE_LOAD_TYPES = ["Barge", "Stack"] as const;

interface DamagedLoadedLog {
  id: string;
  code: string;
  serialNo: string;
  productName: string;
  volume: number;
  scannedAt: string;
  damageType: string;
  notes: string;
  evidenceCount: number;
}

interface PendingDamageScan {
  code: string;
  serialNo: string;
  productName: string;
  volume: number;
  scannedAt: string;
}

interface LoadingDamageNc {
  raised: boolean;
  variancePct: number;
  loadedVolume: number;
  declaredVolume: number;
  excludedVolume: number;
  notifiedClient: boolean;
}

type LoadingScanMode = "allocate" | "damage";

const LOADING_QR_POOL: LoadingPoolLog[] = [
  { code: "SSC-LD-0000000101", serialNo: "151-651RN-0000000101", productName: "Taun", volume: 2.45 },
  { code: "SSC-LD-0000000102", serialNo: "151-651RN-0000000102", productName: "Kwila", volume: 2.16 },
  { code: "SSC-LD-0000000103", serialNo: "151-651RN-0000000103", productName: "Erima", volume: 1.98 },
  { code: "SSC-LD-0000000104", serialNo: "151-651RN-0000000104", productName: "Calophyllum", volume: 2.28 },
  { code: "SSC-LD-0000000105", serialNo: "151-651RN-0000000105", productName: "Burckella", volume: 2.12 },
  { code: "SSC-LD-0000000106", serialNo: "151-651RN-0000000106", productName: "Malas", volume: 1.81 },
];

function formatVolumeM3(value: number): string {
  return `${value.toFixed(3)} m³`;
}

function calcLoadingVolumeStats(
  allocated: AllocatedLoadedLog[],
  damaged: DamagedLoadedLog[],
  declaredVolume: number,
) {
  const loadedVolume = allocated.filter(l => !l.excluded).reduce((sum, l) => sum + l.volume, 0);
  const excludedVolume = damaged.reduce((sum, l) => sum + l.volume, 0);
  const variancePct = declaredVolume > 0 ? ((loadedVolume - declaredVolume) / declaredVolume) * 100 : 0;
  const outsideTolerance = Math.abs(variancePct) > LOADING_VOLUME_TOLERANCE * 100;
  return { loadedVolume, excludedVolume, variancePct, outsideTolerance };
}

function DamageReportDialog({
  pending,
  overlayBox,
  onCancel,
  onSave,
}: {
  pending: PendingDamageScan;
  overlayBox: { top: number; left: number; width: number; height: number };
  onCancel: () => void;
  onSave: (damageType: string, notes: string, evidenceCount: number) => void;
}) {
  const [damageType, setDamageType] = useState("");
  const [notes, setNotes] = useState("");
  const [evidencePhotos, setEvidencePhotos] = useState<EvidencePhoto[]>([]);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const evidencePhotosRef = useRef(evidencePhotos);
  evidencePhotosRef.current = evidencePhotos;
  const canSave = Boolean(damageType.trim());

  useEffect(() => {
    return () => {
      evidencePhotosRef.current.forEach(photo => URL.revokeObjectURL(photo.previewUrl));
    };
  }, []);

  const clearEvidencePhotos = () => {
    setEvidencePhotos(prev => {
      prev.forEach(photo => URL.revokeObjectURL(photo.previewUrl));
      return [];
    });
    setEvidenceError(null);
  };

  const removeEvidencePhoto = (id: string) => {
    setEvidencePhotos(prev => {
      const target = prev.find(photo => photo.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter(photo => photo.id !== id);
    });
  };

  const handleEvidencePicked = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    event.target.value = "";
    setPhotoSheetOpen(false);
    if (!files?.length) return;

    const accepted: EvidencePhoto[] = [];
    let error: string | null = null;
    Array.from(files).forEach(file => {
      const ext = file.name.includes(".")
        ? file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase()
        : "";
      const isImage = file.type.startsWith("image/") || ACCEPTED_EVIDENCE_EXTS.includes(ext);
      if (!isImage) {
        error = "Unsupported file type. Choose a JPG, PNG, or WEBP image.";
        return;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        error = `${file.name || "That photo"} is ${formatAttachmentSize(file.size)}. The limit is 10 MB.`;
        return;
      }
      accepted.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name || `Photo ${accepted.length + 1}.jpg`,
        previewUrl: URL.createObjectURL(file),
        size: formatAttachmentSize(file.size),
      });
    });

    if (error) setEvidenceError(error);
    else setEvidenceError(null);
    if (accepted.length) setEvidencePhotos(prev => [...prev, ...accepted]);
  };

  const handleCancel = () => {
    clearEvidencePhotos();
    onCancel();
  };

  const handleSave = () => {
    const count = evidencePhotos.length;
    onSave(damageType.trim(), notes.trim(), count);
  };

  return createPortal(
    <div
      className="z-[70] flex flex-col justify-end"
      style={{
        position: "fixed",
        top: overlayBox.top,
        left: overlayBox.left,
        width: overlayBox.width,
        height: overlayBox.height,
      }}
    >
      <button
        type="button"
        className="absolute inset-0 border-0 p-0 cursor-default"
        style={{
          background: "rgba(10,22,70,0.45)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
        aria-label="Close"
        onClick={handleCancel}
      />
      <div
        className="relative z-10 w-full rounded-t-[28px] px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col gap-4 animate-sheetUp max-h-[88%] overflow-y-auto"
        style={{ background: "#ffffff", boxShadow: "0 -12px 40px rgba(15,47,143,0.18)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Report damaged log"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col items-center gap-3 animate-riseIn" style={{ ["--rise-delay" as string]: "40ms" }}>
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(15,47,143,0.18)" }} />
          <div className="w-full flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#d4183d" }}>
                Damage report
              </p>
              <p className="text-[16px] font-bold mt-0.5" style={{ color: "#0a1a4a" }}>
                What happened to this log?
              </p>
            </div>
            <button
              type="button"
              onClick={handleCancel}
              className="w-8 h-8 rounded-xl flex items-center justify-center focus:outline-none flex-shrink-0"
              style={{ background: "rgba(15,47,143,0.08)", color: "#0f2f8f" }}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div
          className="rounded-2xl px-3.5 py-3 flex flex-col gap-1 animate-riseIn"
          style={{
            background: "rgba(212,24,61,0.06)",
            border: "1px solid rgba(212,24,61,0.16)",
            ["--rise-delay" as string]: "90ms",
          }}
        >
          <p className="text-[12px] font-bold truncate" style={{ color: "#0a1a4a" }}>{pending.code}</p>
          <p className="text-[11px] truncate" style={{ color: "#5a6a99" }}>
            {pending.serialNo} · {pending.productName}
          </p>
          <p className="text-[11px] font-semibold tabular-nums" style={{ color: "#d4183d" }}>
            Won&apos;t count toward loaded total · {formatVolumeM3(pending.volume)}
          </p>
        </div>

        <div className="flex flex-col gap-1.5 animate-riseIn" style={{ ["--rise-delay" as string]: "140ms" }}>
          <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#5a6a99" }}>
            Damage reason <span style={{ color: "#d4183d" }}>*</span>
          </label>
          <input
            type="text"
            value={damageType}
            onChange={e => setDamageType(e.target.value)}
            placeholder="e.g. Split end, crack, insect damage…"
            className="w-full px-4 py-3.5 text-sm rounded-xl focus:outline-none"
            style={{
              background: "#f8faff",
              border: "1.5px solid rgba(15,47,143,0.14)",
              color: "#0a1a4a",
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5 animate-riseIn" style={{ ["--rise-delay" as string]: "190ms" }}>
          <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#5a6a99" }}>
            Notes
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Describe the damage…"
            className="w-full p-3 text-[13px] rounded-xl focus:outline-none resize-none"
            style={{
              background: "#f8faff",
              border: "1px solid rgba(15,47,143,0.14)",
              color: "#0a1a4a",
            }}
          />
        </div>

        <div className="flex flex-col gap-2.5 animate-riseIn" style={{ ["--rise-delay" as string]: "240ms" }}>
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#5a6a99" }}>
            Evidence Photos
          </p>
          <button
            type="button"
            onClick={() => setPhotoSheetOpen(true)}
            className="rounded-2xl px-4 py-5 flex flex-col items-center justify-center gap-2 focus:outline-none active:scale-[0.99] transition-all"
            style={{
              background: "#ffffff",
              border: "2px dashed rgba(15,47,143,0.22)",
              boxShadow: "0 2px 12px rgba(15,47,143,0.04)",
            }}
          >
            <span
              className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(15,47,143,0.08)", color: "#0f2f8f" }}
            >
              <Camera size={20} />
            </span>
            <span className="text-[13px] font-bold" style={{ color: "#0a1a4a" }}>
              Add Evidence Photo
            </span>
            <span className="text-[11px] font-medium text-center" style={{ color: "#5a6a99" }}>
              Take a photo or upload from gallery
            </span>
          </button>

          {evidenceError && (
            <p className="text-[11px] font-medium px-0.5" style={{ color: "#d4183d" }} role="alert">
              {evidenceError}
            </p>
          )}

          {evidencePhotos.length > 0 && (
            <div className="flex flex-col gap-2 animate-riseIn">
              <div className="flex items-center justify-between px-0.5">
                <p className="text-[11px] font-semibold" style={{ color: "#5a6a99" }}>
                  {evidencePhotos.length} photo{evidencePhotos.length === 1 ? "" : "s"} attached
                </p>
                <button
                  type="button"
                  onClick={clearEvidencePhotos}
                  className="text-[11px] font-semibold focus:outline-none active:opacity-70"
                  style={{ color: "#0f2f8f" }}
                >
                  Clear all
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {evidencePhotos.map((photo, i) => (
                  <div
                    key={photo.id}
                    className="relative aspect-square rounded-xl overflow-hidden animate-riseIn"
                    style={{
                      ["--rise-delay" as string]: `${40 + i * 40}ms`,
                      background: "#ffffff",
                      border: "1px solid rgba(15,47,143,0.12)",
                      boxShadow: "0 2px 8px rgba(15,47,143,0.06)",
                    }}
                  >
                    <img src={photo.previewUrl} alt={photo.name} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeEvidencePhoto(photo.id)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center focus:outline-none active:scale-95"
                      style={{ background: "rgba(10,26,74,0.72)", color: "#ffffff" }}
                      aria-label={`Remove ${photo.name}`}
                    >
                      <X size={12} strokeWidth={2.5} />
                    </button>
                    <div
                      className="absolute inset-x-0 bottom-0 px-1.5 py-1"
                      style={{ background: "linear-gradient(180deg, transparent, rgba(10,26,74,0.72))" }}
                    >
                      <p className="text-[9px] font-medium text-white truncate">{photo.size}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 animate-riseIn" style={{ ["--rise-delay" as string]: "290ms" }}>
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 h-12 rounded-xl text-sm font-semibold focus:outline-none active:scale-[0.98]"
            style={{ background: "#ffffff", color: "#0a1a4a", border: "1px solid rgba(15,47,143,0.22)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            className="flex-1 h-12 rounded-xl text-sm font-bold text-white focus:outline-none active:scale-[0.98] disabled:opacity-45"
            style={{ background: GRADIENT, boxShadow: canSave ? "0 4px 16px rgba(15,47,143,0.32)" : "none" }}
          >
            Save & remove
          </button>
        </div>
      </div>

      {photoSheetOpen && (
        <div
          className="absolute inset-0 z-20 flex flex-col justify-end"
          style={{ pointerEvents: "auto" }}
        >
          <button
            type="button"
            className="absolute inset-0 border-0 p-0 cursor-default"
            style={{
              background: "rgba(10,22,70,0.45)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
            aria-label="Close"
            onClick={() => setPhotoSheetOpen(false)}
          />
          <div
            className="relative z-10 w-full rounded-t-[28px] px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col gap-5 animate-sheetUp"
            style={{
              background: "#ffffff",
              boxShadow: "0 -12px 40px rgba(15,47,143,0.18)",
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Add evidence photo"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-1 rounded-full" style={{ background: "rgba(15,47,143,0.18)" }} />
              <div className="w-full flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#5a6a99" }}>
                  Add Evidence Photo
                </p>
                <button
                  type="button"
                  onClick={() => setPhotoSheetOpen(false)}
                  className="field-touch w-12 h-12 rounded-xl flex items-center justify-center focus:outline-none"
                  style={{ background: "rgba(15,47,143,0.08)", color: "#0f2f8f" }}
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#5a6a99" }}>
                Source
              </p>
              <label
                className="w-full h-12 rounded-2xl px-4 flex items-center gap-3 text-left focus-within:outline-none active:scale-[0.99] transition-all cursor-pointer"
                style={{
                  background: "#ffffff",
                  border: "1.5px solid rgba(15,47,143,0.12)",
                  boxShadow: "0 2px 10px rgba(15,47,143,0.04)",
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleEvidencePicked}
                  className="sr-only"
                />
                <span
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(15,47,143,0.08)", color: "#0f2f8f" }}
                >
                  <Camera size={16} />
                </span>
                <span className="flex-1 min-w-0 text-sm font-semibold" style={{ color: "#0a1a4a" }}>
                  Take Photo
                </span>
                <ChevronRight size={16} style={{ color: "#5a6a99" }} />
              </label>
              <label
                className="w-full h-12 rounded-2xl px-4 flex items-center gap-3 text-left focus-within:outline-none active:scale-[0.99] transition-all cursor-pointer"
                style={{
                  background: "#ffffff",
                  border: "1.5px solid rgba(15,47,143,0.12)",
                  boxShadow: "0 2px 10px rgba(15,47,143,0.04)",
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleEvidencePicked}
                  className="sr-only"
                />
                <span
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(15,47,143,0.08)", color: "#0f2f8f" }}
                >
                  <ImageIcon size={16} />
                </span>
                <span className="flex-1 min-w-0 text-sm font-semibold" style={{ color: "#0a1a4a" }}>
                  Upload from Gallery
                </span>
                <ChevronRight size={16} style={{ color: "#5a6a99" }} />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

function LoadingVerifyStepper({
  activeStep,
  allocateComplete,
  damageComplete,
  onStepSelect,
}: {
  activeStep: LoadingScanMode;
  allocateComplete: boolean;
  damageComplete: boolean;
  onStepSelect: (step: LoadingScanMode) => void;
}) {
  const steps = [
    { id: "allocate" as const, label: "Load logs", hint: "Scan each log as it is loaded", icon: Container },
    { id: "damage" as const, label: "Damaged logs", hint: "Scan and report any damaged logs", icon: AlertTriangle },
  ];

  return (
    <VerificationStepPicker
      steps={steps}
      activeStep={activeStep}
      stepComplete={[allocateComplete, damageComplete]}
      onStepSelect={onStepSelect}
      allDoneTitle="Loading inspection complete"
      tablistLabel="Loading steps"
    />
  );
}

const LOADING_NON_COMPLIANCE_TYPES = [
  "Damaged logs pushed loaded volume outside ±10%",
  "Loaded volume outside permitted shipment tolerance",
  "Incorrect barge/stack allocation",
  "Log details discrepancy during loading",
  "Undeclared / shutout logs",
  "Other",
];

type LoadingInspectionTab = "loading" | "non-compliance" | "attachments";

interface FiledLoadingNc {
  id: string;
  description: string;
  types: string[];
  auto: boolean;
  createdAt: string;
}

function LoadingLogsScanScreen({
  scanCount,
  allocatedLogs,
  damagedLogs,
  damageNc,
  declaredVolume,
  autoStart,
  onBack,
  onAllocated,
  onDamageSaved,
  onScanConsumed,
  onComplete,
  viewOnly = false,
  dark = false,
}: {
  scanCount: number;
  allocatedLogs: AllocatedLoadedLog[];
  damagedLogs: DamagedLoadedLog[];
  damageNc: LoadingDamageNc | null;
  declaredVolume: number;
  autoStart: boolean;
  onBack: () => void;
  onAllocated: (entry: AllocatedLoadedLog) => void;
  onDamageSaved: (entry: DamagedLoadedLog) => void;
  onScanConsumed: () => void;
  onComplete: () => void;
  viewOnly?: boolean;
  dark?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<LoadingInspectionTab>("loading");
  const [mode, setMode] = useState<LoadingScanMode>("allocate");
  const [damageStepVisited, setDamageStepVisited] = useState(false);
  const [phase, setPhase] = useState<ScannerPhase>("idle");
  const [pendingDamage, setPendingDamage] = useState<PendingDamageScan | null>(null);
  const [overlayBox, setOverlayBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [toast, setToast] = useState<ScanToast | null>(null);
  const [ncView, setNcView] = useState<NonComplianceView>("list");
  const [selectedNcTypes, setSelectedNcTypes] = useState<string[]>([]);
  const [ncDescription, setNcDescription] = useState("");
  const [evidencePhotos, setEvidencePhotos] = useState<EvidencePhoto[]>([]);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [evidenceSheetOpen, setEvidenceSheetOpen] = useState(false);
  const [photoSheetPurpose, setPhotoSheetPurpose] = useState<"evidence" | "attachment">("evidence");
  const [evidenceSheetBox, setEvidenceSheetBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [attachments, setAttachments] = useState<AttachmentFile[]>(ATTACHMENT_FILES);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [filedNcs, setFiledNcs] = useState<FiledLoadingNc[]>([]);
  const [bargeStacks, setBargeStacks] = useState<BargeStack[]>(DEFAULT_BARGE_STACKS);
  const [selectedBargeId, setSelectedBargeId] = useState<string | null>(null);
  const [bargePickerOpen, setBargePickerOpen] = useState(false);
  const [newBargeOpen, setNewBargeOpen] = useState(false);
  const [newBargeName, setNewBargeName] = useState("");
  const [newBargeLoadType, setNewBargeLoadType] = useState("");
  const [loadTypeOpen, setLoadTypeOpen] = useState(false);
  const [volumeFlash, setVolumeFlash] = useState(false);
  const [finishPulse, setFinishPulse] = useState(false);
  const evidencePhotosRef = useRef(evidencePhotos);
  evidencePhotosRef.current = evidencePhotos;
  const handledDetection = useRef(false);
  const autoNcSeeded = useRef(false);

  const next = LOADING_QR_POOL[scanCount % LOADING_QR_POOL.length];
  const stats = calcLoadingVolumeStats(allocatedLogs, damagedLogs, declaredVolume);
  const activeCount = allocatedLogs.filter(l => !l.excluded).length;
  const isDamageMode = mode === "damage";
  const allocateComplete = allocatedLogs.length > 0;
  const damageComplete = damageStepVisited || damagedLogs.length > 0;
  const selectedBarge = bargeStacks.find(b => b.id === selectedBargeId) ?? null;
  const bargeReady = isDamageMode || selectedBargeId !== null;
  const scanningActive = !viewOnly && activeTab === "loading" && bargeReady;

  const syncOverlayBox = () => {
    const device = document.querySelector(".mobile-device");
    if (device) {
      const r = device.getBoundingClientRect();
      setOverlayBox({ top: r.top, left: r.left, width: r.width, height: r.height });
    } else {
      setOverlayBox({ top: 0, left: 0, width: window.innerWidth, height: window.innerHeight });
    }
  };

  const syncEvidenceSheetBox = () => {
    const device = document.querySelector(".mobile-device");
    if (device) {
      const r = device.getBoundingClientRect();
      setEvidenceSheetBox({ top: r.top, left: r.left, width: r.width, height: r.height });
    } else {
      setEvidenceSheetBox({ top: 0, left: 0, width: window.innerWidth, height: window.innerHeight });
    }
  };

  useEffect(() => {
    if (!newBargeOpen) return;
    syncOverlayBox();
    window.addEventListener("resize", syncOverlayBox);
    return () => window.removeEventListener("resize", syncOverlayBox);
  }, [newBargeOpen]);

  useEffect(() => {
    if (!damageNc?.raised || autoNcSeeded.current) return;
    autoNcSeeded.current = true;
    setFiledNcs(prev => {
      if (prev.some(n => n.auto)) return prev;
      return [
        {
          id: `auto-nc-${Date.now()}`,
          description: `Loaded volume dropped below the allowed limit after removing damaged logs. Client notified.`,
          types: ["Damaged logs pushed loaded volume outside ±10%"],
          auto: true,
          createdAt: formatScanTime(new Date()),
        },
        ...prev,
      ];
    });
  }, [damageNc]);

  useEffect(() => {
    if (!bargeReady && !isDamageMode && phase === "scanning") {
      setPhase("idle");
    }
  }, [bargeReady, isDamageMode, phase]);

  useEffect(() => {
    if (!scanningActive || phase !== "scanning" || pendingDamage) return;
    handledDetection.current = false;
    const timer = setTimeout(() => setPhase("detected"), SCAN_DETECT_MS);
    return () => clearTimeout(timer);
  }, [phase, pendingDamage, scanCount, mode, scanningActive]);

  useEffect(() => {
    if (!scanningActive || phase !== "detected" || pendingDamage) return;
    if (handledDetection.current) return;
    handledDetection.current = true;
    const timer = setTimeout(() => {
      const scannedAt = formatScanTime(new Date());
      if (isDamageMode) {
        if (damagedLogs.some(d => d.code === next.code)) {
          setToast({ message: `${next.code} already reported as damaged`, tone: "duplicate" });
          onScanConsumed();
          setPhase("idle");
          return;
        }
        syncOverlayBox();
        setPendingDamage({
          code: next.code,
          serialNo: next.serialNo,
          productName: next.productName,
          volume: next.volume,
          scannedAt,
        });
        onScanConsumed();
        setPhase("idle");
        return;
      }

      if (allocatedLogs.some(l => l.code === next.code) || damagedLogs.some(d => d.code === next.code)) {
        setToast({
          message: damagedLogs.some(d => d.code === next.code)
            ? `${next.code} excluded (damaged)`
            : `${next.code} already allocated`,
          tone: "duplicate",
        });
        onScanConsumed();
        setPhase("idle");
        return;
      }

      onAllocated({
        id: `${next.code}-${Date.now()}`,
        code: next.code,
        serialNo: next.serialNo,
        productName: next.productName,
        volume: next.volume,
        scannedAt,
        bargeStackId: selectedBargeId ?? "",
        bargeStackLabel: selectedBarge?.label ?? "",
        excluded: false,
      });
      setToast({ message: `${next.code} allocated · ${formatVolumeM3(next.volume)}`, tone: "success" });
      setPhase("idle");
    }, SCAN_CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [phase, pendingDamage, next, isDamageMode, allocatedLogs, damagedLogs, onAllocated, onScanConsumed, scanningActive]);

  useEffect(() => {
    if (!pendingDamage) return;
    syncOverlayBox();
    window.addEventListener("resize", syncOverlayBox);
    return () => window.removeEventListener("resize", syncOverlayBox);
  }, [pendingDamage]);

  useEffect(() => {
    if (!toast) return;
    const holdMs = toast.tone === "duplicate" ? SCAN_DUPLICATE_TOAST_MS : SCAN_TOAST_MS;
    const timer = setTimeout(() => setToast(null), holdMs);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!evidenceSheetOpen) return;
    syncEvidenceSheetBox();
    window.addEventListener("resize", syncEvidenceSheetBox);
    return () => window.removeEventListener("resize", syncEvidenceSheetBox);
  }, [evidenceSheetOpen]);

  useEffect(() => {
    return () => {
      evidencePhotosRef.current.forEach(photo => URL.revokeObjectURL(photo.previewUrl));
    };
  }, []);

  const switchMode = (nextMode: LoadingScanMode) => {
    if (viewOnly) return;
    if (nextMode === "damage") setDamageStepVisited(true);
    if (nextMode === mode) return;
    setPendingDamage(null);
    setMode(nextMode);
    setPhase("idle");
  };

  const closeDamage = () => {
    setPendingDamage(null);
    setPhase("idle");
  };

  const saveDamage = (damageType: string, notes: string, evidenceCount: number) => {
    if (!pendingDamage) return;
    onDamageSaved({
      id: `${pendingDamage.code}-${Date.now()}`,
      code: pendingDamage.code,
      serialNo: pendingDamage.serialNo,
      productName: pendingDamage.productName,
      volume: pendingDamage.volume,
      scannedAt: pendingDamage.scannedAt,
      damageType,
      notes,
      evidenceCount,
    });
    setToast({ message: `${pendingDamage.code} excluded from loaded volume`, tone: "success" });
    setPendingDamage(null);
    setPhase("idle");
    setVolumeFlash(true);
    window.setTimeout(() => setVolumeFlash(false), 950);
  };

  const loadingCompletionGate = evaluateLoadingCompletion(activeCount);
  const canFinishLoading = viewOnly || loadingCompletionGate.canComplete;

  const runFinishComplete = () => {
    if (viewOnly) {
      onBack();
      return;
    }
    if (!loadingCompletionGate.canComplete) return;
    onComplete();
  };

  const clearEvidencePhotos = () => {
    setEvidencePhotos(prev => {
      prev.forEach(photo => URL.revokeObjectURL(photo.previewUrl));
      return [];
    });
    setEvidenceError(null);
  };

  const openEvidenceSheet = () => {
    if (viewOnly) return;
    setPhotoSheetPurpose("evidence");
    syncEvidenceSheetBox();
    setEvidenceSheetOpen(true);
  };

  const openAttachmentSheet = () => {
    if (viewOnly) return;
    setPhotoSheetPurpose("attachment");
    syncEvidenceSheetBox();
    setEvidenceSheetOpen(true);
  };

  const closeEvidenceSheet = () => setEvidenceSheetOpen(false);

  const handleAttachmentPicked = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    closeEvidenceSheet();
    if (!file) return;
    const rawExt = file.name.includes(".")
      ? file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase()
      : "";
    const ext =
      rawExt ||
      (file.type === "image/png" ? "png" : file.type.startsWith("image/") ? "jpg" : "");
    if (!ACCEPTED_ATTACHMENT_EXTS.includes(ext)) {
      setAttachmentError("Unsupported file type. Choose a JPG, PNG, or PDF.");
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachmentError(`That file is ${formatAttachmentSize(file.size)}. The limit is 10 MB.`);
      return;
    }
    setAttachmentError(null);
    setAttachments(prev => [
      ...prev,
      {
        fileName: file.name || `Photo ${prev.length + 1}.${ext}`,
        category: ext === "pdf" ? "DOCUMENT" : "PHOTO",
        uploaded: new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }),
        size: formatAttachmentSize(file.size),
      },
    ]);
  };

  const handleEvidencePicked = (event: ChangeEvent<HTMLInputElement>) => {
    if (photoSheetPurpose === "attachment") {
      handleAttachmentPicked(event);
      return;
    }
    const files = event.target.files;
    event.target.value = "";
    closeEvidenceSheet();
    if (!files?.length) return;

    const accepted: EvidencePhoto[] = [];
    let error: string | null = null;
    Array.from(files).forEach(file => {
      const ext = file.name.includes(".")
        ? file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase()
        : "";
      const isImage = file.type.startsWith("image/") || ACCEPTED_EVIDENCE_EXTS.includes(ext);
      if (!isImage) {
        error = "Unsupported file type. Choose a JPG, PNG, or WEBP image.";
        return;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        error = `${file.name || "That photo"} is ${formatAttachmentSize(file.size)}. The limit is 10 MB.`;
        return;
      }
      accepted.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name || `Photo ${accepted.length + 1}.jpg`,
        previewUrl: URL.createObjectURL(file),
        size: formatAttachmentSize(file.size),
      });
    });
    if (error) setEvidenceError(error);
    else setEvidenceError(null);
    if (accepted.length) setEvidencePhotos(prev => [...prev, ...accepted]);
  };

  const removeEvidencePhoto = (id: string) => {
    setEvidencePhotos(prev => {
      const target = prev.find(photo => photo.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter(photo => photo.id !== id);
    });
  };

  const handleBack = () => {
    if (activeTab === "non-compliance" && ncView === "create") {
      setNcView("list");
      return;
    }
    onBack();
  };

  const saveNewBarge = () => {
    const label = newBargeName.trim();
    if (!label) return;
    const id = `barge-${Date.now()}`;
    setBargeStacks(prev => [
      ...prev,
      {
        id,
        label,
        loadType: newBargeLoadType || undefined,
      },
    ]);
    setSelectedBargeId(id);
    setBargePickerOpen(false);
    setNewBargeOpen(false);
    setNewBargeName("");
    setNewBargeLoadType("");
    setLoadTypeOpen(false);
    setPhase("idle");
    setToast({ message: `Added ${label} — tap the scanner when ready`, tone: "info" });
  };

  const openNewBargeForm = () => {
    if (viewOnly) return;
    setNewBargeName("");
    setNewBargeLoadType("");
    setLoadTypeOpen(false);
    syncOverlayBox();
    setNewBargeOpen(true);
  };

  const detected = phase === "detected";
  const scanning = phase === "scanning";
  const frameColor = detected
    ? (isDamageMode ? "#d4183d" : "#16a34a")
    : scanning
      ? (dark ? "#93c5fd" : "#0f2f8f")
      : (dark ? "rgba(255,255,255,0.28)" : "#c3cee6");
  const swipe = useSwipeBack(handleBack);

  const pageBg = dark
    ? "linear-gradient(165deg, #0b1224 0%, #0f172a 42%, #111827 100%)"
    : undefined;
  const textPrimary = dark ? "#ffffff" : "#0a1a4a";
  const textMuted = dark ? "rgba(255,255,255,0.78)" : FIELD_TEXT_MUTED;
  const cardBg = dark ? "rgba(30, 41, 59, 0.78)" : "#ffffff";
  const cardBorder = dark ? "rgba(255,255,255,0.14)" : "rgba(15,47,143,0.16)";
  const cardShadow = dark ? "0 2px 12px rgba(0,0,0,0.28)" : "0 2px 12px rgba(15,47,143,0.06)";
  const chipBg = dark ? "rgba(255,255,255,0.08)" : "#e8edf9";
  const fieldBg = dark ? "rgba(15, 23, 42, 0.85)" : "#f8faff";
  const fieldBorder = dark ? "rgba(255,255,255,0.16)" : "rgba(15,47,143,0.22)";
  const dashedBorder = dark ? "rgba(255,255,255,0.22)" : "rgba(15,47,143,0.28)";
  const iconMutedBg = dark ? "rgba(255,255,255,0.10)" : "rgba(15,47,143,0.08)";
  const accent = dark ? "#93c5fd" : "#0f2f8f";
  const subtleText = dark ? "rgba(255,255,255,0.55)" : FIELD_TEXT_FAINT;
  const rowGlass = dark
    ? {
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        background: "rgba(30, 41, 59, 0.72)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 8px 28px rgba(0,0,0,0.28)",
      }
    : SCAN_GLASS;

  const tabs: { id: LoadingInspectionTab; label: string; short: string; badge?: number }[] = [
    { id: "loading", label: "Scan logs", short: "Scan" },
    { id: "non-compliance", label: "NC", short: "NC", badge: filedNcs.length || undefined },
    { id: "attachments", label: "Files", short: "Files", badge: attachments.length || undefined },
  ];

  const loadedLogs = allocatedLogs.filter(l => !l.excluded);
  const stepHint = !bargeReady && !isDamageMode
    ? "Choose where logs are going first, then scan"
    : phase === "scanning"
      ? isDamageMode
        ? "Scanning damaged log QR code…"
        : `Scanning to ${selectedBarge?.label ?? "selected barge"}`
      : isDamageMode
        ? "Tap the scanner when you see a damaged log"
        : null;
  const volumeStatus = stats.outsideTolerance
    ? { label: "Outside limit — review needed", color: "#d4183d", bg: "rgba(212,24,61,0.08)" }
    : activeCount > 0
      ? { label: "On track", color: "#16a34a", bg: "rgba(22,163,74,0.08)" }
      : { label: "Tap scanner to begin", color: textMuted, bg: chipBg };
  const loadedAnim = useCountUp(stats.loadedVolume, 520, `${stats.loadedVolume}-${activeCount}`);
  const declaredAnim = useCountUp(declaredVolume, 640, declaredVolume);

  return (
    <div
      className={`h-full-screen w-full flex flex-col overflow-hidden animate-fadeIn ${dark ? "" : "inspection-surface"}`}
      style={{ fontFamily: "'Inter', sans-serif", background: pageBg }}
      {...swipe}
    >
      <AppHeaderBar dark={dark}>
        <div className="flex items-center gap-3 min-w-0">
          <BackCardButton onClick={handleBack} dark={dark} />
          <div className="min-w-0">
            <h1 className="text-[16px] sm:text-[18px] font-bold tracking-tight truncate" style={{ color: textPrimary }}>
              Loading Inspection
            </h1>
            {activeTab === "loading" && (
              <p className="text-[11px] truncate mt-0.5" style={{ color: textMuted }}>
                {isDamageMode ? "Step 2 · Report damaged logs" : "Step 1 · Scan loaded logs"}
              </p>
            )}
          </div>
        </div>
      </AppHeaderBar>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div
          className="w-full max-w-[480px] mx-auto flex flex-col px-4 sm:px-5 pt-4 sm:pt-5 gap-4"
          style={{ paddingBottom: BOTTOM_NAV_PAD }}
        >
          <LiquidTabBar
            ariaLabel="Loading sections"
            dark={dark}
            value={activeTab}
            onChange={id => {
              const nextTab = id as LoadingInspectionTab;
              setActiveTab(nextTab);
              if (nextTab !== "non-compliance") setNcView("list");
              if (nextTab !== "loading") {
                setPendingDamage(null);
                setPhase("idle");
              } else {
                setPhase("idle");
              }
            }}
            items={tabs.map(tab => ({
              id: tab.id,
              node: (
                <span className="relative inline-flex items-center justify-center gap-1 min-w-0 px-0.5">
                  <span className="sm:hidden truncate">{tab.short}</span>
                  <span className="hidden sm:inline truncate">{tab.label}</span>
                  {tab.badge ? (
                    <span
                      className="min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
                      style={{
                        background: activeTab === tab.id ? "rgba(255,255,255,0.92)" : "#0f2f8f",
                        color: activeTab === tab.id ? "#0f2f8f" : "#ffffff",
                      }}
                    >
                      {tab.badge}
                    </span>
                  ) : null}
                </span>
              ),
            }))}
          />

          {activeTab === "loading" && (
            <div key="loading" className="flex flex-col gap-4 animate-panelIn">
              <LoadingVerifyStepper
                activeStep={mode}
                allocateComplete={allocateComplete}
                damageComplete={damageComplete}
                onStepSelect={switchMode}
              />

              <div
                className={`rounded-2xl p-3.5 sm:p-4 flex flex-col gap-3 ${volumeFlash ? "animate-volumeFlash" : ""}`}
                style={{
                  background: cardBg,
                  border: `1px solid ${stats.outsideTolerance || volumeFlash ? "rgba(212,24,61,0.28)" : cardBorder}`,
                  boxShadow: cardShadow,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-bold" style={{ color: textPrimary }}>
                    Loaded volume
                  </p>
                  <span
                    className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0"
                    style={{ background: volumeStatus.bg, color: volumeStatus.color }}
                  >
                    {volumeStatus.label}
                  </span>
                </div>

                <div className="flex items-end gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[22px] font-bold leading-none tabular-nums" style={{ color: textPrimary }}>
                      {formatVolumeM3(loadedAnim)}
                    </p>
                    <p className="text-[11px] mt-1.5" style={{ color: textMuted }}>loaded so far</p>
                  </div>
                  <ArrowRight size={16} className="mb-3 flex-shrink-0" style={{ color: subtleText }} />
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-[22px] font-bold leading-none tabular-nums" style={{ color: textMuted }}>
                      {formatVolumeM3(declaredAnim)}
                    </p>
                    <p className="text-[11px] mt-1.5" style={{ color: textMuted }}>expected total</p>
                  </div>
                </div>

                <div className="volume-meter-track" aria-hidden="true">
                  <div
                    className="volume-meter-fill"
                    style={{
                      width: `${Math.min(100, declaredVolume > 0 ? (loadedAnim / declaredVolume) * 100 : 0)}%`,
                      background: stats.outsideTolerance
                        ? "linear-gradient(90deg, #f87171, #d4183d)"
                        : GRADIENT,
                    }}
                  />
                </div>

                <div
                  className="grid grid-cols-2 gap-2 rounded-xl px-3 py-2.5"
                  style={{ background: chipBg, border: `1px solid ${cardBorder}` }}
                >
                  <div>
                    <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>Logs scanned</p>
                    <p className="text-[15px] font-bold tabular-nums mt-0.5" style={{ color: textPrimary }}>{activeCount}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>Damaged</p>
                    <p className="text-[15px] font-bold tabular-nums mt-0.5" style={{ color: damagedLogs.length ? "#d4183d" : textPrimary }}>
                      {damagedLogs.length}
                    </p>
                  </div>
                </div>

                {stats.outsideTolerance ? (
                  <p className="text-[11px] leading-snug" style={{ color: "#d4183d" }}>
                    Loaded volume is more than ±10% off expected. Check the NC tab.
                  </p>
                ) : null}
              </div>

              {!isDamageMode && (
                <div
                  className="rounded-2xl p-3.5 sm:p-4 flex flex-col gap-3"
                  style={{
                    background: cardBg,
                    border: `1px solid ${cardBorder}`,
                    boxShadow: cardShadow,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[14px] font-bold leading-snug" style={{ color: textPrimary }}>
                      Allocation Management
                    </p>
                    {!viewOnly && (
                    <button
                      type="button"
                      onClick={openNewBargeForm}
                      className="pressable min-h-12 h-12 px-4 rounded-xl text-[13px] font-bold text-white flex items-center gap-1.5 focus:outline-none flex-shrink-0"
                      style={{ background: GRADIENT, boxShadow: "0 2px 8px rgba(15,47,143,0.28)" }}
                    >
                      <Plus size={16} />
                      New
                    </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-bold" style={{ color: textMuted }}>
                      Select Barge / Stack
                    </label>
                    <button
                      type="button"
                      onClick={() => !viewOnly && setBargePickerOpen(v => !v)}
                      disabled={viewOnly}
                      className="pressable w-full min-h-12 flex items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-sm text-left focus:outline-none disabled:cursor-default"
                      style={{
                        background: fieldBg,
                        border: `1.5px solid ${bargePickerOpen || selectedBarge ? (dark ? "rgba(96,165,250,0.55)" : "rgba(15,47,143,0.35)") : fieldBorder}`,
                        color: selectedBarge ? accent : textMuted,
                      }}
                    >
                      <span className="truncate font-semibold">
                        {selectedBarge?.label ?? "Choose barge or stack…"}
                      </span>
                      <ChevronDown
                        size={16}
                        style={{
                          color: textMuted,
                          transform: bargePickerOpen ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.2s",
                          flexShrink: 0,
                        }}
                      />
                    </button>

                    {bargePickerOpen && (
                      <div
                        className="rounded-2xl overflow-hidden flex flex-col"
                        style={{
                          background: cardBg,
                          border: `1px solid ${cardBorder}`,
                          boxShadow: cardShadow,
                          maxHeight: 200,
                          overflowY: "auto",
                        }}
                      >
                        {bargeStacks.map(stack => {
                          const active = selectedBargeId === stack.id;
                          return (
                            <button
                              key={stack.id}
                              type="button"
                              onClick={() => {
                                setSelectedBargeId(stack.id);
                                setBargePickerOpen(false);
                                setPhase("idle");
                              }}
                              className={`chip-settle pressable w-full text-left px-4 py-3.5 min-h-12 text-sm font-semibold focus:outline-none ${active ? "is-active animate-selectSpring" : ""}`}
                              style={{
                                color: active ? accent : textPrimary,
                                background: active
                                  ? (dark ? "rgba(59,130,246,0.16)" : "rgba(15,47,143,0.08)")
                                  : "transparent",
                                borderBottom: `1px solid ${cardBorder}`,
                                boxShadow: active ? `inset 3px 0 0 ${accent}` : "none",
                              }}
                            >
                              <span className="inline-flex items-center gap-2">
                                {active ? (
                                  <span className="animate-checkPop text-[12px] font-black" style={{ color: accent }}>✓</span>
                                ) : null}
                                {stack.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {!selectedBarge ? (
                    <p className="text-[11px] leading-snug" style={{ color: textMuted }}>
                      Select a destination before scanning logs.
                    </p>
                  ) : null}
                </div>
              )}

              {damageNc?.raised ? (
                <div
                  className="rounded-2xl px-3.5 py-3.5 flex flex-col gap-2.5 animate-riseIn"
                  style={{
                    background: "rgba(212,24,61,0.07)",
                    border: "1px solid rgba(212,24,61,0.28)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} style={{ color: "#d4183d", flexShrink: 0 }} />
                    <p className="text-[13px] font-bold" style={{ color: "#d4183d" }}>
                      Volume issue detected
                    </p>
                  </div>
                  <p className="text-[12px] leading-snug" style={{ color: textMuted }}>
                    Too many damaged logs were removed. The client has been notified.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("non-compliance");
                      setNcView("list");
                    }}
                    className="w-full h-10 rounded-xl text-[12px] font-bold focus:outline-none active:scale-[0.98]"
                    style={{ background: cardBg, color: "#d4183d", border: "1px solid rgba(212,24,61,0.25)" }}
                  >
                    View issue details
                  </button>
                </div>
              ) : null}

              {toast ? (
                <div
                  key={`${toast.tone}-${toast.message}`}
                  role="status"
                  aria-live="polite"
                  className={`flex items-center gap-3 animate-toastIn ${
                    toast.tone === "duplicate"
                      ? "rounded-2xl px-4 py-3.5"
                      : "rounded-xl px-3.5 py-2.5"
                  }`}
                  style={
                    toast.tone === "duplicate"
                      ? {
                          background: dark ? "rgba(69, 10, 10, 0.96)" : "#fff7ed",
                          color: dark ? "#fecaca" : "#9a3412",
                          border: dark
                            ? "2px solid rgba(248, 113, 113, 0.75)"
                            : "2px solid #ea580c",
                          boxShadow: dark
                            ? "0 12px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(254,202,202,0.25)"
                            : "0 12px 28px rgba(194,65,12,0.22), 0 0 0 1px rgba(255,255,255,0.9)",
                          backdropFilter: "blur(14px)",
                          WebkitBackdropFilter: "blur(14px)",
                        }
                      : toast.tone === "success"
                        ? {
                            background: dark ? "rgba(6, 78, 59, 0.94)" : "rgba(236, 253, 245, 0.96)",
                            color: dark ? "#a7f3d0" : "#166534",
                            border: dark
                              ? "1.5px solid rgba(52, 211, 153, 0.55)"
                              : "1.5px solid rgba(22, 163, 74, 0.45)",
                            boxShadow: dark
                              ? "0 10px 26px rgba(0,0,0,0.4)"
                              : "0 10px 24px rgba(22,163,74,0.16)",
                            backdropFilter: "blur(12px)",
                            WebkitBackdropFilter: "blur(12px)",
                          }
                        : {
                            background: dark ? "rgba(30, 41, 59, 0.95)" : "rgba(255,255,255,0.94)",
                            color: accent,
                            border: `1.5px solid ${cardBorder}`,
                            boxShadow: dark
                              ? "0 8px 24px rgba(0,0,0,0.35)"
                              : "0 8px 24px rgba(15,47,143,0.12)",
                            backdropFilter: "blur(12px)",
                            WebkitBackdropFilter: "blur(12px)",
                          }
                  }
                >
                  <span
                    className={`flex-shrink-0 flex items-center justify-center rounded-full ${
                      toast.tone === "duplicate" ? "w-10 h-10" : "w-8 h-8"
                    }`}
                    style={
                      toast.tone === "duplicate"
                        ? {
                            background: dark ? "rgba(248, 113, 113, 0.28)" : "#fed7aa",
                            color: dark ? "#fecaca" : "#c2410c",
                          }
                        : toast.tone === "success"
                          ? {
                              background: dark ? "rgba(52, 211, 153, 0.22)" : "rgba(22, 163, 74, 0.14)",
                              color: dark ? "#a7f3d0" : "#15803d",
                            }
                          : {
                              background: dark ? "rgba(147, 197, 253, 0.18)" : "rgba(15, 47, 143, 0.10)",
                              color: accent,
                            }
                    }
                    aria-hidden="true"
                  >
                    {toast.tone === "duplicate" ? (
                      <AlertTriangle size={22} strokeWidth={2.6} />
                    ) : toast.tone === "success" ? (
                      <CheckCircle2 size={18} strokeWidth={2.4} />
                    ) : (
                      <ScanLine size={16} strokeWidth={2.4} />
                    )}
                  </span>
                  <p
                    className={`flex-1 min-w-0 font-extrabold leading-snug ${
                      toast.tone === "duplicate" ? "text-[15px] tracking-wide" : "text-[13px]"
                    }`}
                    style={{
                      textShadow: dark ? "0 1px 2px rgba(0,0,0,0.45)" : "none",
                    }}
                  >
                    {toast.message}
                  </p>
                </div>
              ) : null}

              <section className="flex flex-col items-center gap-3">
                {stepHint ? (
                  <p className="text-[12px] font-medium text-center px-2" style={{ color: textMuted }}>
                    {stepHint}
                  </p>
                ) : null}

                {!bargeReady && !isDamageMode ? (
                  <div
                    className="w-full rounded-2xl px-4 py-8 flex flex-col items-center gap-3 text-center"
                    style={{
                      background: chipBg,
                      border: `2px dashed ${dashedBorder}`,
                    }}
                  >
                    <span
                      className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{ background: iconMutedBg, color: accent }}
                    >
                      <Anchor size={22} />
                    </span>
                    <p className="text-[13px] font-bold" style={{ color: textPrimary }}>
                      Select barge or stack first
                    </p>
                    <p className="text-[11px] leading-relaxed max-w-[240px]" style={{ color: textMuted }}>
                      Choose where logs are being loaded, then tap the scanner to start.
                    </p>
                  </div>
                ) : (
                <QrTapViewfinder
                  phase={pendingDamage ? "idle" : phase}
                  dark={dark}
                  viewOnly={viewOnly}
                  disabled={Boolean(pendingDamage)}
                  danger={isDamageMode}
                  detectedLabel={
                    isDamageMode
                      ? `${next.code} — tap to report`
                      : `${next.code} added`
                  }
                  idleHint={pendingDamage ? "Fill in damage details below" : "Ready when you are"}
                  scanningHint="Hold steady over the log QR"
                  onToggleScan={() => {
                    if (phase === "idle") setPhase("scanning");
                    else if (phase === "scanning") setPhase("idle");
                  }}
                />
                )}
              </section>

              {!isDamageMode && loadedLogs.length > 0 ? (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-baseline justify-between gap-2 px-0.5">
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: textMuted }}>
                      Recently loaded
                    </p>
                    <span className="text-[11px] font-semibold" style={{ color: subtleText }}>
                      {loadedLogs.length} log{loadedLogs.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {loadedLogs.slice(0, 4).map((item, i) => (
                    <div
                      key={item.id}
                      className="rounded-2xl px-3.5 py-3 flex items-center justify-between gap-3 animate-riseIn"
                      style={{
                        ...rowGlass,
                        ["--rise-delay" as string]: `${40 + i * 40}ms`,
                      }}
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold truncate" style={{ color: textPrimary }}>{item.code}</p>
                        <p className="text-[11px] truncate" style={{ color: textMuted }}>
                          {item.bargeStackLabel ? `${item.bargeStackLabel} · ` : ""}{item.productName} · {formatVolumeM3(item.volume)}
                        </p>
                      </div>
                      <CheckCircle2 size={18} style={{ color: "#16a34a", flexShrink: 0 }} />
                    </div>
                  ))}
                </div>
              ) : null}

              {isDamageMode ? (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-baseline justify-between gap-2 px-0.5">
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: textMuted }}>
                      Damaged logs
                    </p>
                    <span className="text-[11px] font-semibold" style={{ color: subtleText }}>
                      {damagedLogs.length} removed
                    </span>
                  </div>

                  {damagedLogs.length === 0 ? (
                    <div className="rounded-2xl px-4 py-7 flex flex-col items-center gap-2 text-center" style={rowGlass}>
                      <span
                        className="w-11 h-11 rounded-2xl flex items-center justify-center"
                        style={{ background: "rgba(212,24,61,0.08)", color: "#d4183d" }}
                      >
                        <AlertTriangle size={20} />
                      </span>
                      <p className="text-[13px] font-bold" style={{ color: textPrimary }}>No damaged logs</p>
                      <p className="text-[11px] leading-relaxed max-w-[260px]" style={{ color: textMuted }}>
                        Only scan here if a log is damaged. Good logs are scanned in Step 1.
                      </p>
                    </div>
                  ) : (
                    damagedLogs.map((item, i) => (
                      <div
                        key={item.id}
                        className="rounded-2xl px-3.5 py-3.5 flex flex-col gap-1.5 animate-riseIn"
                        style={{
                          ...rowGlass,
                          ["--rise-delay" as string]: `${40 + i * 40}ms`,
                          border: "1px solid rgba(212,24,61,0.18)",
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[14px] font-bold truncate" style={{ color: textPrimary }}>{item.code}</p>
                            <p className="text-[11px] mt-0.5 truncate" style={{ color: textMuted }}>
                              {item.serialNo} · {item.productName}
                            </p>
                          </div>
                          <span
                            className="inline-flex items-center h-6 px-2 rounded-md text-[10px] font-bold flex-shrink-0"
                            style={{ background: "rgba(212,24,61,0.12)", color: "#d4183d" }}
                          >
                            {item.damageType}
                          </span>
                        </div>
                        <p className="text-[12px] font-semibold tabular-nums" style={{ color: "#d4183d" }}>
                          Excluded {formatVolumeM3(item.volume)}
                        </p>
                        {item.notes ? (
                          <p className="text-[12px] leading-snug" style={{ color: textMuted }}>{item.notes}</p>
                        ) : null}
                        {item.evidenceCount > 0 ? (
                          <p className="text-[11px] font-semibold" style={{ color: accent }}>
                            {item.evidenceCount} evidence photo{item.evidenceCount === 1 ? "" : "s"}
                          </p>
                        ) : null}
                        <p className="text-[10px] font-medium" style={{ color: subtleText }}>{item.scannedAt}</p>
                      </div>
                    ))
                  )}
                </div>
              ) : null}

              <button
                type="button"
                onClick={runFinishComplete}
                disabled={!viewOnly && (!canFinishLoading || finishPulse)}
                className={`pressable w-full min-h-12 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 focus:outline-none disabled:cursor-not-allowed ${finishPulse ? "animate-finishSuccess" : ""}`}
                style={{
                  background: canFinishLoading || viewOnly ? GRADIENT : (dark ? "rgba(255,255,255,0.14)" : "#64748b"),
                  boxShadow: canFinishLoading || viewOnly ? "0 6px 18px rgba(15,47,143,0.30)" : "none",
                  opacity: !viewOnly && !canFinishLoading ? 0.72 : 1,
                }}
                aria-disabled={!viewOnly && !canFinishLoading}
                title={!viewOnly && !canFinishLoading ? loadingCompletionGate.blockers[0] : undefined}
              >
                {viewOnly ? "Close" : finishPulse ? "Completed" : "Finish Loading Inspection"}
                {!viewOnly && <CheckCircle2 size={16} className={finishPulse ? "animate-checkPop" : undefined} />}
              </button>
            </div>
          )}

          {activeTab === "non-compliance" && ncView === "list" && (
            <div className="flex flex-col gap-4 animate-panelIn">
              {!viewOnly && (
              <button
                type="button"
                onClick={() => setNcView("create")}
                className="pressable w-full min-h-12 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 focus:outline-none"
                style={{ background: GRADIENT, boxShadow: "0 4px 14px rgba(15,47,143,0.28)" }}
              >
                <Plus size={16} />
                New issue report
              </button>
              )}

              {filedNcs.length === 0 ? (
                <div
                  className="rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-2"
                  style={{
                    background: cardBg,
                    border: `2px dashed ${dashedBorder}`,
                    boxShadow: cardShadow,
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-1"
                    style={{ background: iconMutedBg, color: subtleText }}
                  >
                    <ClipboardList size={22} />
                  </div>
                  <p className="text-[12px] font-medium" style={{ color: subtleText }}>
                    No issues reported yet.
                  </p>
                </div>
              ) : (
                filedNcs.map((nc, i) => (
                  <div
                    key={nc.id}
                    className="rounded-2xl px-3.5 py-3.5 flex flex-col gap-2 animate-riseIn"
                    style={{
                      background: cardBg,
                      border: nc.auto ? "1px solid rgba(212,24,61,0.22)" : `1px solid ${cardBorder}`,
                      boxShadow: cardShadow,
                      ["--rise-delay" as string]: `${40 + i * 40}ms`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-bold" style={{ color: textPrimary }}>
                        {nc.auto ? "Auto-raised NC" : "Notice of Discrepancy"}
                      </p>
                      {nc.auto ? (
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0"
                          style={{ background: "rgba(212,24,61,0.12)", color: "#d4183d" }}
                        >
                          AUTO
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[12px] leading-snug" style={{ color: textMuted }}>{nc.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {nc.types.map(type => (
                        <span
                          key={type}
                          className="text-[10px] font-semibold px-2 py-1 rounded-md"
                          style={{
                            background: dark ? "rgba(59,130,246,0.16)" : "rgba(15,47,143,0.08)",
                            color: accent,
                          }}
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                    <p className="text-[10px] font-medium" style={{ color: subtleText }}>{nc.createdAt}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "non-compliance" && ncView === "create" && (
            <div className="flex flex-col gap-4 animate-panelIn">
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-bold" style={{ color: textPrimary }}>
                  Non-Compliance Description <span style={{ color: "#d4183d" }}>*</span>
                </label>
                <textarea
                  rows={4}
                  value={ncDescription}
                  onChange={e => setNcDescription(e.target.value)}
                  placeholder="Describe the discrepancy observed..."
                  className="w-full p-3 text-[12px] rounded-xl focus:outline-none resize-none"
                  style={{
                    background: fieldBg,
                    border: `1px solid ${fieldBorder}`,
                    color: textPrimary,
                    boxShadow: cardShadow,
                  }}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>
                  Type of Non-Compliance
                </label>
                <div
                  className="rounded-2xl overflow-hidden flex flex-col"
                  style={{
                    background: cardBg,
                    border: `1px solid ${cardBorder}`,
                    boxShadow: cardShadow,
                  }}
                >
                  <div className="px-3 pb-3 pt-3 flex flex-col gap-2 max-h-56 overflow-y-auto overscroll-contain">
                    {LOADING_NON_COMPLIANCE_TYPES.map(type => {
                      const checked = selectedNcTypes.includes(type);
                      return (
                        <label
                          key={type}
                          className="flex items-center gap-3 cursor-pointer rounded-full px-3 py-2.5 transition-all active:scale-[0.99]"
                          style={{
                            background: checked
                              ? (dark ? "rgba(59,130,246,0.16)" : "rgba(15,47,143,0.06)")
                              : (dark ? "rgba(255,255,255,0.03)" : "#ffffff"),
                            border: checked
                              ? (dark ? "1.5px solid rgba(96,165,250,0.45)" : "1.5px solid rgba(15,47,143,0.35)")
                              : (dark ? "1.5px solid rgba(255,255,255,0.10)" : "1.5px solid rgba(15,47,143,0.12)"),
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setSelectedNcTypes(prev =>
                                prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type],
                              )
                            }
                            className="w-4 h-4 flex-shrink-0 rounded accent-[#0f2f8f]"
                          />
                          <span className="text-[14px] font-medium leading-snug" style={{ color: textPrimary }}>
                            {type}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>
                  Evidence Photos
                </p>
                <button
                  type="button"
                  onClick={openEvidenceSheet}
                  className="rounded-2xl px-4 py-5 flex flex-col items-center justify-center gap-2 focus:outline-none active:scale-[0.99] transition-all"
                  style={{
                    background: cardBg,
                    border: `2px dashed ${dashedBorder}`,
                    boxShadow: cardShadow,
                  }}
                >
                  <span
                    className="w-11 h-11 rounded-2xl flex items-center justify-center"
                    style={{ background: iconMutedBg, color: accent }}
                  >
                    <Camera size={20} />
                  </span>
                  <span className="text-[13px] font-bold" style={{ color: textPrimary }}>
                    Add Evidence Photo
                  </span>
                  <span className="text-[11px] font-medium text-center" style={{ color: textMuted }}>
                    Take a photo or upload from gallery
                  </span>
                </button>

                {evidenceError && (
                  <p className="text-[11px] font-medium px-0.5" style={{ color: "#d4183d" }} role="alert">
                    {evidenceError}
                  </p>
                )}

                {evidencePhotos.length > 0 && (
                  <div className="flex flex-col gap-2 animate-riseIn">
                    <div className="flex items-center justify-between px-0.5">
                      <p className="text-[11px] font-semibold" style={{ color: textMuted }}>
                        {evidencePhotos.length} photo{evidencePhotos.length === 1 ? "" : "s"} attached
                      </p>
                      <button
                        type="button"
                        onClick={clearEvidencePhotos}
                        className="text-[11px] font-semibold focus:outline-none active:opacity-70"
                        style={{ color: accent }}
                      >
                        Clear all
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {evidencePhotos.map((photo, i) => (
                        <div
                          key={photo.id}
                          className="relative aspect-square rounded-xl overflow-hidden animate-riseIn"
                          style={{
                            ["--rise-delay" as string]: `${40 + i * 40}ms`,
                            background: cardBg,
                            border: `1px solid ${cardBorder}`,
                            boxShadow: cardShadow,
                          }}
                        >
                          <img src={photo.previewUrl} alt={photo.name} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeEvidencePhoto(photo.id)}
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center focus:outline-none active:scale-95"
                            style={{ background: "rgba(10,26,74,0.72)", color: "#ffffff" }}
                            aria-label={`Remove ${photo.name}`}
                          >
                            <X size={12} strokeWidth={2.5} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={!ncDescription.trim() || selectedNcTypes.length === 0}
                onClick={() => {
                  setFiledNcs(prev => [
                    {
                      id: `nc-${Date.now()}`,
                      description: ncDescription.trim(),
                      types: selectedNcTypes,
                      auto: false,
                      createdAt: formatScanTime(new Date()),
                    },
                    ...prev,
                  ]);
                  setNcView("list");
                  setNcDescription("");
                  setSelectedNcTypes([]);
                  clearEvidencePhotos();
                }}
                className="w-full h-12 rounded-xl text-[12px] font-bold uppercase tracking-wider text-white flex items-center justify-center focus:outline-none active:scale-[0.98] disabled:opacity-45"
                style={{ background: GRADIENT, boxShadow: "0 4px 14px rgba(15,47,143,0.28)" }}
              >
                Submit Notice of Discrepancy
              </button>
            </div>
          )}

          {activeTab === "attachments" && (
            <div className="flex flex-col gap-4 animate-panelIn">
              {!viewOnly && (
              <button
                type="button"
                onClick={openAttachmentSheet}
                className="rounded-2xl p-6 flex flex-col items-center justify-center gap-2 focus:outline-none active:scale-[0.99] transition-all"
                style={{
                  background: cardBg,
                  border: `2px dashed ${dashedBorder}`,
                  boxShadow: cardShadow,
                }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: iconMutedBg, color: textMuted }}
                >
                  <Upload size={18} />
                </div>
                <p className="text-[12px] font-bold" style={{ color: textPrimary }}>+ Add Photo or Document</p>
                <p className="text-[10px]" style={{ color: subtleText }}>JPG, PNG, or PDF up to 10MB</p>
              </button>
              )}

              {attachmentError && (
                <p
                  role="alert"
                  className="text-[11px] font-semibold rounded-xl px-3 py-2.5"
                  style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid rgba(220,38,38,0.18)" }}
                >
                  {attachmentError}
                </p>
              )}

              {attachments.map((file, i) => (
                <AttachmentFileCard
                  key={`${file.fileName}-${i}`}
                  file={file}
                  index={i}
                  dark={dark}
                  onDelete={viewOnly ? undefined : () => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {pendingDamage && overlayBox && (
        <DamageReportDialog
          pending={pendingDamage}
          overlayBox={overlayBox}
          onCancel={closeDamage}
          onSave={saveDamage}
        />
      )}

      {evidenceSheetOpen && evidenceSheetBox && createPortal(
        <div
          className="z-[60] flex flex-col justify-end"
          style={{
            position: "fixed",
            top: evidenceSheetBox.top,
            left: evidenceSheetBox.left,
            width: evidenceSheetBox.width,
            height: evidenceSheetBox.height,
          }}
        >
          <button
            type="button"
            className="absolute inset-0 border-0 p-0 cursor-default"
            style={{
              background: dark ? "rgba(2,6,23,0.62)" : "rgba(10,22,70,0.45)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
            aria-label="Close"
            onClick={closeEvidenceSheet}
          />
          <div
            className="relative z-10 w-full rounded-t-[28px] px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col gap-5 animate-sheetUp"
            style={{
              background: dark ? "#1e293b" : "#ffffff",
              boxShadow: dark ? "0 -12px 40px rgba(0,0,0,0.45)" : "0 -12px 40px rgba(15,47,143,0.18)",
            }}
            role="dialog"
            aria-modal="true"
            aria-label={photoSheetPurpose === "attachment" ? "Add photo" : "Add evidence photo"}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-1 rounded-full" style={{ background: dark ? "rgba(255,255,255,0.20)" : "rgba(15,47,143,0.18)" }} />
              <div className="w-full flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: textMuted }}>
                  {photoSheetPurpose === "attachment" ? "Add Photo" : "Add Evidence Photo"}
                </p>
                <button
                  type="button"
                  onClick={closeEvidenceSheet}
                  className="field-touch w-12 h-12 rounded-xl flex items-center justify-center focus:outline-none"
                  style={{ background: iconMutedBg, color: accent }}
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: textMuted }}>
                Source
              </p>
              <label
                className="w-full h-12 rounded-2xl px-4 flex items-center gap-3 text-left focus-within:outline-none active:scale-[0.99] transition-all cursor-pointer"
                style={{
                  background: dark ? "rgba(15,23,42,0.85)" : "#ffffff",
                  border: `1.5px solid ${dark ? "rgba(255,255,255,0.12)" : "rgba(15,47,143,0.12)"}`,
                  boxShadow: dark ? "none" : "0 2px 10px rgba(15,47,143,0.04)",
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleEvidencePicked}
                  className="sr-only"
                />
                <span
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: iconMutedBg, color: accent }}
                >
                  <Camera size={16} />
                </span>
                <span className="flex-1 min-w-0 text-sm font-semibold" style={{ color: textPrimary }}>
                  Take Photo
                </span>
                <ChevronRight size={16} style={{ color: textMuted }} />
              </label>
              <label
                className="w-full h-12 rounded-2xl px-4 flex items-center gap-3 text-left focus-within:outline-none active:scale-[0.99] transition-all cursor-pointer"
                style={{
                  background: dark ? "rgba(15,23,42,0.85)" : "#ffffff",
                  border: `1.5px solid ${dark ? "rgba(255,255,255,0.12)" : "rgba(15,47,143,0.12)"}`,
                  boxShadow: dark ? "none" : "0 2px 10px rgba(15,47,143,0.04)",
                }}
              >
                <input
                  type="file"
                  accept={photoSheetPurpose === "attachment" ? ACCEPTED_ATTACHMENT_MIME : "image/*"}
                  multiple={photoSheetPurpose === "evidence"}
                  onChange={handleEvidencePicked}
                  className="sr-only"
                />
                <span
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: iconMutedBg, color: accent }}
                >
                  <ImageIcon size={16} />
                </span>
                <span className="flex-1 min-w-0 text-sm font-semibold" style={{ color: textPrimary }}>
                  Upload from Gallery
                </span>
                <ChevronRight size={16} style={{ color: textMuted }} />
              </label>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {newBargeOpen && overlayBox && createPortal(
        <div
          className="z-[65] flex flex-col justify-end"
          style={{
            position: "fixed",
            top: overlayBox.top,
            left: overlayBox.left,
            width: overlayBox.width,
            height: overlayBox.height,
          }}
        >
          <button
            type="button"
            className="absolute inset-0 border-0 p-0 cursor-default"
            style={{
              background: dark ? "rgba(2,6,23,0.62)" : "rgba(10,22,70,0.45)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
            aria-label="Close"
            onClick={() => {
              setNewBargeOpen(false);
              setLoadTypeOpen(false);
            }}
          />
          <div
            className="relative z-10 w-full rounded-t-[28px] px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col gap-4 animate-sheetUp max-h-[88%] overflow-y-auto"
            style={{
              background: dark ? "#1e293b" : "#ffffff",
              boxShadow: dark ? "0 -12px 40px rgba(0,0,0,0.45)" : "0 -12px 40px rgba(15,47,143,0.18)",
            }}
            role="dialog"
            aria-modal="true"
            aria-label="New allocation"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-1 rounded-full" style={{ background: dark ? "rgba(255,255,255,0.20)" : "rgba(15,47,143,0.18)" }} />
              <div className="w-full flex items-center justify-between gap-3">
                <p className="text-[16px] font-bold" style={{ color: textPrimary }}>New Allocation</p>
                <button
                  type="button"
                  onClick={() => {
                    setNewBargeOpen(false);
                    setLoadTypeOpen(false);
                  }}
                  className="field-touch w-12 h-12 rounded-xl flex items-center justify-center focus:outline-none"
                  style={{ background: iconMutedBg, color: accent }}
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-bold" style={{ color: textPrimary }}>
                Name <span style={{ color: "#d4183d" }}>*</span>
              </label>
              <input
                type="text"
                value={newBargeName}
                onChange={e => setNewBargeName(e.target.value)}
                placeholder="e.g. Barge B-205"
                className="w-full px-4 py-3.5 text-sm rounded-xl focus:outline-none"
                style={{
                  background: fieldBg,
                  border: `1.5px solid ${fieldBorder}`,
                  color: textPrimary,
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-bold" style={{ color: textPrimary }}>
                Load Type
              </label>
              <button
                type="button"
                onClick={() => setLoadTypeOpen(v => !v)}
                className="w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-sm text-left focus:outline-none"
                style={{
                  background: fieldBg,
                  border: `1.5px solid ${loadTypeOpen ? (dark ? "rgba(96,165,250,0.55)" : "rgba(15,47,143,0.45)") : fieldBorder}`,
                  color: newBargeLoadType ? textPrimary : textMuted,
                }}
              >
                <span className="truncate font-medium">{newBargeLoadType || "Select type…"}</span>
                <ChevronDown
                  size={16}
                  style={{
                    color: textMuted,
                    transform: loadTypeOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                    flexShrink: 0,
                  }}
                />
              </button>
              {loadTypeOpen && (
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: cardBg,
                    border: `1px solid ${cardBorder}`,
                    maxHeight: 180,
                    overflowY: "auto",
                  }}
                >
                  {BARGE_LOAD_TYPES.map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setNewBargeLoadType(type);
                        setLoadTypeOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm font-medium focus:outline-none"
                      style={{
                        color: newBargeLoadType === type ? accent : textPrimary,
                        background: newBargeLoadType === type
                          ? (dark ? "rgba(59,130,246,0.16)" : "rgba(15,47,143,0.08)")
                          : "transparent",
                        borderBottom: `1px solid ${cardBorder}`,
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={!newBargeName.trim()}
              onClick={saveNewBarge}
              className="w-full h-12 rounded-xl text-sm font-bold text-white focus:outline-none active:scale-[0.98] disabled:opacity-45"
              style={{ background: GRADIENT, boxShadow: "0 4px 16px rgba(15,47,143,0.32)" }}
            >
              Add & select
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [location, setLocation] = useState("");
  const [dark, setDark] = useState(false);
  const [userType, setUserType] = useState<UserType>("client");
  const [inventoryExporter, setInventoryExporter] = useState("");
  const [inventorySheetOpen, setInventorySheetOpen] = useState(false);
  const [inventoryOverlayBox, setInventoryOverlayBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [registerLogPrefill, setRegisterLogPrefill] = useState<RegisterLogFormData | null>(null);
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);
  const [scannedSampleLogs, setScannedSampleLogs] = useState<ScannedSampleLog[]>([]);
  // Always increments, so the mock scanner keeps cycling the pool even after every code is seen.
  const [sampleScanCount, setSampleScanCount] = useState(0);
  const [activeScannedCode, setActiveScannedCode] = useState<string | null>(null);
  const [inspectionProgressById, setInspectionProgressById] = useState<Record<string, InspectionProgress>>({});
  const [physicalVerificationById, setPhysicalVerificationById] = useState<Record<string, PhysicalVerificationDraft>>({});
  // Which sub-inspection (Pre-Shipment vs Loading) the physical/sample flow is currently working on.
  const [activeInspectionStep, setActiveInspectionStep] = useState<"preShipment" | "loading">("preShipment");
  const [loadingScanCount, setLoadingScanCount] = useState(0);
  const [allocatedLoadedLogs, setAllocatedLoadedLogs] = useState<AllocatedLoadedLog[]>([]);
  const [damagedLoadedLogs, setDamagedLoadedLogs] = useState<DamagedLoadedLog[]>([]);
  const [loadingDamageNc, setLoadingDamageNc] = useState<LoadingDamageNc | null>(null);
  const [autoStartLoadingScanner, setAutoStartLoadingScanner] = useState(true);
  const [inspectionViewOnly, setInspectionViewOnly] = useState(false);
  const [finishDialogKey, setFinishDialogKey] = useState<"preShipment" | "loading" | null>(null);
  const [finishEndDate, setFinishEndDate] = useState(todayISODate);
  const [finishOverlayBox, setFinishOverlayBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const finishOnDoneRef = useRef<((result: { inspectionComplete: boolean }) => void) | null>(null);

  const isCU = userType === "cu";

  const syncInventoryOverlayBox = () => {
    const device = document.querySelector(".mobile-device");
    if (device) {
      const r = device.getBoundingClientRect();
      setInventoryOverlayBox({ top: r.top, left: r.left, width: r.width, height: r.height });
    } else {
      setInventoryOverlayBox({ top: 0, left: 0, width: window.innerWidth, height: window.innerHeight });
    }
  };

  const syncFinishOverlayBox = () => {
    const device = document.querySelector(".mobile-device");
    if (device) {
      const r = device.getBoundingClientRect();
      setFinishOverlayBox({ top: r.top, left: r.left, width: r.width, height: r.height });
    } else {
      setFinishOverlayBox({ top: 0, left: 0, width: window.innerWidth, height: window.innerHeight });
    }
  };

  useEffect(() => {
    if (!finishDialogKey) return;
    syncFinishOverlayBox();
    const vp = document.querySelector(".mobile-viewport");
    window.addEventListener("resize", syncFinishOverlayBox);
    window.addEventListener("scroll", syncFinishOverlayBox, true);
    vp?.addEventListener("scroll", syncFinishOverlayBox);
    return () => {
      window.removeEventListener("resize", syncFinishOverlayBox);
      window.removeEventListener("scroll", syncFinishOverlayBox, true);
      vp?.removeEventListener("scroll", syncFinishOverlayBox);
    };
  }, [finishDialogKey]);

  const openFinishDialog = (
    key: "preShipment" | "loading",
    _taskId: string,
    onDone: (result: { inspectionComplete: boolean }) => void,
  ) => {
    // Default end date to today for field completion.
    setFinishEndDate(todayISODate());
    syncFinishOverlayBox();
    finishOnDoneRef.current = onDone;
    setFinishDialogKey(key);
  };

  const cancelFinishDialog = () => {
    setFinishDialogKey(null);
    finishOnDoneRef.current = null;
  };

  const completeLoadingInspection = (taskId: string, endDate: string) => {
    const current = getInspectionProgress(taskId);
    const today = todayISODate();
    setInspectionProgressById(prev => ({
      ...prev,
      [taskId]: {
        ...current,
        loading: "completed",
        loadingStartDate: current.loadingStartDate ?? today,
        loadingEndDate: endDate,
      },
    }));
  };

  const confirmFinishDialog = () => {
    if (!finishDialogKey || !finishEndDate || !selectedInspectionId) return;
    const taskId = selectedInspectionId;
    const key = finishDialogKey;
    const endDate = finishEndDate;
    const onDone = finishOnDoneRef.current;
    setFinishDialogKey(null);
    finishOnDoneRef.current = null;

    let inspectionComplete = false;
    if (key === "preShipment") {
      const draft = getPhysicalVerification(taskId);
      const gate = evaluatePreShipmentCompletion(draft, scannedSampleLogs.length);
      if (!gate.canComplete) {
        onDone?.({ inspectionComplete: false });
        return;
      }
      setActiveInspectionStep("preShipment");
      inspectionComplete = finalizeActiveInspectionStep(taskId, endDate);
    } else {
      const activeCount = allocatedLoadedLogs.filter(l => !l.excluded).length;
      const gate = evaluateLoadingCompletion(activeCount);
      if (!gate.canComplete) {
        onDone?.({ inspectionComplete: false });
        return;
      }
      setActiveInspectionStep("loading");
      const current = getInspectionProgress(taskId);
      completeLoadingInspection(taskId, endDate);
      inspectionComplete = current.preShipment === "completed";
    }
    onDone?.({ inspectionComplete });
  };

  const finishDialogPortal = finishDialogKey && finishOverlayBox ? (
    <StartSubInspectionDialog
      stepKey={finishDialogKey}
      date={finishEndDate}
      onDateChange={setFinishEndDate}
      onCancel={cancelFinishDialog}
      onConfirm={confirmFinishDialog}
      overlayBox={finishOverlayBox}
      mode="finish"
      dark={dark}
    />
  ) : null;

  const openInventorySheet = () => {
    syncInventoryOverlayBox();
    setInventorySheetOpen(true);
  };

  const inventorySheetOverlay = inventoryOverlayBox ?? {
    top: 0,
    left: 0,
    width: typeof window !== "undefined" ? window.innerWidth : 390,
    height: typeof window !== "undefined" ? window.innerHeight : 844,
  };

  useEffect(() => {
    if (!inventorySheetOpen) return;
    syncInventoryOverlayBox();
    const vp = document.querySelector(".mobile-viewport");
    window.addEventListener("resize", syncInventoryOverlayBox);
    window.addEventListener("scroll", syncInventoryOverlayBox, true);
    vp?.addEventListener("scroll", syncInventoryOverlayBox);
    return () => {
      window.removeEventListener("resize", syncInventoryOverlayBox);
      window.removeEventListener("scroll", syncInventoryOverlayBox, true);
      vp?.removeEventListener("scroll", syncInventoryOverlayBox);
    };
  }, [inventorySheetOpen]);

  const getInspectionProgress = (taskId: string): InspectionProgress => {
    const stored = inspectionProgressById[taskId];
    if (stored) return stored;
    // Seeded Complete inspections already have everything done — surface both steps as completed with dates filled.
    const task = SCHEDULED_INSPECTIONS.find(t => t.id === taskId);
    if (task?.status === "complete") {
      const today = todayISODate();
      return {
        preShipment: "completed",
        loading: "completed",
        preShipmentStartDate: today,
        preShipmentEndDate: today,
        loadingStartDate: today,
        loadingEndDate: today,
      };
    }
    return EMPTY_INSPECTION_PROGRESS;
  };

  const updatePhysicalVerification = (taskId: string, patch: Partial<PhysicalVerificationDraft>) => {
    setPhysicalVerificationById(prev => ({
      ...prev,
      [taskId]: { ...(prev[taskId] ?? EMPTY_PHYSICAL_VERIFICATION), ...patch },
    }));
  };

  const getPhysicalVerification = (taskId: string): PhysicalVerificationDraft => {
    const stored = physicalVerificationById[taskId];
    if (stored) return stored;
    const progress = getInspectionProgress(taskId);
    // Complete inspections already have verification data filled.
    if (progress.preShipment === "completed" || progress.loading === "completed") {
      return {
        volumeOk: "yes",
        photoAdded: true,
        nonConformanceReason: "",
        physicalStepComplete: true,
        sampleStepComplete: true,
        noSamplesAvailable: false,
        noSamplesReason: "",
      };
    }
    return EMPTY_PHYSICAL_VERIFICATION;
  };

  const advanceInspectionProgress = (
    taskId: string,
    key: "preShipment" | "loading",
    options?: { startDate?: string; complete?: boolean },
  ) => {
    setInspectionProgressById(prev => {
      const current = prev[taskId] ?? EMPTY_INSPECTION_PROGRESS;
      const currentStatus = current[key];
      const nextStatus: SubInspectionStatus = options?.complete
        ? "completed"
        : currentStatus === "not-started"
          ? "in-progress"
          : currentStatus === "in-progress"
            ? "completed"
            : "completed";

      const startField = key === "preShipment" ? "preShipmentStartDate" : "loadingStartDate";
      const endField = key === "preShipment" ? "preShipmentEndDate" : "loadingEndDate";
      const next: InspectionProgress = {
        ...current,
        [key]: nextStatus,
      };

      if (options?.startDate && !current[startField]) {
        next[startField] = options.startDate;
      }
      if (nextStatus === "completed" && !current[endField]) {
        next[endField] = todayISODate();
      }

      return { ...prev, [taskId]: next };
    });
  };

  /** Finish the active step: fill verification data + mark that step completed. Returns true when the whole inspection is Complete. */
  const finalizeActiveInspectionStep = (taskId: string, endDate?: string): boolean => {
    const step = activeInspectionStep;
    const draft = physicalVerificationById[taskId] ?? EMPTY_PHYSICAL_VERIFICATION;
    if (step === "preShipment") {
      const gate = evaluatePreShipmentCompletion(draft, scannedSampleLogs.length);
      if (!gate.canComplete) return false;
    }
    if (step === "loading") {
      const activeCount = allocatedLoadedLogs.filter(l => !l.excluded).length;
      const gate = evaluateLoadingCompletion(activeCount);
      if (!gate.canComplete) return false;
    }
    updatePhysicalVerification(taskId, {
      volumeOk: draft.volumeOk ?? "yes",
      photoAdded: true,
      physicalStepComplete: true,
      sampleStepComplete: true,
    });
    const current = getInspectionProgress(taskId);
    const today = todayISODate();
    const end = endDate ?? today;
    const nextPre: SubInspectionStatus = step === "preShipment" ? "completed" : current.preShipment;
    const nextLoading: SubInspectionStatus = step === "loading" ? "completed" : current.loading;
    setInspectionProgressById(prev => {
      const cur = prev[taskId] ?? EMPTY_INSPECTION_PROGRESS;
      return {
        ...prev,
        [taskId]: {
          ...cur,
          preShipment: nextPre,
          loading: nextLoading,
          preShipmentStartDate: cur.preShipmentStartDate ?? (step === "preShipment" ? today : cur.preShipmentStartDate),
          preShipmentEndDate: nextPre === "completed" ? end : cur.preShipmentEndDate,
          loadingStartDate: cur.loadingStartDate ?? (step === "loading" ? today : cur.loadingStartDate),
          loadingEndDate: nextLoading === "completed" ? end : cur.loadingEndDate,
        },
      };
    });
    return nextPre === "completed" && nextLoading === "completed";
  };

  const recordSampleScan = (record: ScannedSampleLog) => {
    // Re-scanning a code refreshes its timestamp and moves it back to the top rather than duplicating.
    setScannedSampleLogs(prev => [record, ...prev.filter(r => r.code !== record.code)]);
    setSampleScanCount(n => n + 1);
    setActiveScannedCode(record.code);
    setScreen("sample-verification-log");
  };

  useEffect(() => {
    clearSession();
  }, []);

  useEffect(() => {
    const vp = document.querySelector(".mobile-viewport");
    if (vp) vp.scrollTop = 0;
  }, [screen]);

  useEffect(() => {
    if (!AUTHENTICATED_SCREENS.includes(screen)) {
      clearSession();
      return;
    }
    saveSession({ screen, userType, location, dark, selectedInspectionId });
  }, [screen, userType, location, dark, selectedInspectionId]);

  // Safety net: if we ever land on a task-dependent screen without a resolvable task
  useEffect(() => {
    if (screen !== "cu-signin") return;
    setUserType("cu");
    setLocation(prev => prev || "Control Union");
    setScreen("home");
  }, [screen]);

  // (e.g. a stale/lost id), bounce back to the list instead of rendering blank.
  useEffect(() => {
    if (INSPECTION_TASK_SCREENS.includes(screen) && !SCHEDULED_INSPECTIONS.some(t => t.id === selectedInspectionId)) {
      setScreen("schedule-inspection");
    }
  }, [screen, selectedInspectionId]);

  if (screen === "login") return (
    <LoginScreen
      onSignIn={() => { setUserType("client"); setScreen("location"); }}
      onCUSignIn={() => { setUserType("cu"); setLocation("Control Union"); setScreen("home"); }}
    />
  );
  if (screen === "location") return (
    <LocationScreen onNext={loc => { setUserType("client"); setLocation(loc); setScreen("home"); }} />
  );

  const inventorySheet = inventorySheetOpen ? (
    <LogInventoryScopeSheet
      dark={dark}
      overlayBox={inventorySheetOverlay}
      onClose={() => setInventorySheetOpen(false)}
      onConfirm={(exporter, concession) => {
        setInventorySheetOpen(false);
        setInventoryExporter(exporter);
        setLocation(concession);
        setScreen("inventory-hub");
      }}
    />
  ) : null;

  const bottomNav = inventorySheet;

  if (screen === "scan-log") return (
    <>
      <ScanLogScreen
        dark={dark}
        isCU={isCU}
        onBack={() => setScreen("home")}
        onScanNew={() => {
          if (!isCU) {
            setRegisterLogPrefill(null);
            setScreen("register-log-form");
          }
        }}
        onOpenExisting={() => {
          setRegisterLogPrefill(REGISTERED_LOG_ENTRY);
          setScreen("register-log-form");
        }}
      />
      {bottomNav}
    </>
  );
  if (screen === "register-log-form") return (
    <RegisterLogFormScreen
      key={isCU ? "cu-view" : registerLogPrefill ? "existing" : "new"}
      prefill={isCU ? (registerLogPrefill ?? REGISTERED_LOG_ENTRY) : registerLogPrefill}
      isCU={isCU}
      onBack={() => setScreen("scan-log")}
    />
  );
  if (screen === "inventory-hub") return (
    <>
      <LogInformationHubScreen
        dark={dark}
        onBack={() => setScreen("home")}
        onScanLog={() => setScreen("scan-log")}
        onOpenInventory={() => {
          if (isCU && !(inventoryExporter && location)) {
            openInventorySheet();
            return;
          }
          setScreen("log-inventory");
        }}
      />
      {inventorySheet}
    </>
  );
  if (screen === "log-inventory") return (
    <LogInventoryScreen
      dark={dark}
      isCU={isCU}
      onBack={() => setScreen(isCU ? "inventory-hub" : "home")}
      exporter={inventoryExporter || resolveExporterForConcession(location)}
      concession={location || undefined}
    />
  );

  const scheduleExporter = resolveExporterForConcession(location);
  const scheduleConcession = location || CU_CLIENT_DIRECTORY[0].concessions[0];
  const scheduleScreenProps = {
    dark,
    onBack: () => setScreen("home" as Screen),
    onStartInspection: (task: InspectionTask) => { setSelectedInspectionId(task.id); setScreen("inspection-details"); },
    getProgress: getInspectionProgress,
    exporter: scheduleExporter,
    concession: scheduleConcession,
  };

  if (screen === "schedule-inspection") {
    return (
      <>
        <ScheduleInspectionScreen {...scheduleScreenProps} />
        {bottomNav}
      </>
    );
  }
  if (screen === "inspection-details") {
    const task = SCHEDULED_INSPECTIONS.find(t => t.id === selectedInspectionId);
    if (!task) {
      return (
        <>
          <ScheduleInspectionScreen {...scheduleScreenProps} />
          {bottomNav}
        </>
      );
    }
    return (
      <>
        <InspectionDetailsScreen
          task={task}
          progress={getInspectionProgress(task.id)}
          dark={dark}
          onBack={() => setScreen("schedule-inspection")}
          onViewFullInfo={() => setScreen("inspection-info-details")}
          onStartSession={(key, startDate, options) => {
            const viewOnly = Boolean(options?.viewOnly);
            setInspectionViewOnly(viewOnly);
            const current = getInspectionProgress(task.id)[key];
            if (viewOnly) {
              // Completed View: show sample history that was already verified.
              setScannedSampleLogs(prev => (prev.length > 0 ? prev : buildCompletedSampleScans()));
              setSampleScanCount(SAMPLE_QR_POOL.length);
              setActiveScannedCode(null);
            } else if (current === "not-started") {
              advanceInspectionProgress(task.id, key, { startDate });
              // Fresh step → clear prior verification draft so data must be filled again.
              setPhysicalVerificationById(prev => ({
                ...prev,
                [task.id]: { ...EMPTY_PHYSICAL_VERIFICATION },
              }));
              setScannedSampleLogs([]);
              setSampleScanCount(0);
              setActiveScannedCode(null);
            }
            setActiveInspectionStep(key);
            if (key === "loading") {
              if (!viewOnly && current === "not-started") {
                setLoadingScanCount(0);
                setAllocatedLoadedLogs([]);
                setDamagedLoadedLogs([]);
                setLoadingDamageNc(null);
              }
              setAutoStartLoadingScanner(!viewOnly);
              setScreen("loading-logs-scan");
              return;
            }
            setScreen("physical-verification");
          }}
        />
        {bottomNav}
      </>
    );
  }
  if (screen === "loading-logs-scan") {
    const task = SCHEDULED_INSPECTIONS.find(t => t.id === selectedInspectionId);
    if (!task) {
      return (
        <>
          <ScheduleInspectionScreen {...scheduleScreenProps} />
          {bottomNav}
        </>
      );
    }
    return (
      <>
        <LoadingLogsScanScreen
          scanCount={loadingScanCount}
          allocatedLogs={allocatedLoadedLogs}
          damagedLogs={damagedLoadedLogs}
          damageNc={loadingDamageNc}
          declaredVolume={LOADING_DECLARED_VOLUME_M3}
          autoStart={autoStartLoadingScanner}
          viewOnly={inspectionViewOnly}
          dark={dark}
          onBack={() => {
            setAutoStartLoadingScanner(false);
            setScreen("inspection-details");
          }}
          onAllocated={entry => {
            if (inspectionViewOnly) return;
            setAllocatedLoadedLogs(prev => [entry, ...prev]);
            setLoadingScanCount(n => n + 1);
          }}
          onDamageSaved={entry => {
            if (inspectionViewOnly) return;            setDamagedLoadedLogs(prev => {
              if (prev.some(d => d.code === entry.code)) return prev;
              return [entry, ...prev];
            });
            setAllocatedLoadedLogs(prev => {
              const exists = prev.some(l => l.code === entry.code);
              const next = exists
                ? prev.map(l => (l.code === entry.code ? { ...l, excluded: true } : l))
                : [
                    {
                      id: `alloc-${entry.code}`,
                      code: entry.code,
                      serialNo: entry.serialNo,
                      productName: entry.productName,
                      volume: entry.volume,
                      scannedAt: entry.scannedAt,
                      bargeStackId: "",
                      bargeStackLabel: "",
                      excluded: true,
                    },
                    ...prev,
                  ];
              const damagedNext = [entry, ...damagedLoadedLogs.filter(d => d.code !== entry.code)];
              const stats = calcLoadingVolumeStats(next, damagedNext, LOADING_DECLARED_VOLUME_M3);
              if (stats.outsideTolerance) {
                setLoadingDamageNc({
                  raised: true,
                  variancePct: stats.variancePct,
                  loadedVolume: stats.loadedVolume,
                  declaredVolume: LOADING_DECLARED_VOLUME_M3,
                  excludedVolume: stats.excludedVolume,
                  notifiedClient: true,
                });
              }
              return next;
            });
          }}
          onScanConsumed={() => {
            if (inspectionViewOnly) return;
            setLoadingScanCount(n => n + 1);
          }}
          onComplete={() => {
            if (inspectionViewOnly) {
              setScreen("inspection-details");
              return;
            }
            const activeCount = allocatedLoadedLogs.filter(l => !l.excluded).length;
            if (!evaluateLoadingCompletion(activeCount).canComplete) return;
            openFinishDialog("loading", task.id, ({ inspectionComplete }) => {
              setScreen(inspectionComplete ? "schedule-inspection" : "inspection-details");
            });
          }}
        />
        {finishDialogPortal}
        {bottomNav}
      </>
    );
  }
  if (screen === "physical-verification") {
    const task = SCHEDULED_INSPECTIONS.find(t => t.id === selectedInspectionId);
    if (!task) {
      return (
        <>
          <ScheduleInspectionScreen {...scheduleScreenProps} />
          {bottomNav}
        </>
      );
    }
    return (
      <>
        <PhysicalVerificationScreen
          task={task}
          draft={getPhysicalVerification(task.id)}
          dark={dark}
          viewOnly={inspectionViewOnly}
          onDraftChange={patch => {
            if (inspectionViewOnly) return;
            updatePhysicalVerification(task.id, patch);
          }}
          onBack={() => setScreen("inspection-details")}
          onProceed={() => {
            if (!inspectionViewOnly) {
              updatePhysicalVerification(task.id, { physicalStepComplete: true });
            } else {
              setScannedSampleLogs(prev => (prev.length > 0 ? prev : buildCompletedSampleScans()));
            }
            setScreen("sample-verification-scan");
          }}
          onGoToSample={() => {
            if (inspectionViewOnly) {
              setScannedSampleLogs(prev => (prev.length > 0 ? prev : buildCompletedSampleScans()));
            }
            setScreen("sample-verification-scan");
          }}
          onVerificationFailed={() => setScreen("inspection-details")}
        />
        {finishDialogPortal}
        {bottomNav}
      </>
    );
  }
  if (screen === "sample-verification-scan" || screen === "sample-verification-log") {
    const task = SCHEDULED_INSPECTIONS.find(t => t.id === selectedInspectionId);
    if (!task) {
      return (
        <>
          <ScheduleInspectionScreen {...scheduleScreenProps} />
          {bottomNav}
        </>
      );
    }
    const activeRecord = scannedSampleLogs.find(r => r.code === activeScannedCode);
    // Scans live in memory only, so a restored session on the details screen falls back to scanning.
    if (screen === "sample-verification-scan" || !activeRecord) {
      return (
        <>
          <SampleVerificationScanScreen
            key={sampleScanCount}
            scanCount={sampleScanCount}
            records={scannedSampleLogs}
            viewOnly={inspectionViewOnly}
            dark={dark}
            targetVolumeM3={task.logs * 21.875}
            physicalComplete={getPhysicalVerification(task.id).physicalStepComplete}
            sampleComplete={getPhysicalVerification(task.id).sampleStepComplete}
            noSamplesAvailable={getPhysicalVerification(task.id).noSamplesAvailable}
            noSamplesReason={getPhysicalVerification(task.id).noSamplesReason}
            onNoSamplesChange={patch => {
              if (inspectionViewOnly) return;
              const nextReason = patch.noSamplesReason ?? getPhysicalVerification(task.id).noSamplesReason;
              const nextAvailable = patch.noSamplesAvailable ?? getPhysicalVerification(task.id).noSamplesAvailable;
              const waiveComplete = Boolean(nextAvailable && nextReason.trim());
              updatePhysicalVerification(task.id, {
                ...patch,
                sampleStepComplete: scannedSampleLogs.length > 0 || waiveComplete,
              });
            }}
            onBack={() => setScreen("physical-verification")}
            onGoToPhysical={() => setScreen("physical-verification")}
            onScanned={record => {
              if (inspectionViewOnly) return;
              recordSampleScan(record);
            }}
            onOpenRecord={code => {
              setActiveScannedCode(code);
              setScreen("sample-verification-log");
            }}
            onFinishInspection={() => {
              if (inspectionViewOnly) {
                setScreen("physical-verification");
                return;
              }
              const draft = getPhysicalVerification(task.id);
              const gate = evaluatePreShipmentCompletion(draft, scannedSampleLogs.length);
              if (!gate.canComplete) return;
              openFinishDialog("preShipment", task.id, ({ inspectionComplete }) => {
                setActiveScannedCode(null);
                setScreen(inspectionComplete ? "schedule-inspection" : "inspection-details");
              });
            }}
          />
          {finishDialogPortal}
          {bottomNav}
        </>
      );
    }
    return (
      <>
        <QrDetailsScreen
          record={activeRecord}
          viewOnly={inspectionViewOnly}
          dark={dark}
          onBack={() => { setScreen("sample-verification-scan"); }}
          onFinish={({ measurements, comment }) => {
            if (inspectionViewOnly) return;
            // Verify this log only — do not complete Pre-Shipment here.
            setScannedSampleLogs(prev =>
              prev.map(r =>
                r.code === activeRecord.code
                  ? {
                      ...r,
                      status: "verified",
                      inspectorMeasurements: measurements,
                      inspectorComment: comment,
                    }
                  : r,
              ),
            );
            updatePhysicalVerification(task.id, { sampleStepComplete: true });
            setActiveScannedCode(null);
            setScreen("sample-verification-scan");
          }}
        />
        {bottomNav}
      </>
    );
  }
  if (screen === "inspection-info-details") {
    const task = SCHEDULED_INSPECTIONS.find(t => t.id === selectedInspectionId);
    if (!task) {
      return (
        <>
          <ScheduleInspectionScreen {...scheduleScreenProps} />
          {bottomNav}
        </>
      );
    }
    return (
      <>
        <InspectionInfoDetailsScreen
          task={task}
          dark={dark}
          onBack={() => setScreen("inspection-details")}
          onOpenApe={() => setScreen("approved-price-endorsement")}
          onOpenDeclaredLogs={() => setScreen("declared-log-details")}
          onOpenVolumeVariance={() => setScreen("permitted-vs-declared")}
        />
        {bottomNav}
      </>
    );
  }
  if (screen === "approved-price-endorsement") {
    const task = SCHEDULED_INSPECTIONS.find(t => t.id === selectedInspectionId);
    if (!task) {
      return (
        <>
          <ScheduleInspectionScreen {...scheduleScreenProps} />
          {bottomNav}
        </>
      );
    }
    return (
      <>
        <ApprovedPriceEndorsementScreen
          dark={dark}
          onBack={() => setScreen("inspection-info-details")}
        />
        {bottomNav}
      </>
    );
  }
  if (screen === "declared-log-details") {
    const task = SCHEDULED_INSPECTIONS.find(t => t.id === selectedInspectionId);
    if (!task) {
      return (
        <>
          <ScheduleInspectionScreen {...scheduleScreenProps} />
          {bottomNav}
        </>
      );
    }
    return (
      <>
        <DeclaredLogDetailsScreen
          task={task}
          dark={dark}
          onBack={() => setScreen("inspection-info-details")}
        />
        {bottomNav}
      </>
    );
  }
  if (screen === "permitted-vs-declared") {
    const task = SCHEDULED_INSPECTIONS.find(t => t.id === selectedInspectionId);
    if (!task) {
      return (
        <>
          <ScheduleInspectionScreen {...scheduleScreenProps} />
          {bottomNav}
        </>
      );
    }
    return (
      <>
        <PermittedVsDeclaredScreen
          dark={dark}
          onBack={() => setScreen("inspection-info-details")}
        />
        {bottomNav}
      </>
    );
  }
  return (
    <>
      <HomeScreen
        location={location}
        isCU={isCU}
        onLogout={() => {
          clearSession();
          setUserType("client");
          setLocation("");
          setScreen("login");
        }}
        onNavigate={setScreen}
        onOpenInventorySheet={openInventorySheet}
        dark={dark}
        setDark={setDark}
      />
      {bottomNav}
    </>
  );
}
