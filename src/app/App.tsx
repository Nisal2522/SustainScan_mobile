import { useState, useRef, useEffect, type ReactNode, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  Eye, EyeOff, Mail, Lock, ChevronRight, MapPin, ChevronDown,
  Moon, Sun, LogOut, ClipboardList, Package, RefreshCw, ArrowLeft,
  ScanLine, QrCode, Calendar, Search, ListFilter, X, Truck, CheckCircle2, ArrowRight,
  Ship, Anchor, CircleDollarSign, Layers, Container, Paperclip, Scale, FileText,
  Clock, AlertTriangle, Plus, Camera, Upload,
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
type Screen = "login" | "cu-signin" | "location" | "home" | "scan-log" | "register-log-form" | "log-inventory" | "schedule-inspection" | "inspection-details" | "inspection-info-details" | "physical-verification";
type InventoryTab = "all" | "modified";
type InspectionDay = "today" | "tomorrow" | "later";
type InspectionStatus = "pending" | "inprogress" | "complete";
type DayFilter = "today" | "upcoming";
type StatusFilter = "all" | InspectionStatus;
type SubInspectionStatus = "not-started" | "in-progress" | "completed";

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
}

const EMPTY_INSPECTION_PROGRESS: InspectionProgress = { preShipment: "not-started", loading: "not-started" };

interface FormState { email: string; password: string; showPassword: boolean; }

interface InventoryItem {
  id: number; species: string; length: number; diameter: number;
  volume: number; defectVolume: number; date: string; modified: boolean;
  logGroup: string; serialNo: string; batchNo: string; defReason: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BG_URL = bgImage;

const GRADIENT = "linear-gradient(135deg,#1a45b5 0%,#0f2f8f 60%,#0a1f6b 100%)";

const SESSION_KEY = "sustainscan-session";

interface AppSession {
  screen: Screen;
  userType: UserType;
  location: string;
  dark: boolean;
  selectedInspectionId: string | null;
}

const AUTHENTICATED_SCREENS: Screen[] = [
  "location", "home", "scan-log", "register-log-form", "log-inventory", "schedule-inspection", "inspection-details", "inspection-info-details", "physical-verification",
];

const INSPECTION_TASK_SCREENS: Screen[] = ["inspection-details", "inspection-info-details", "physical-verification"];

function loadSession(): AppSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<AppSession>;
    if (
      typeof data.screen !== "string" ||
      !AUTHENTICATED_SCREENS.includes(data.screen as Screen) ||
      (data.userType !== "client" && data.userType !== "cu") ||
      typeof data.location !== "string" ||
      typeof data.dark !== "boolean"
    ) {
      return null;
    }
    let screen = data.screen as Screen;
    const selectedInspectionId = typeof data.selectedInspectionId === "string" ? data.selectedInspectionId : null;
    // Guard against restoring a task-dependent screen whose task no longer resolves
    // (e.g. the referenced id was lost) — fall back to the list instead of a blank screen.
    if (INSPECTION_TASK_SCREENS.includes(screen) && !SCHEDULED_INSPECTIONS.some(t => t.id === selectedInspectionId)) {
      screen = "schedule-inspection";
    }
    return {
      screen,
      userType: data.userType,
      location: data.location,
      dark: data.dark,
      selectedInspectionId: INSPECTION_TASK_SCREENS.includes(screen) ? selectedInspectionId : null,
    };
  } catch {
    return null;
  }
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
  return (
    <>
      <div className="absolute inset-0 bg-emerald-900"
        style={{ backgroundImage: `url(${BG_URL})`, backgroundSize: "cover", backgroundPosition: "18% center", filter: "blur(3px) brightness(0.68) saturate(1.15)", transform: "scale(1.05)" }}
        aria-hidden="true" />
      <div className="absolute inset-0" style={{ background: "rgba(10,22,70,0.45)" }} aria-hidden="true" />
    </>
  );
}

function PoweredBy() {
  return (
    <div className="flex flex-col items-center gap-2 pb-4">
      <span className="text-[10px] font-medium uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.45)" }}>Powered by</span>
      <img src={controlUnionLogo} alt="Control Union" className="h-7 object-contain drop-shadow-lg" />
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
      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 hover:scale-105 focus:outline-none"
      style={{
        background: dark ? "rgba(255,255,255,0.1)" : "#ffffff",
        color: dark ? "#ffffff" : "#0a1a4a",
        border: dark ? "1px solid rgba(255,255,255,0.14)" : "1px solid rgba(15,47,143,0.14)",
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
    <div className="flex items-center justify-between gap-3 w-full min-w-0 overflow-hidden">
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

function HomeScreen({ location, onLogout, onNavigate, isCU, dark, setDark }: {
  location: string; onLogout: () => void; onNavigate: (s: Screen) => void;
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
    <div className="min-h-screen w-full transition-colors duration-300 animate-fadeIn" style={{ background: bg, fontFamily: "'Inter', sans-serif" }}>
      <AppHeaderBar dark={dark}>
        <PageHeader
          dark={dark}
          onDarkToggle={() => setDark(!dark)}
          extra={ProfileButton}
        />
      </AppHeaderBar>

      <div className="w-full max-w-[480px] mx-auto flex flex-col px-5 pt-5 pb-5 gap-6">

        {/* ── Greeting card ── */}
        <div className="rounded-2xl px-5 py-5" style={{ background: GRADIENT, boxShadow: "0 4px 20px rgba(15,47,143,0.35)" }}>
          <p className="text-2xl font-bold tracking-tight text-white">Hello, Thilina 👋</p>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.75)" }}>{formatDate(new Date())}</p>
          <div className="flex items-center gap-2 mt-3">
            <MapPin size={14} style={{ color: "rgba(255,255,255,0.85)", flexShrink: 0 }} />
            <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.9)" }}>{location}</span>
          </div>
        </div>

        {/* ── Action cards ── */}
        <div className="flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: dark ? "rgba(255,255,255,0.55)" : "#5a6a99" }}>Actions</p>

          <button onClick={() => onNavigate("scan-log")}
            className="w-full rounded-2xl p-5 flex items-center gap-5 text-left group transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] focus:outline-none shadow-sm hover:shadow-md"
            style={{ ...subCardGlass, background: cardBg, border: `1px solid ${cardBorder}` }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
              {isCU ? <ScanLine size={26} style={{ color: iconColor }} /> : <ClipboardList size={26} style={{ color: iconColor }} />}
            </div>
            <div className="flex-1">
              <p className="text-base font-bold" style={{ color: textPrimary }}>{isCU ? "Scan Log" : "Register Log"}</p>
              <p className="text-xs mt-0.5" style={{ color: textMuted }}>
                {isCU ? "View scanned log details" : "Record new sustainability entry"}
              </p>
            </div>
            <ChevronRight size={18} style={{ color: textMuted }} className="group-hover:translate-x-0.5 transition-transform duration-150" />
          </button>

          <button onClick={() => onNavigate("log-inventory")}
            className="w-full rounded-2xl p-5 flex items-center gap-5 text-left group transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] focus:outline-none shadow-sm hover:shadow-md"
            style={{ ...subCardGlass, background: cardBg, border: `1px solid ${cardBorder}` }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
              <Package size={26} style={{ color: iconColor }} />
            </div>
            <div className="flex-1">
              <p className="text-base font-bold" style={{ color: textPrimary }}>Log Inventory</p>
              <p className="text-xs mt-0.5" style={{ color: textMuted }}>Update stock and material records</p>
            </div>
            <ChevronRight size={18} style={{ color: textMuted }} className="group-hover:translate-x-0.5 transition-transform duration-150" />
          </button>

          {isCU && (
            <button onClick={() => onNavigate("schedule-inspection")}
              className="w-full rounded-2xl p-5 flex items-center gap-5 text-left group transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] focus:outline-none shadow-sm hover:shadow-md"
              style={{ ...subCardGlass, background: cardBg, border: `1px solid ${cardBorder}` }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
                <Calendar size={26} style={{ color: iconColor }} />
              </div>
              <div className="flex-1">
                <p className="text-base font-bold" style={{ color: textPrimary }}>Schedule Inspection</p>
                <p className="text-xs mt-0.5" style={{ color: textMuted }}>Plan and manage upcoming inspections</p>
              </div>
              <ChevronRight size={18} style={{ color: textMuted }} className="group-hover:translate-x-0.5 transition-transform duration-150" />
            </button>
          )}
        </div>

        <div className="flex-1" />

        {/* ── Sync bar ── */}
        <div className="rounded-2xl px-5 py-4 flex flex-col gap-3" style={{ ...subCardGlass, background: surface, border: `1px solid ${surfaceBorder}` }}>
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

// ─── Scan Log Screen ──────────────────────────────────────────────────────────

function ScanLogScreen({ dark, onBack, onScanNew, onOpenExisting, isCU }: {
  dark: boolean;
  onBack: () => void;
  onScanNew: () => void;
  onOpenExisting: () => void;
  isCU?: boolean;
}) {
  const [registeredDialogOpen, setRegisteredDialogOpen] = useState(false);

  const bg = dark ? "#0f172a" : "#f0f4ff";
  const surface = dark ? "rgba(30, 41, 59, 0.55)" : "rgba(255, 255, 255, 0.5)";
  const surfaceBorder = dark ? "rgba(255,255,255,0.1)" : "rgba(15,47,143,0.12)";
  const subCardGlass = { backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" } as const;
  const textPrimary = dark ? "#ffffff" : "#0a1a4a";
  const textMuted = dark ? "#ffffff" : "#5a6a99";

  const handleQrTap = () => (isCU ? onOpenExisting() : onScanNew());

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
            <h1 className="text-[18px] font-bold tracking-tight" style={{ color: dark ? "#ffffff" : "#0a1a4a" }}>
              Scan Log
            </h1>
            <p className="text-xs" style={{ color: textMuted }}>
              {isCU ? "View scanned log details" : "Record a new log entry"}
            </p>
          </div>
        </div>
      </AppHeaderBar>

      <div className="w-full max-w-[480px] mx-auto flex flex-col px-5 py-5 gap-5">
        <p className="text-sm" style={{ color: textMuted }}>
          {isCU ? "Scan a QR code to view registered log details." : "Tap the QR code below to register a new log entry."}
        </p>

        {/* QR card — the QR itself is the tap target */}
        <div className="flex flex-col items-center gap-5 rounded-2xl px-6 py-8"
          style={{ ...subCardGlass, background: surface, border: `1px solid ${surfaceBorder}` }}>
          <button
            onClick={handleQrTap}
            className="relative focus:outline-none group active:scale-95 transition-transform duration-150"
            aria-label={isCU ? "Scan QR code to view log" : "Scan QR code"}>
            {["top-0 left-0 border-t-2 border-l-2 rounded-tl-lg",
              "top-0 right-0 border-t-2 border-r-2 rounded-tr-lg",
              "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg",
              "bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg"].map((cls, i) => (
              <div key={i} className={`absolute w-7 h-7 ${cls}`} style={{ borderColor: "#0f2f8f", zIndex: 2 }} />
            ))}
            <img src={qrCode} alt="SustainScan QR Code"
              className="w-60 h-60 object-contain rounded-xl group-hover:opacity-85 transition-opacity duration-150"
              style={{ background: "#ffffff", padding: "8px" }} />
          </button>
          <div className="text-center">
            <button
              type="button"
              onClick={() => (isCU ? onOpenExisting() : setRegisteredDialogOpen(true))}
              className="text-sm font-semibold underline-offset-2 hover:underline focus:outline-none"
              style={{ color: textPrimary }}>
              SustainScan Log Entry
            </button>
            <p className="text-xs mt-1" style={{ color: textMuted }}>
              {isCU ? "Tap the QR code or title to view log details" : "Tap the QR code for a new entry · tap the title to view existing"}
            </p>
          </div>
        </div>

        {registeredDialogOpen && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center px-5"
            style={{ background: "rgba(10, 22, 70, 0.55)", backdropFilter: "blur(4px)" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-registered-title"
            onClick={() => setRegisteredDialogOpen(false)}>
            <div
              className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-5 shadow-2xl"
              style={{ background: "#ffffff", border: "1px solid #e8edf9" }}
              onClick={e => e.stopPropagation()}>
              <div className="flex flex-col gap-2 text-center">
                <h2 id="qr-registered-title" className="text-base font-bold" style={{ color: "#0a1a4a" }}>
                  QR Code Already Registered
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: "#5a6a99" }}>
                  This QR code is already registered. Do you want to view the existing log details?
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setRegisteredDialogOpen(false)}
                  className="flex-1 rounded-xl py-3 text-sm font-semibold transition-all duration-200 hover:bg-gray-50 focus:outline-none"
                  style={{ background: "#f0f4ff", color: "#0f2f8f", border: "1px solid #dce4f5" }}>
                  No
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRegisteredDialogOpen(false);
                    onOpenExisting();
                  }}
                  className="flex-1 rounded-xl py-3 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98] focus:outline-none"
                  style={{ background: GRADIENT, boxShadow: "0 4px 16px rgba(15,47,143,0.35)" }}>
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
            <div key={i} className="flex items-start gap-2 mb-2">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                style={{ background: "rgba(15,47,143,0.1)", color: "#0f2f8f" }}>{i + 1}</span>
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
  productName: string;
  lotNumber: string;
  length: string;
  diameter: string;
  volume: string;
  defectVolume: string;
  note: string;
  status: string;
}

const EMPTY_REGISTER_LOG: RegisterLogFormData = {
  serialNo: "",
  regDate: "",
  productGroup: "",
  productName: "",
  lotNumber: "",
  length: "",
  diameter: "",
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
  productName: "Taun",
  lotNumber: "LOT-2026-042",
  length: "10.0",
  diameter: "11.0",
  volume: "12.0",
  defectVolume: "1.2",
  note: "Previously registered — review details before updating.",
  status: "AVAILABLE",
};

const PRODUCT_GROUPS = ["Group 1", "Group 2"] as const;

const PRODUCT_NAMES: Record<(typeof PRODUCT_GROUPS)[number], string[]> = {
  "Group 1": [...TIMBER_SPECIES.slice(0, 17)],
  "Group 2": [...TIMBER_SPECIES.slice(17, 24)],
};

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold" style={{ color: "#0a1a4a" }}>
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
  const [productName, setProductName] = useState(initial.productName);
  const [lotNumber, setLotNumber] = useState(initial.lotNumber);
  const [length, setLength] = useState(initial.length);
  const [diameter, setDiameter] = useState(initial.diameter);
  const [volume, setVolume] = useState(initial.volume);
  const [defectVolume, setDefectVolume] = useState(initial.defectVolume);
  const [note, setNote] = useState(initial.note);
  const [status, setStatus] = useState(initial.status);
  const [pgOpen, setPgOpen] = useState(false);
  const [pnOpen, setPnOpen] = useState(false);

  const fieldStyle = viewOnly
    ? { ...inputStyle, background: "#eef1f6", color: "#5a6a99", cursor: "not-allowed" as const }
    : inputStyle;

  return (
    <div className="min-h-screen w-full animate-fadeIn" style={{ background: "#ffffff", fontFamily: "'Inter', sans-serif" }}>
      <AppHeaderBar>
        <div className="flex items-center gap-3">
          <BackCardButton onClick={onBack} />
          <div className="min-w-0">
            <h1 className="text-[18px] font-bold tracking-tight" style={{ color: "#0a1a4a" }}>
              {screenTitle}
            </h1>
            <p className="text-xs" style={{ color: "#5a6a99" }}>
              {viewOnly ? "View log details" : "Enter log registration details"}
            </p>
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
                <button type="button" onClick={() => { setPgOpen(v => !v); setPnOpen(false); }}
                  className="w-full rounded-xl px-4 py-3 text-sm text-left flex items-center justify-between focus:outline-none"
                  style={{ ...inputStyle, color: productGroup ? "#0a1a4a" : "#9ca3af", border: pgOpen ? "1px solid #60a5fa" : "1px solid #dce4f5" }}>
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

          {/* Product Name */}
          <FormField label="Product Name" required>
            {viewOnly ? (
              <input className={inputCls} style={fieldStyle} value={productName} readOnly />
            ) : (
              <div className="relative">
                <button type="button"
                  onClick={() => { if (productGroup) { setPnOpen(v => !v); setPgOpen(false); } }}
                  className="w-full rounded-xl px-4 py-3 text-sm text-left flex items-center justify-between focus:outline-none"
                  style={{ ...inputStyle, color: productName ? "#0a1a4a" : "#9ca3af", border: pnOpen ? "1px solid #60a5fa" : "1px solid #dce4f5", opacity: productGroup ? 1 : 0.5 }}>
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
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Length" required>
                <div className="relative">
                  <input type="number" className={inputCls} style={{ ...fieldStyle, paddingRight: "2.5rem" }} placeholder="0.00" step="0.01" min="0" value={length} onChange={e => setLength(e.target.value)} readOnly={viewOnly} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium pointer-events-none" style={{ color: "#94a3b8" }}>m</span>
                </div>
              </FormField>
              <FormField label="Diameter" required>
                <div className="relative">
                  <input type="number" className={inputCls} style={{ ...fieldStyle, paddingRight: "2.5rem" }} placeholder="0.00" step="0.01" min="0" value={diameter} onChange={e => setDiameter(e.target.value)} readOnly={viewOnly} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium pointer-events-none" style={{ color: "#94a3b8" }}>cm</span>
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
                style={{ border: "1px solid #dce4f5", background: "#f0f4ff" }}>
                <img
                  src={logEntryPhoto}
                  alt="Registered log — timber"
                  className="w-full h-52 object-contain p-2"
                />
              </div>
            ) : (
              <button type="button"
                className="w-full rounded-xl flex flex-col items-center justify-center gap-2 transition-all duration-150 hover:bg-blue-50 focus:outline-none"
                style={{ background: "#f8faff", border: "1px solid #dce4f5", height: "140px" }}>
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

function InventoryRow({ item, dark }: { item: InventoryItem; dark: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const textPrimary = dark ? "#ffffff" : "#0a1a4a";
  const textMuted = dark ? "rgba(255,255,255,0.65)" : "#5a6a99";
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
            {item.modified && (
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
          <div className="px-4 py-3" style={{ background: dark ? "rgba(255,255,255,0.04)" : "#f0f5ff", borderTop: `1px solid ${rowBorder}` }}>
            <button
              type="button"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold transition-all duration-150 hover:brightness-110 active:scale-[0.97] focus:outline-none"
              style={{ background: GRADIENT, color: "#ffffff", boxShadow: "0 2px 8px rgba(15,47,143,0.3)" }}>
              <QrCode size={13} />
              Change QR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const INSPECTION_STATUS_META: Record<InspectionStatus, { label: string; bg: string; color: string; rail: string; border: string; iconBg: string }> = {
  pending: {
    label: "Pending",
    bg: "rgba(15,47,143,0.07)",
    color: "#5a6a99",
    rail: GRADIENT,
    border: "rgba(15,47,143,0.10)",
    iconBg: "rgba(15,47,143,0.06)",
  },
  inprogress: {
    label: "In Progress",
    bg: "rgba(217,119,6,0.12)",
    color: "#b45309",
    rail: "linear-gradient(180deg,#f59e0b 0%,#d97706 100%)",
    border: "rgba(217,119,6,0.22)",
    iconBg: "rgba(217,119,6,0.10)",
  },
  complete: {
    label: "Complete",
    bg: "rgba(5,150,105,0.12)",
    color: "#047857",
    rail: "linear-gradient(180deg,#10b981 0%,#059669 100%)",
    border: "rgba(5,150,105,0.22)",
    iconBg: "rgba(5,150,105,0.10)",
  },
};

function resolveInspectionStatus(task: InspectionTask, progress: InspectionProgress): InspectionStatus {
  if (progress.preShipment === "completed" && progress.loading === "completed") return "complete";
  if (progress.preShipment !== "not-started" || progress.loading !== "not-started") return "inprogress";
  return task.status;
}

// ─── Schedule Inspection Screen ───────────────────────────────────────────────

function ScheduleInspectionScreen({
  onBack,
  onStartInspection,
  getProgress,
  exporter,
  concession,
}: {
  onBack: () => void;
  onStartInspection: (task: InspectionTask) => void;
  getProgress: (taskId: string) => InspectionProgress;
  exporter: string;
  concession: string;
}) {
  const [dayFilter, setDayFilter] = useState<DayFilter>("today");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [draftDay, setDraftDay] = useState<DayFilter>("today");
  const [draftStatus, setDraftStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [overlayBox, setOverlayBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const filtersActive = dayFilter !== "today" || statusFilter !== "all";

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
    setDraftDay(dayFilter);
    setDraftStatus(statusFilter);
    syncOverlayBox();
    setFilterOpen(true);
  };

  const closeFilters = () => setFilterOpen(false);

  const applyFilters = () => {
    setDayFilter(draftDay);
    setStatusFilter(draftStatus);
    setFilterOpen(false);
  };

  const resetDraftFilters = () => {
    setDraftDay("today");
    setDraftStatus("all");
  };

  const matchesDayFilter = (task: InspectionTask) =>
    dayFilter === "today" ? task.day === "today" : task.day === "tomorrow" || task.day === "later";

  const filtered = SCHEDULED_INSPECTIONS.filter(task => {
    const status = resolveInspectionStatus(task, getProgress(task.id));
    if (!matchesDayFilter(task)) return false;
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

  const dayChips: { id: DayFilter; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "upcoming", label: "Upcoming" },
  ];

  const statusChips: { id: StatusFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "pending", label: "Pending" },
    { id: "inprogress", label: "In Progress" },
    { id: "complete", label: "Complete" },
  ];

  const dayLabel = dayFilter === "today" ? "today" : "upcoming";
  const dayTotals = {
    today: SCHEDULED_INSPECTIONS.filter(t => t.day === "today").length,
    upcoming: SCHEDULED_INSPECTIONS.filter(t => t.day === "tomorrow" || t.day === "later").length,
  };

  const ctaLabel = (task: InspectionTask) => {
    const status = resolveInspectionStatus(task, getProgress(task.id));
    if (status === "complete") return "View Inspection";
    if (status === "inprogress") return "Continue Inspection";
    return "Start Inspection";
  };

  return (
    <div
      className="relative h-full-screen w-full flex flex-col overflow-hidden animate-fadeIn"
      style={{
        background: "linear-gradient(165deg, #dce6fb 0%, #eef2ff 32%, #f5f7ff 68%, #f0f4ff 100%)",
        fontFamily: "'Inter', sans-serif",
        color: "#0a1a4a",
      }}
    >
      {/* Soft atmospheric washes */}
      <div
        className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(26,69,181,0.18) 0%, transparent 70%)" }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-[42%] -left-20 w-64 h-64 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(15,47,143,0.10) 0%, transparent 72%)" }}
        aria-hidden="true"
      />

      {/* Sticky chrome: 1 Header → 2 Assignment → 3 Search → 4 Tabs → 5 Summary */}
      <div
        className="relative z-40 shrink-0 w-full"
        style={{
          background: "linear-gradient(165deg, #dce6fb 0%, #eef2ff 32%, #f5f7ff 68%, #f0f4ff 100%)",
        }}
      >
        {/* 1. Top Screen Header */}
        <AppHeaderBar>
          <div className="flex items-center gap-3">
            <BackCardButton onClick={onBack} />
            <div className="min-w-0">
              <h1 className="text-[18px] font-bold tracking-tight" style={{ color: "#0a1a4a" }}>
                Schedule Inspection
              </h1>
            </div>
          </div>
        </AppHeaderBar>

        <div className="w-full max-w-[480px] mx-auto flex flex-col px-4 sm:px-5 pt-4 pb-3 gap-3.5">
          {/* 2. Assignment Context Card */}
          <div
            className="relative overflow-hidden rounded-2xl p-3.5 sm:p-4 animate-riseIn"
            style={{
              ["--rise-delay" as string]: "20ms",
              background: GRADIENT,
              boxShadow: "0 10px 28px rgba(15,47,143,0.28)",
            }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 55%)" }}
              aria-hidden="true"
            />

            <div className="relative z-10 flex flex-col gap-3.5">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.18)" }}
                >
                  <ClipboardList size={17} style={{ color: "#ffffff" }} />
                </div>
                <h2 className="text-[15px] font-bold text-white tracking-tight">Assignment</h2>
              </div>

              <div
                className="rounded-xl px-3 py-3 grid grid-cols-2 gap-2.5 sm:gap-3"
                style={{
                  background: "rgba(255,255,255,0.10)",
                  border: "1px solid rgba(255,255,255,0.14)",
                }}
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "rgba(255,255,255,0.58)" }}>
                    Exporter
                  </p>
                  <p className="text-[12px] sm:text-[13px] font-semibold text-white mt-1 leading-snug break-words">{exporter}</p>
                </div>
                <div className="min-w-0 pl-2.5 sm:pl-3" style={{ borderLeft: "1px solid rgba(255,255,255,0.16)" }}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "rgba(255,255,255,0.58)" }}>
                    Concession
                  </p>
                  <p className="text-[12px] sm:text-[13px] font-semibold text-white mt-1 leading-snug break-words">{concession}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Search & Filter Controls */}
          <div className="flex items-center gap-2.5 animate-riseIn" style={{ ["--rise-delay" as string]: "40ms" }}>
            <div
              className="flex-1 min-w-0 flex items-center gap-3 h-12 px-3.5 rounded-2xl transition-[box-shadow,border-color,background] duration-200"
              style={{
                background: searchFocused ? "#ffffff" : "rgba(255,255,255,0.88)",
                border: `1.5px solid ${searchFocused ? "rgba(15,47,143,0.35)" : "rgba(15,47,143,0.12)"}`,
                boxShadow: searchFocused
                  ? "0 0 0 4px rgba(15,47,143,0.10), 0 8px 24px rgba(15,47,143,0.08)"
                  : "0 2px 10px rgba(15,47,143,0.05)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <Search size={17} style={{ color: searchFocused ? "#0f2f8f" : "#5a6a99", flexShrink: 0 }} />
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search inspection ID or location"
                className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-[#5a6a99]/70"
                style={{ color: "#0a1a4a" }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 focus:outline-none"
                  style={{ background: "rgba(15,47,143,0.10)", color: "#5a6a99" }}
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={openFilters}
              className="relative w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 focus:outline-none active:scale-95 transition-all duration-200"
              style={{
                background: filtersActive ? GRADIENT : "rgba(255,255,255,0.88)",
                color: filtersActive ? "#ffffff" : "#0f2f8f",
                border: `1.5px solid ${filtersActive ? "transparent" : "rgba(15,47,143,0.12)"}`,
                boxShadow: filtersActive
                  ? "0 6px 18px rgba(15,47,143,0.28)"
                  : "0 2px 10px rgba(15,47,143,0.05)",
              }}
              aria-label="Open filters"
              aria-expanded={filterOpen}
            >
              <ListFilter size={19} />
              {filtersActive && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white"
                  style={{ background: "#d4183d" }}
                />
              )}
            </button>
          </div>

          {/* 4. Time Tabs */}
          <div
            className="flex p-1 rounded-2xl animate-riseIn"
            style={{
              ["--rise-delay" as string]: "90ms",
              background: "rgba(255,255,255,0.72)",
              border: "1px solid rgba(15,47,143,0.10)",
              boxShadow: "0 2px 10px rgba(15,47,143,0.04)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
            }}
            role="tablist"
            aria-label="Schedule day"
          >
            {dayChips.map(chip => {
              const active = dayFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setDayFilter(chip.id)}
                  className="flex-1 relative h-10 rounded-xl text-[13px] font-semibold focus:outline-none transition-all duration-200 active:scale-[0.98]"
                  style={{
                    background: active ? GRADIENT : "transparent",
                    color: active ? "#ffffff" : "#5a6a99",
                    boxShadow: active ? "0 4px 14px rgba(15,47,143,0.28)" : "none",
                  }}
                >
                  <span className="inline-flex items-center justify-center gap-1.5">
                    {chip.label}
                    <span
                      className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold tabular-nums"
                      style={{
                        background: active ? "rgba(255,255,255,0.22)" : "rgba(15,47,143,0.08)",
                        color: active ? "#ffffff" : "#0f2f8f",
                      }}
                    >
                      {dayTotals[chip.id]}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 6. Inspection Cards Scroll List */}
      <div
        className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="w-full max-w-[480px] mx-auto flex flex-col px-4 sm:px-5 pt-1 pb-[max(6rem,env(safe-area-inset-bottom))] gap-3.5">
          {filtered.length === 0 ? (
            <div
              className="rounded-2xl p-8 text-center flex flex-col items-center gap-3 animate-riseIn"
              style={{
                ["--rise-delay" as string]: "160ms",
                background: "rgba(255,255,255,0.88)",
                border: "1px dashed rgba(15,47,143,0.22)",
                boxShadow: "0 4px 20px rgba(15,47,143,0.05)",
              }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(15,47,143,0.08)", color: "#0f2f8f" }}
              >
                <ClipboardList size={26} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "#0a1a4a" }}>
                  Nothing scheduled {dayLabel}
                </p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "#5a6a99" }}>
                  Try another day, adjust filters, or clear your search.
                </p>
              </div>
            </div>
          ) : (
            filtered.map((task, index) => {
              const status = resolveInspectionStatus(task, getProgress(task.id));
              const meta = INSPECTION_STATUS_META[status];
              return (
                <article
                  key={task.id}
                  className="relative overflow-hidden rounded-2xl flex flex-col animate-riseIn"
                  style={{
                    ["--rise-delay" as string]: `${160 + index * 55}ms`,
                    background: "#ffffff",
                    border: `1px solid ${meta.border}`,
                    boxShadow: "0 8px 24px rgba(15,47,143,0.07), 0 1px 3px rgba(15,47,143,0.04)",
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
                          className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-semibold"
                          style={{ background: meta.bg, color: meta.color }}
                        >
                          {status === "complete" && <CheckCircle2 size={10} strokeWidth={2.5} />}
                          {status === "inprogress" && <Clock size={10} strokeWidth={2.5} />}
                          {meta.label}
                        </span>
                      </div>
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{
                          background: meta.iconBg,
                          color: meta.color,
                        }}
                      >
                        <Ship size={16} />
                      </div>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <h3 className="text-[15px] font-bold leading-snug tracking-tight tabular-nums" style={{ color: "#0a1a4a" }}>
                        {task.shipment}
                      </h3>
                    </div>

                    {/* Iconized meta row */}
                    <div
                      className="grid grid-cols-3 gap-1.5 sm:gap-2 rounded-xl p-2 sm:p-2.5"
                      style={{ background: "rgba(240,244,255,0.9)", border: "1px solid rgba(15,47,143,0.06)" }}
                    >
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider" style={{ color: "#5a6a99" }}>
                          <MapPin size={10} className="flex-shrink-0" /> Location
                        </span>
                        <span className="text-[10px] sm:text-[11px] font-semibold break-words leading-snug" style={{ color: "#0a1a4a" }}>
                          {task.location}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 min-w-0 border-x px-1.5 sm:px-2" style={{ borderColor: "rgba(15,47,143,0.08)" }}>
                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider" style={{ color: "#5a6a99" }}>
                          <Calendar size={10} className="flex-shrink-0" /> Window
                        </span>
                        <span className="text-[10px] sm:text-[11px] font-semibold break-words leading-snug" style={{ color: "#0a1a4a" }}>
                          {task.time}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider" style={{ color: "#5a6a99" }}>
                          <Layers size={10} className="flex-shrink-0" /> Volume
                        </span>
                        <span className="text-[10px] sm:text-[11px] font-semibold break-words leading-snug" style={{ color: "#0a1a4a" }}>
                          {task.logs} logs
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onStartInspection(task)}
                      className="group w-full h-12 rounded-xl text-sm font-semibold text-white focus:outline-none active:scale-[0.98] transition-all duration-200 hover:brightness-110 flex items-center justify-center gap-2"
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
              background: "rgba(10,22,70,0.45)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
            aria-label="Close filters"
            onClick={closeFilters}
          />
          <div
            className="relative z-10 w-full rounded-t-[28px] px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col gap-5 animate-riseIn"
            style={{
              background: "linear-gradient(180deg, #ffffff 0%, #f7f9ff 100%)",
              boxShadow: "0 -12px 40px rgba(15,47,143,0.18)",
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Filter inspections"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-1 rounded-full" style={{ background: "rgba(15,47,143,0.18)" }} />
              <div className="w-full flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#5a6a99" }}>
                  Filters
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={resetDraftFilters}
                    className="text-xs font-semibold focus:outline-none"
                    style={{ color: "#0f2f8f" }}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={closeFilters}
                    className="w-8 h-8 rounded-xl flex items-center justify-center focus:outline-none"
                    style={{ background: "rgba(15,47,143,0.08)", color: "#0f2f8f" }}
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <label htmlFor="filter-schedule" className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#5a6a99" }}>
                Schedule
              </label>
              <div className="relative">
                <select
                  id="filter-schedule"
                  value={draftDay}
                  onChange={e => setDraftDay(e.target.value as DayFilter)}
                  className="w-full h-12 appearance-none rounded-2xl pl-4 pr-10 text-sm font-semibold outline-none focus:outline-none transition-[box-shadow,border-color] duration-200"
                  style={{
                    background: "#ffffff",
                    border: "1.5px solid rgba(15,47,143,0.14)",
                    color: "#0a1a4a",
                    boxShadow: "0 2px 10px rgba(15,47,143,0.04)",
                  }}
                >
                  {dayChips.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2"
                  style={{ color: "#5a6a99" }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <label htmlFor="filter-status" className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#5a6a99" }}>
                Status
              </label>
              <div className="relative">
                <select
                  id="filter-status"
                  value={draftStatus}
                  onChange={e => setDraftStatus(e.target.value as StatusFilter)}
                  className="w-full h-12 appearance-none rounded-2xl pl-4 pr-10 text-sm font-semibold outline-none focus:outline-none transition-[box-shadow,border-color] duration-200"
                  style={{
                    background: "#ffffff",
                    border: "1.5px solid rgba(15,47,143,0.14)",
                    color: "#0a1a4a",
                    boxShadow: "0 2px 10px rgba(15,47,143,0.04)",
                  }}
                >
                  {statusChips.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2"
                  style={{ color: "#5a6a99" }}
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

const SUB_STATUS_CONFIG: Record<SubInspectionStatus, { label: string; bg: string; color: string }> = {
  "not-started": { label: "Not Started", bg: "rgba(90,106,153,0.12)", color: "#5a6a99" },
  "in-progress": { label: "In Progress", bg: "rgba(15,47,143,0.10)", color: "#0f2f8f" },
  "completed": { label: "Completed", bg: "rgba(16,185,129,0.12)", color: "#059669" },
};

function SubInspectionStatusPill({ status }: { status: SubInspectionStatus }) {
  const cfg = SUB_STATUS_CONFIG[status];
  return (
    <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-semibold flex-shrink-0" style={{ background: cfg.bg, color: cfg.color }}>
      {status === "in-progress" && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: cfg.color }} />}
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
      title: "Exporter Approved Price Endorsement",
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
      return [
        ["APE Reference", "APE-2026-118"],
        ["Species Groups", "4 groups"],
        ["Price Rows", "11 rows"],
        ["Currency", "USD"],
        ["Total Permitted Vol.", `${(task.logs * 2.1).toFixed(2)} m³`],
        ["Avg. FOB", "$420.00 / m³"],
        ["Approved On", "22 Jan 2026"],
        ["Valid Until", "22 Jul 2026"],
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

function useInspectionInfoTheme(dark: boolean) {
  return {
    bg: dark ? "#0f172a" : "#eef2fb",
    textPrimary: dark ? "#ffffff" : "#0a1a4a",
    textMuted: dark ? "rgba(255,255,255,0.65)" : "#5a6a99",
    textFaint: dark ? "rgba(255,255,255,0.45)" : "#94a3b8",
    cardBg: dark ? "rgba(30, 41, 59, 0.72)" : "#ffffff",
    cardBorder: dark ? "rgba(255,255,255,0.08)" : "rgba(15,47,143,0.08)",
    cardShadow: dark ? "0 1px 0 rgba(255,255,255,0.04)" : "0 1px 2px rgba(15,47,143,0.05), 0 8px 24px rgba(15,47,143,0.06)",
    rowDivider: dark ? "rgba(255,255,255,0.08)" : "rgba(15,47,143,0.08)",
    iconBg: dark ? "rgba(255,255,255,0.10)" : "rgba(15,47,143,0.08)",
    iconColor: dark ? "#ffffff" : "#0f2f8f",
    badgeBg: dark ? "rgba(255,255,255,0.10)" : "rgba(15,47,143,0.07)",
    badgeColor: dark ? "#ffffff" : "#0f2f8f",
    chevronColor: dark ? "rgba(255,255,255,0.35)" : "#94a3b8",
    alertIconBg: "rgba(212,24,61,0.12)",
    groupLabel: dark ? "rgba(255,255,255,0.45)" : "#6b7aa8",
  };
}

function useSwipeBack(onBack: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);

  return {
    onTouchStart: (e: { touches: ArrayLike<{ clientX: number; clientY: number }> }) => {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
    },
    onTouchEnd: (e: { changedTouches: ArrayLike<{ clientX: number; clientY: number }> }) => {
      if (!start.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.current.x;
      const dy = Math.abs(t.clientY - start.current.y);
      start.current = null;
      if (dx > 72 && dy < 56) onBack();
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
  const textMuted = dark ? "rgba(255,255,255,0.55)" : "#6b7280";
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
            className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 focus:outline-none active:scale-[0.96] transition-transform"
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
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: textMuted }}>Permit Number</p>
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
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: textMuted }}>Licence Number</p>
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
  const textMuted = dark ? "rgba(255,255,255,0.55)" : "#6b7280";
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
            className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 focus:outline-none active:scale-[0.96] transition-transform"
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
  const textMuted = dark ? "rgba(255,255,255,0.55)" : "#6b7280";
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
            className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 focus:outline-none active:scale-[0.96] transition-transform"
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
}: {
  file: AttachmentFile;
  dark?: boolean;
  index?: number;
}) {
  const parsed = parseAttachment(file.fileName);
  const textPrimary = dark ? "#ffffff" : "#0a1a4a";
  const textMuted = dark ? "rgba(255,255,255,0.55)" : "#64748b";
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
    <button
      type="button"
      className="w-full text-left rounded-3xl p-4 animate-riseIn focus:outline-none active:scale-[0.99] transition-transform"
      style={{
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        background: cardBg,
        border: cardBorder,
        boxShadow: elevation,
        ["--rise-delay" as string]: `${60 + index * 50}ms`,
      }}
      aria-label={`View ${parsed.title}`}
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

        <span
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 self-center"
          style={{
            background: dark ? "rgba(15,47,143,0.35)" : "rgba(15,47,143,0.08)",
            color: accent,
            border: cardBorder,
          }}
          aria-hidden
        >
          <MaterialSymbol name="visibility" size={20} />
        </span>
      </div>
    </button>
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
  const textMuted = dark ? "rgba(255,255,255,0.55)" : "#64748b";
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
            className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 focus:outline-none active:scale-[0.96] transition-transform"
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

      <div className="w-full max-w-[480px] mx-auto flex flex-col px-5 py-6 gap-5">
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
}: {
  task: InspectionTask;
  dark: boolean;
  onBack: () => void;
}) {
  const [activeSectionId, setActiveSectionId] = useState<InspectionInfoSectionId | null>(null);
  const [loading, setLoading] = useState(true);
  const sections = getInspectionInfoSections(task);
  const activeSection = sections.find(s => s.id === activeSectionId) ?? null;
  const t = useInspectionInfoTheme(dark);
  const swipe = useSwipeBack(activeSection ? () => setActiveSectionId(null) : onBack);

  useEffect(() => {
    setLoading(true);
    const id = window.setTimeout(() => setLoading(false), 520);
    return () => window.clearTimeout(id);
  }, [task.id]);

  if (activeSection) {
    return (
      <InspectionInfoSectionDetailScreen
        task={task}
        section={activeSection}
        dark={dark}
        onBack={() => setActiveSectionId(null)}
      />
    );
  }

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
        <div className="w-full max-w-[480px] mx-auto flex flex-col px-5 py-6 gap-6">
          {/* Inset grouped lists */}
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
                  {rows.map((section, index) => (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setActiveSectionId(section.id)}
                      className="w-full px-3.5 py-3.5 flex items-center gap-3 text-left focus:outline-none active:opacity-70 transition-opacity"
                      style={{ borderTop: index === 0 ? undefined : `1px solid ${t.rowDivider}` }}
                      aria-label={`Open ${section.title}`}
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
                        className="inline-flex items-center h-6 px-2 rounded-md text-[10px] font-bold uppercase tracking-wider flex-shrink-0 max-w-[38%] truncate"
                        style={
                          section.alert
                            ? { background: "#d4183d", color: "#ffffff" }
                            : { background: t.badgeBg, color: t.badgeColor }
                        }
                      >
                        {section.badge}
                      </span>
                      <span
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 animate-nudgeRight"
                        style={{ background: GRADIENT, color: "#ffffff", boxShadow: "0 2px 8px rgba(15,47,143,0.28)" }}
                        aria-hidden
                      >
                        <ArrowRight size={14} />
                      </span>
                    </button>
                  ))}
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
}: {
  value: string;
  onChange: (iso: string) => void;
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

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full h-12 rounded-xl px-4 text-sm text-left flex items-center justify-between focus:outline-none transition-all"
        style={{
          ...inputStyle,
          border: open ? "1.5px solid rgba(15,47,143,0.45)" : "1px solid #dce4f5",
          boxShadow: open ? "0 0 0 3px rgba(15,47,143,0.10)" : "none",
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span style={{ color: value ? "#0a1a4a" : "#94a3b8" }}>
          {value ? formatDisplayDate(value) : "Select date"}
        </span>
        <Calendar size={16} style={{ color: "#5a6a99", flexShrink: 0 }} />
      </button>

      {open && (
        <div
          className="mt-2 rounded-2xl p-3 animate-riseIn"
          style={{
            background: "#f8faff",
            border: "1px solid rgba(15,47,143,0.12)",
          }}
          role="dialog"
          aria-label="Choose date"
        >
          <div className="flex items-center justify-between mb-2.5 px-0.5">
            <button
              type="button"
              onClick={() => setView(new Date(year, month - 1, 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center focus:outline-none"
              style={{ background: "rgba(15,47,143,0.06)", color: "#0f2f8f" }}
              aria-label="Previous month"
            >
              <ArrowLeft size={15} />
            </button>
            <p className="text-[13px] font-bold" style={{ color: "#0a1a4a" }}>{monthLabel}</p>
            <button
              type="button"
              onClick={() => setView(new Date(year, month + 1, 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center focus:outline-none"
              style={{ background: "rgba(15,47,143,0.06)", color: "#0f2f8f" }}
              aria-label="Next month"
            >
              <ArrowRight size={15} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={`${d}-${i}`} className="h-7 flex items-center justify-center text-[10px] font-semibold" style={{ color: "#94a3b8" }}>
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
                    background: isSelected ? GRADIENT : isToday ? "rgba(15,47,143,0.08)" : "transparent",
                    color: isSelected ? "#ffffff" : "#0a1a4a",
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
}: {
  stepKey: "preShipment" | "loading";
  date: string;
  onDateChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  overlayBox: { top: number; left: number; width: number; height: number };
}) {
  const title = stepKey === "preShipment"
    ? "Start Pre-Shipment Inspection"
    : "Start Loading Inspection";

  return createPortal(
    <div
      className="z-50 flex items-center justify-center px-5"
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
        onClick={onCancel}
      />
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl p-5 flex flex-col gap-5 shadow-2xl animate-riseIn"
        style={{ background: "#ffffff", border: "1px solid rgba(15,47,143,0.14)" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-inspection-title"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="start-inspection-title" className="text-base font-bold leading-snug" style={{ color: "#0a1a4a" }}>
          {title}
        </h2>

        <FormField label="Date" required>
          <CompactBlueDatePicker value={date} onChange={onDateChange} />
        </FormField>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-12 rounded-xl text-sm font-semibold transition-all duration-200 hover:bg-gray-50 focus:outline-none active:scale-[0.98]"
            style={{ background: "#f0f4ff", color: "#0f2f8f", border: "1px solid #dce4f5" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!date}
            className="flex-1 h-12 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: GRADIENT, boxShadow: "0 4px 16px rgba(15,47,143,0.35)" }}
          >
            Start
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function InspectionDetailsScreen({ task, progress, onBack, onViewFullInfo, onStartSession }: {
  task: InspectionTask;
  progress: InspectionProgress;
  onBack: () => void;
  onViewFullInfo: () => void;
  onStartSession: (key: "preShipment" | "loading") => void;
}) {
  const info = getShipmentDetailsData(task);
  const preShipmentDone = progress.preShipment === "completed";
  const [startDialogKey, setStartDialogKey] = useState<"preShipment" | "loading" | null>(null);
  const [startDate, setStartDate] = useState(todayISODate);
  const [overlayBox, setOverlayBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

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
    setStartDate(todayISODate());
    syncOverlayBox();
    setStartDialogKey(key);
  };

  const handleStepAction = (key: "preShipment" | "loading", isActive: boolean, isDisabled: boolean) => {
    if (isDisabled) return;
    if (isActive) onStartSession(key);
    else openStartDialog(key);
  };

  const confirmStart = () => {
    if (!startDialogKey || !startDate) return;
    const key = startDialogKey;
    setStartDialogKey(null);
    onStartSession(key);
  };

  return (
    <div className="relative min-h-screen w-full animate-fadeIn" style={{ background: "#f0f4ff", fontFamily: "'Inter', sans-serif" }}>
      <AppHeaderBar>
        <div className="flex items-center gap-3">
          <BackCardButton onClick={onBack} />
          <div className="min-w-0">
            <h1 className="text-[18px] font-bold tracking-tight truncate" style={{ color: "#0a1a4a" }}>{task.shipment}</h1>
          </div>
        </div>
      </AppHeaderBar>

      <div className="w-full max-w-[480px] mx-auto flex flex-col px-4 sm:px-5 py-5 gap-4">

        {/* Inspection Info — read only, tap to view full details */}
        <button
          type="button"
          onClick={onViewFullInfo}
          className="relative overflow-hidden w-full rounded-2xl p-3.5 sm:p-4 text-left focus:outline-none transition-all duration-200 active:scale-[0.99]"
          style={{ background: GRADIENT, boxShadow: "0 10px 28px rgba(15,47,143,0.28)" }}
          aria-label="View full inspection info"
        >
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
                <ClipboardList size={17} style={{ color: "#ffffff" }} />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-bold text-white tracking-tight">Inspection Info</h2>
                <p className="text-[13px] font-medium mt-1 leading-snug truncate" style={{ color: "rgba(255,255,255,0.78)" }}>
                  {task.exporter}
                </p>
              </div>

              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "#ffffff", color: "#0f2f8f" }}
              >
                <ArrowRight size={15} />
              </span>
            </div>

            <div
              className="rounded-xl px-3.5 py-3 grid grid-cols-2 gap-3"
              style={{
                background: "rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.14)",
              }}
            >
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "rgba(255,255,255,0.58)" }}>
                  Request No.
                </p>
                <p className="text-[15px] font-bold text-white mt-1 tabular-nums tracking-tight">#{info.referenceNo}</p>
              </div>
              <div className="min-w-0 pl-2.5 sm:pl-3" style={{ borderLeft: "1px solid rgba(255,255,255,0.16)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "rgba(255,255,255,0.58)" }}>
                  Concession
                </p>
                <p className="text-[12px] sm:text-[13px] font-semibold text-white mt-1 leading-snug break-words">{info.projectSite}</p>
              </div>
            </div>
          </div>
        </button>

        <p
          className="mb-2 text-xs font-bold uppercase tracking-wider"
          style={{ color: "#5a6a99" }}
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
            const isDisabled = isDone || isLocked;

            const ctaLabel = isDone
              ? "Completed"
              : isActive
                ? `Continue ${step.shortLabel}`
                : `Start ${step.shortLabel}`;

            return (
              <div key={step.key}>
                <div className="relative flex gap-4">
                  <div className="flex flex-col items-center flex-shrink-0" style={{ width: 48 }}>
                    <div
                      className="relative z-10 w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: "#ffffff",
                        color: isDone ? "#059669" : "#0f2f8f",
                        border: `2px solid ${isDone ? "rgba(5,150,105,0.35)" : "rgba(15,47,143,0.18)"}`,
                        boxShadow: isActive
                          ? "0 0 0 4px rgba(15,47,143,0.12), 0 0 16px rgba(15,47,143,0.35)"
                          : "0 1px 4px rgba(15,47,143,0.10)",
                      }}
                    >
                      {isDone ? <CheckCircle2 size={20} /> : step.icon}
                    </div>
                    {!isLast && (
                      <div
                        className="w-0.5 flex-1"
                        style={{ background: "linear-gradient(180deg, rgba(15,47,143,0.35), rgba(15,47,143,0.15))" }}
                        aria-hidden="true"
                      />
                    )}
                  </div>

                  <div
                    className="flex-1 min-w-0 rounded-2xl p-4 flex flex-col gap-2"
                    style={{ background: "#ffffff", border: "1px solid rgba(15,47,143,0.14)", boxShadow: "0 1px 4px rgba(15,47,143,0.06)" }}
                  >
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <h3 className="text-[15px] font-bold" style={{ color: "#0a1a4a" }}>
                        {idx + 1}. {step.title}
                      </h3>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "#5a6a99" }}>{step.description}</p>
                    <div><SubInspectionStatusPill status={status} /></div>

                    <button
                      type="button"
                      onClick={() => handleStepAction(step.key, isActive, isDisabled)}
                      disabled={isDisabled}
                      className="w-full h-12 mt-1 rounded-xl text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 focus:outline-none active:scale-[0.98] transition-all duration-200 hover:brightness-110 disabled:active:scale-100 disabled:hover:brightness-100 disabled:cursor-not-allowed"
                      style={{
                        background: isDone || isLocked ? "#eef1f6" : GRADIENT,
                        color: isDone || isLocked ? "#94a3b8" : "#ffffff",
                        boxShadow: isDone || isLocked ? "none" : "0 4px 16px rgba(15,47,143,0.30)",
                        opacity: isLocked ? 0.55 : 1,
                        border: isLocked ? "1px solid rgba(15,47,143,0.10)" : "none",
                      }}
                      aria-disabled={isDisabled}
                    >
                      {isDone ? (
                        <><CheckCircle2 size={16} /> {ctaLabel}</>
                      ) : (
                        <>{ctaLabel} <ChevronRight size={16} /></>
                      )}
                    </button>
                  </div>
                </div>

                {!isLast && (
                  <div className="flex gap-4" aria-hidden="true">
                    <div className="flex justify-center flex-shrink-0" style={{ width: 48 }}>
                      <div className="w-0.5 h-8" style={{ background: "linear-gradient(180deg, rgba(15,47,143,0.15), rgba(15,47,143,0.35))" }} />
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
        />
      )}
    </div>
  );
}

// ─── Pre-Shipment Inspection ──────────────────────────────────────────────────

type PreShipmentTab = "verification" | "non-compliance" | "attachments";
type NonComplianceView = "list" | "create";

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

function PhysicalVerificationScreen({
  task,
  onBack,
  onProceed,
}: {
  task: InspectionTask;
  onBack: () => void;
  onProceed: () => void;
}) {
  const [activeTab, setActiveTab] = useState<PreShipmentTab>("verification");
  const [volumeOk, setVolumeOk] = useState<"yes" | "no" | null>(null);
  const [nonConformanceReason, setNonConformanceReason] = useState("");
  const [photoAdded, setPhotoAdded] = useState(false);
  const [ncView, setNcView] = useState<NonComplianceView>("list");
  const [selectedNcTypes, setSelectedNcTypes] = useState<string[]>([]);
  const [ncDescription, setNcDescription] = useState("");

  const handleNcTypeToggle = (type: string) => {
    setSelectedNcTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const declaredM3 = task.logs * 21.875;
  const thresholdM3 = declaredM3 * 0.95;
  const formatVol = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const tabs: { id: PreShipmentTab; label: string; short: string }[] = [
    { id: "verification", label: "Verification", short: "Verify" },
    { id: "non-compliance", label: "Non-Compliance", short: "NC" },
    { id: "attachments", label: "Attachments", short: "Files" },
  ];

  return (
    <div
      className="h-full-screen w-full flex flex-col overflow-hidden animate-fadeIn"
      style={{ background: "#f0f4ff", fontFamily: "'Inter', sans-serif" }}
    >
      <AppHeaderBar>
        <div className="flex items-center gap-3 min-w-0">
          <BackCardButton onClick={onBack} />
          <div className="min-w-0">
            <h1 className="text-[16px] sm:text-[18px] font-bold tracking-tight truncate" style={{ color: "#0a1a4a" }}>
              Pre-Shipment Inspection
            </h1>
          </div>
        </div>
      </AppHeaderBar>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
      <div className="w-full max-w-[480px] mx-auto flex flex-col px-4 sm:px-5 py-4 sm:py-5 gap-4">
        {/* Tabs — above stepper */}
        <div
          className="flex p-1 rounded-2xl gap-0.5"
          style={{
            background: "rgba(255,255,255,0.88)",
            border: "1px solid rgba(15,47,143,0.10)",
            boxShadow: "0 2px 10px rgba(15,47,143,0.05)",
          }}
          role="tablist"
          aria-label="Pre-shipment sections"
        >
          {tabs.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id !== "non-compliance") setNcView("list");
                }}
                className="flex-1 min-w-0 h-10 rounded-xl text-[11px] sm:text-[12px] font-semibold focus:outline-none transition-all duration-200 active:scale-[0.98] px-1"
                style={{
                  background: active ? GRADIENT : "transparent",
                  color: active ? "#ffffff" : "#5a6a99",
                  boxShadow: active ? "0 4px 12px rgba(15,47,143,0.25)" : "none",
                }}
              >
                <span className="sm:hidden truncate block">{tab.short}</span>
                <span className="hidden sm:inline truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {activeTab === "verification" && (
        <>
        {/* Progress — blue card */}
        <div
          className="relative overflow-hidden rounded-2xl px-3.5 sm:px-4 py-4 flex flex-col gap-3"
          style={{ background: GRADIENT, boxShadow: "0 10px 26px rgba(15,47,143,0.30)" }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.00) 58%)" }}
            aria-hidden="true"
          />

          <div className="relative z-10 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.78)" }}>
              Current Step
            </p>
            <span
              className="text-[11px] font-semibold rounded-full px-2.5 py-1 flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.16)", color: "#ffffff" }}
            >
              1 / 2
            </span>
          </div>

          <p className="relative z-10 text-[14px] font-bold leading-snug" style={{ color: "#ffffff" }}>
            Physical verification
          </p>

          <div className="relative z-10 flex gap-2">
            {[0, 1].map(i => (
              <div
                key={i}
                className="h-2 flex-1 rounded-full transition-all duration-300"
                style={{
                  background: i === 0 ? "#ffffff" : "rgba(255,255,255,0.28)",
                  boxShadow: i === 0 ? "0 2px 10px rgba(255,255,255,0.38)" : "none",
                }}
              />
            ))}
          </div>

          <div className="relative z-10 grid grid-cols-2 gap-2 text-[9px] sm:text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.72)" }}>
            <span className="truncate">Physical verification</span>
            <span className="truncate text-right">Sample verification</span>
          </div>
        </div>

        {/* Declared volume card */}
        <div
          className="rounded-2xl p-3.5 sm:p-4 flex flex-col gap-4"
          style={{ background: "#ffffff", border: "1px solid rgba(15,47,143,0.08)", boxShadow: "0 2px 12px rgba(15,47,143,0.06)" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#5a6a99" }}>
            Declared Volume
          </p>
          <div className="flex items-end gap-2 sm:gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[22px] sm:text-[28px] font-bold leading-none tabular-nums break-all" style={{ color: "#0a1a4a" }}>
                {formatVol(declaredM3)}
              </p>
              <p className="text-[11px] sm:text-xs mt-1.5" style={{ color: "#5a6a99" }}>m³ declared</p>
            </div>
            <ArrowRight size={18} className="mb-4 sm:mb-5 flex-shrink-0" style={{ color: "#94a3b8" }} />
            <div className="flex-1 min-w-0 text-right">
              <p className="text-[22px] sm:text-[28px] font-bold leading-none tabular-nums break-all" style={{ color: "#059669" }}>
                {formatVol(thresholdM3)}
              </p>
              <p className="text-[11px] sm:text-xs mt-1.5" style={{ color: "#5a6a99" }}>m³ threshold (95%)</p>
            </div>
          </div>
          <div
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
            style={{ background: "#f3f5f9" }}
          >
            <MapPin size={14} className="flex-shrink-0" style={{ color: "#d4183d" }} />
            <p className="text-xs font-medium leading-snug" style={{ color: "#0a1a4a" }}>
              {task.location} — {task.exporter}
            </p>
          </div>
        </div>

        {/* Confirmation card */}
        <div
          className="rounded-2xl p-4 flex flex-col gap-4"
          style={{ background: "#ffffff", border: "1px solid rgba(15,47,143,0.08)", boxShadow: "0 2px 12px rgba(15,47,143,0.06)" }}
        >
          <div>
            <h2 className="text-[15px] font-bold leading-snug" style={{ color: "#0a1a4a" }}>
              Is ≥ 95% of declared volume physically present?
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3" role="group" aria-label="Volume confirmation">
            <button
              type="button"
              onClick={() => setVolumeOk(prev => (prev === "yes" ? null : "yes"))}
              className="rounded-2xl px-3.5 py-3 flex items-center gap-3 border transition-all duration-200 focus:outline-none"
              style={{
                background: volumeOk === "yes" ? "rgba(22,163,74,0.10)" : "#f8fafc",
                borderColor: volumeOk === "yes" ? "rgba(22,163,74,0.55)" : "rgba(15,47,143,0.14)",
                boxShadow: volumeOk === "yes" ? "0 6px 16px rgba(22,163,74,0.20)" : "none",
              }}
              aria-pressed={volumeOk === "yes"}
            >
              <span
                className="h-5 w-5 rounded-md border flex items-center justify-center text-[12px] font-black leading-none transition-all duration-200"
                style={{
                  background: volumeOk === "yes" ? "#16a34a" : "#ffffff",
                  borderColor: volumeOk === "yes" ? "#16a34a" : "rgba(15,47,143,0.25)",
                  color: "#ffffff",
                }}
              >
                {volumeOk === "yes" ? "✓" : ""}
              </span>
              <span className="text-sm font-bold" style={{ color: volumeOk === "yes" ? "#166534" : "#0f2f8f" }}>
                Yes
              </span>
            </button>

            <button
              type="button"
              onClick={() => setVolumeOk(prev => (prev === "no" ? null : "no"))}
              className="rounded-2xl px-3.5 py-3 flex items-center gap-3 border transition-all duration-200 focus:outline-none"
              style={{
                background: volumeOk === "no" ? "rgba(212,24,61,0.08)" : "#f8fafc",
                borderColor: volumeOk === "no" ? "rgba(212,24,61,0.45)" : "rgba(15,47,143,0.14)",
                boxShadow: volumeOk === "no" ? "0 6px 16px rgba(212,24,61,0.16)" : "none",
              }}
              aria-pressed={volumeOk === "no"}
            >
              <span
                className="h-5 w-5 rounded-md border flex items-center justify-center text-[12px] font-black leading-none transition-all duration-200"
                style={{
                  background: volumeOk === "no" ? "#d4183d" : "#ffffff",
                  borderColor: volumeOk === "no" ? "#d4183d" : "rgba(15,47,143,0.25)",
                  color: "#ffffff",
                }}
              >
                {volumeOk === "no" ? "✓" : ""}
              </span>
              <span className="text-sm font-bold" style={{ color: volumeOk === "no" ? "#9f1239" : "#0f2f8f" }}>
                No
              </span>
            </button>
          </div>

          {volumeOk === "yes" && (
            <button
              type="button"
              onClick={onProceed}
              className="w-full min-h-[48px] rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 focus:outline-none active:scale-[0.98] transition-all"
              style={{ background: GRADIENT, boxShadow: "0 6px 18px rgba(15,47,143,0.30)" }}
            >
              Proceed
              <ArrowRight size={16} />
            </button>
          )}

          {volumeOk === "no" && (
            <div
              className="rounded-2xl p-3.5 flex flex-col gap-3"
              style={{ background: "#fff6f8", border: "1px solid rgba(212,24,61,0.20)" }}
            >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#9f1239" }}>
                  NON-CONFORMANCE REASON
                </p>
                <textarea
                  value={nonConformanceReason}
                  onChange={e => setNonConformanceReason(e.target.value)}
                  rows={3}
                  placeholder="Enter reason for non-conformance"
                  className="w-full mt-2 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none"
                  style={{ background: "#ffffff", border: "1px solid rgba(212,24,61,0.25)", color: "#0a1a4a" }}
                />
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#9f1239" }}>
                  ADD PHOTO
                </p>
                <button
                  type="button"
                  onClick={() => setPhotoAdded(v => !v)}
                  className="w-full rounded-xl px-3.5 py-3 flex items-center justify-between focus:outline-none transition-all duration-200"
                  style={{
                    background: photoAdded ? "rgba(22,163,74,0.10)" : "#ffffff",
                    border: photoAdded ? "1px solid rgba(22,163,74,0.45)" : "1px solid rgba(212,24,61,0.25)",
                  }}
                >
                  <span className="text-sm font-semibold" style={{ color: photoAdded ? "#166534" : "#9f1239" }}>
                    {photoAdded ? "Photo added" : "Tap to add photo"}
                  </span>
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: photoAdded ? "rgba(22,163,74,0.16)" : "rgba(212,24,61,0.10)" }}
                  >
                    <ScanLine size={16} style={{ color: photoAdded ? "#16a34a" : "#d4183d" }} />
                  </span>
                </button>
              </div>

              <button
                type="button"
                className="w-full min-h-[44px] rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 focus:outline-none active:scale-[0.98] transition-all"
                style={{ background: "#d4183d", boxShadow: "0 6px 16px rgba(212,24,61,0.30)" }}
              >
                Submit Non-Conformance
              </button>
            </div>
          )}
        </div>
        </>
        )}

        {activeTab === "non-compliance" && ncView === "list" && (
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => setNcView("create")}
              className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 focus:outline-none active:scale-[0.98]"
              style={{ background: GRADIENT, boxShadow: "0 4px 14px rgba(15,47,143,0.28)" }}
            >
              <Plus size={16} />
              New Notice of Discrepancy
            </button>

            <div
              className="rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-2"
              style={{
                background: "#ffffff",
                border: "2px dashed rgba(15,47,143,0.18)",
                boxShadow: "0 2px 12px rgba(15,47,143,0.04)",
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-1"
                style={{ background: "rgba(15,47,143,0.06)", color: "#94a3b8" }}
              >
                <ClipboardList size={22} />
              </div>
              <p className="text-[12px] font-medium" style={{ color: "#94a3b8" }}>
                No Notices of Discrepancy filed yet.
              </p>
            </div>
          </div>
        )}

        {activeTab === "non-compliance" && ncView === "create" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setNcView("list")}
                className="w-9 h-9 rounded-xl flex items-center justify-center focus:outline-none active:scale-[0.96]"
                style={{ background: "#ffffff", border: "1px solid rgba(15,47,143,0.12)", color: "#0a1a4a" }}
                aria-label="Back to Non-Compliance Log"
              >
                <ArrowLeft size={16} />
              </button>
              <h2 className="text-[15px] font-bold" style={{ color: "#0a1a4a" }}>Notice of Discrepancy</h2>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-bold" style={{ color: "#0a1a4a" }}>
                Non-Compliance Description <span style={{ color: "#d4183d" }}>*</span>
              </label>
              <textarea
                rows={4}
                value={ncDescription}
                onChange={e => setNcDescription(e.target.value)}
                placeholder="Describe the discrepancy observed..."
                className="w-full p-3 text-[12px] rounded-xl focus:outline-none resize-none"
                style={{
                  background: "#ffffff",
                  border: "1px solid rgba(15,47,143,0.16)",
                  color: "#0a1a4a",
                  boxShadow: "0 2px 8px rgba(15,47,143,0.04)",
                }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#5a6a99" }}>
                Type of Non-Compliance
              </label>
              <div
                className="rounded-2xl p-3 flex flex-col gap-2.5 max-h-60 overflow-y-auto"
                style={{ background: "#ffffff", border: "1px solid rgba(15,47,143,0.10)", boxShadow: "0 2px 12px rgba(15,47,143,0.04)" }}
              >
                {NON_COMPLIANCE_TYPES.map(type => {
                  const checked = selectedNcTypes.includes(type);
                  return (
                    <label
                      key={type}
                      className="flex items-start gap-2.5 cursor-pointer text-[12px]"
                      style={{ color: "#0a1a4a" }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleNcTypeToggle(type)}
                        className="mt-0.5 rounded accent-[#0f2f8f]"
                      />
                      <span>{type}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              className="rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5 focus:outline-none active:scale-[0.99] transition-all"
              style={{
                background: "#ffffff",
                border: "2px dashed rgba(15,47,143,0.22)",
              }}
            >
              <Camera size={22} style={{ color: "#94a3b8" }} />
              <span className="text-[12px] font-medium" style={{ color: "#5a6a99" }}>
                Attach Evidence Photo
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setNcView("list");
                setNcDescription("");
                setSelectedNcTypes([]);
              }}
              className="w-full h-12 rounded-xl text-[12px] font-bold uppercase tracking-wider text-white flex items-center justify-center focus:outline-none active:scale-[0.98]"
              style={{ background: "#E00025", boxShadow: "0 4px 14px rgba(224,0,37,0.28)" }}
            >
              Submit Notice of Discrepancy
            </button>
          </div>
        )}

        {activeTab === "attachments" && (
          <div className="flex flex-col gap-4">
            <button
              type="button"
              className="rounded-2xl p-6 flex flex-col items-center justify-center gap-2 focus:outline-none active:scale-[0.99] transition-all"
              style={{
                background: "#ffffff",
                border: "2px dashed rgba(15,47,143,0.22)",
                boxShadow: "0 2px 12px rgba(15,47,143,0.04)",
              }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: "#e8edf9", color: "#5a6a99" }}
              >
                <Upload size={18} />
              </div>
              <p className="text-[12px] font-bold" style={{ color: "#0a1a4a" }}>+ Add Photo or Document</p>
              <p className="text-[10px]" style={{ color: "#94a3b8" }}>JPG, PNG, or PDF up to 10MB</p>
            </button>

            {ATTACHMENT_FILES.map((file, i) => (
              <AttachmentFileCard key={file.fileName} file={file} index={i} />
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

// ─── Log Inventory Screen ─────────────────────────────────────────────────────

function LogInventoryScreen({ dark, onBack }: { dark: boolean; onBack: () => void; }) {
  const [tab, setTab] = useState<InventoryTab>("all");

  const bg = dark ? "#0f172a" : "#f0f4ff";
  const textPrimary = dark ? "#ffffff" : "#0a1a4a";
  const textMuted = dark ? "rgba(255,255,255,0.6)" : "#5a6a99";

  const items = tab === "all" ? INVENTORY_ITEMS : INVENTORY_ITEMS.filter(i => i.modified);

  return (
    <div className="min-h-screen w-full transition-colors duration-300 animate-fadeIn" style={{ background: bg, fontFamily: "'Inter', sans-serif" }}>
      <AppHeaderBar dark={dark}>
        <div className="flex items-center gap-3">
          <BackCardButton onClick={onBack} dark={dark} />
          <div className="min-w-0">
            <h1 className="text-[18px] font-bold tracking-tight" style={{ color: textPrimary }}>Log Inventory</h1>
            <p className="text-xs" style={{ color: textMuted }}>
              {INVENTORY_ITEMS.length} records · {INVENTORY_ITEMS.filter(i => i.modified).length} modified
            </p>
          </div>
        </div>
      </AppHeaderBar>

      <div className="w-full max-w-[480px] mx-auto min-h-screen flex flex-col px-5 py-5 gap-5">

        {/* Tabs */}
        <div className="flex gap-2 p-1 rounded-2xl" style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(232, 237, 249, 0.55)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}>
          {(["all", "modified"] as InventoryTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 focus:outline-none"
              style={{ background: tab === t ? GRADIENT : "transparent", color: tab === t ? "#ffffff" : textMuted, boxShadow: tab === t ? "0 2px 8px rgba(15,47,143,0.3)" : "none" }}>
              {t === "all" ? "All" : "Modified"}
              <span className="ml-1.5 text-[10px] font-bold opacity-75">
                ({t === "all" ? INVENTORY_ITEMS.length : INVENTORY_ITEMS.filter(i => i.modified).length})
              </span>
            </button>
          ))}
        </div>

        {/* Flat list — no date grouping */}
        <div className="flex flex-col gap-2 pb-6">
          {items.map(item => <InventoryRow key={item.id} item={item} dark={dark} />)}
          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Package size={36} style={{ color: textMuted, opacity: 0.4 }} />
              <p className="text-sm" style={{ color: textMuted }}>No modified records found.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const restored = useRef(loadSession()).current;
  const [screen, setScreen] = useState<Screen>(restored?.screen ?? "login");
  const [location, setLocation] = useState(restored?.location ?? "");
  const [dark, setDark] = useState(restored?.dark ?? false);
  const [userType, setUserType] = useState<UserType>(restored?.userType ?? "client");
  const [registerLogPrefill, setRegisterLogPrefill] = useState<RegisterLogFormData | null>(null);
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(restored?.selectedInspectionId ?? null);
  const [inspectionProgressById, setInspectionProgressById] = useState<Record<string, InspectionProgress>>({});

  const isCU = userType === "cu";

  const getInspectionProgress = (taskId: string): InspectionProgress =>
    inspectionProgressById[taskId] ?? EMPTY_INSPECTION_PROGRESS;

  const advanceInspectionProgress = (taskId: string, key: "preShipment" | "loading") => {
    setInspectionProgressById(prev => {
      const current = prev[taskId] ?? EMPTY_INSPECTION_PROGRESS;
      const currentStatus = current[key];
      const nextStatus: SubInspectionStatus =
        currentStatus === "not-started" ? "in-progress" :
        currentStatus === "in-progress" ? "completed" : "completed";
      return { ...prev, [taskId]: { ...current, [key]: nextStatus } };
    });
  };

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
  // (e.g. a stale/lost id), bounce back to the list instead of rendering blank.
  useEffect(() => {
    if (INSPECTION_TASK_SCREENS.includes(screen) && !SCHEDULED_INSPECTIONS.some(t => t.id === selectedInspectionId)) {
      setScreen("schedule-inspection");
    }
  }, [screen, selectedInspectionId]);

  if (screen === "login") return (
    <LoginScreen
      onSignIn={() => { setUserType("client"); setScreen("location"); }}
      onCUSignIn={() => setScreen("cu-signin")}
    />
  );
  if (screen === "cu-signin") return (
    <CUSignInScreen onNext={loc => { setUserType("cu"); setLocation(loc); setScreen("home"); }} />
  );
  if (screen === "location") return (
    <LocationScreen onNext={loc => { setUserType("client"); setLocation(loc); setScreen("home"); }} />
  );
  if (screen === "scan-log") return (
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
  );
  if (screen === "register-log-form") return (
    <RegisterLogFormScreen
      key={isCU ? "cu-view" : registerLogPrefill ? "existing" : "new"}
      prefill={isCU ? (registerLogPrefill ?? REGISTERED_LOG_ENTRY) : registerLogPrefill}
      isCU={isCU}
      onBack={() => setScreen("scan-log")}
    />
  );
  if (screen === "log-inventory") return <LogInventoryScreen dark={dark} onBack={() => setScreen("home")} />;

  const scheduleExporter = resolveExporterForConcession(location);
  const scheduleConcession = location || CU_CLIENT_DIRECTORY[0].concessions[0];
  const scheduleScreenProps = {
    onBack: () => setScreen("home" as Screen),
    onStartInspection: (task: InspectionTask) => { setSelectedInspectionId(task.id); setScreen("inspection-details"); },
    getProgress: getInspectionProgress,
    exporter: scheduleExporter,
    concession: scheduleConcession,
  };

  if (screen === "schedule-inspection") {
    return <ScheduleInspectionScreen {...scheduleScreenProps} />;
  }
  if (screen === "inspection-details") {
    const task = SCHEDULED_INSPECTIONS.find(t => t.id === selectedInspectionId);
    if (!task) {
      return <ScheduleInspectionScreen {...scheduleScreenProps} />;
    }
    return (
      <InspectionDetailsScreen
        task={task}
        progress={getInspectionProgress(task.id)}
        onBack={() => setScreen("schedule-inspection")}
        onViewFullInfo={() => setScreen("inspection-info-details")}
        onStartSession={key => {
          const current = getInspectionProgress(task.id)[key];
          if (current === "not-started") advanceInspectionProgress(task.id, key);
          setScreen("physical-verification");
        }}
      />
    );
  }
  if (screen === "physical-verification") {
    const task = SCHEDULED_INSPECTIONS.find(t => t.id === selectedInspectionId);
    if (!task) {
      return <ScheduleInspectionScreen {...scheduleScreenProps} />;
    }
    return (
      <PhysicalVerificationScreen
        task={task}
        onBack={() => setScreen("inspection-details")}
        onProceed={() => setScreen("inspection-details")}
      />
    );
  }
  if (screen === "inspection-info-details") {
    const task = SCHEDULED_INSPECTIONS.find(t => t.id === selectedInspectionId);
    if (!task) {
      return <ScheduleInspectionScreen {...scheduleScreenProps} />;
    }
    return (
      <InspectionInfoDetailsScreen
        task={task}
        dark={dark}
        onBack={() => setScreen("inspection-details")}
      />
    );
  }
  return (
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
      dark={dark}
      setDark={setDark}
    />
  );
}
