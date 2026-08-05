import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Eye, EyeOff, Mail, Lock, ChevronRight, MapPin, ChevronDown,
  Moon, Sun, LogOut, ClipboardList, Package, RefreshCw, ArrowLeft,
  ScanLine, QrCode, Calendar, Search, ListFilter, X, Truck, CheckCircle2, ArrowRight,
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
type Screen = "login" | "cu-signin" | "location" | "home" | "scan-log" | "register-log-form" | "log-inventory" | "schedule-inspection" | "inspection-details";
type InventoryTab = "all" | "modified";
type InspectionDay = "today" | "tomorrow" | "later";
type InspectionStatus = "pending" | "urgent";
type DayFilter = InspectionDay;
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
}

const AUTHENTICATED_SCREENS: Screen[] = [
  "location", "home", "scan-log", "register-log-form", "log-inventory", "schedule-inspection", "inspection-details",
];

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
    return {
      screen: data.screen as Screen,
      userType: data.userType,
      location: data.location,
      dark: data.dark,
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
    shipment: "#SHIP-2024-001",
    exporter: "GreenWood Timber Exports Ltd",
    location: "Port Terminal A",
    time: "14:00–16:00",
    logs: 48,
    day: "today",
    status: "urgent",
  },
  {
    id: "2",
    shipment: "#SHIP-2024-002",
    exporter: "Nordic Wood Exports",
    location: "Central Yard 4",
    time: "16:30–18:00",
    logs: 32,
    day: "today",
    status: "pending",
  },
  {
    id: "3",
    shipment: "#SHIP-2024-003",
    exporter: "Coastal Pine Ltd",
    location: "North Docking Bay",
    time: "09:00–11:00",
    logs: 56,
    day: "today",
    status: "pending",
  },
  {
    id: "4",
    shipment: "#SHIP-2024-004",
    exporter: "Amazonia Hardwoods",
    location: "West Logistics Hub",
    time: "11:00–13:00",
    logs: 21,
    day: "today",
    status: "pending",
  },
  {
    id: "5",
    shipment: "#SHIP-2024-005",
    exporter: "Summit Forest Products",
    location: "Mountain Depot",
    time: "13:00–15:00",
    logs: 40,
    day: "today",
    status: "pending",
  },
  {
    id: "6",
    shipment: "#SHIP-2024-006",
    exporter: "Eastern Pine Resale",
    location: "Eastern Rail Head",
    time: "15:00–17:00",
    logs: 18,
    day: "today",
    status: "urgent",
  },
  {
    id: "7",
    shipment: "#SHIP-2024-007",
    exporter: "Pacific Timber Co",
    location: "South Quay",
    time: "Tomorrow 08:30",
    logs: 27,
    day: "tomorrow",
    status: "pending",
  },
  {
    id: "8",
    shipment: "#SHIP-2024-008",
    exporter: "Highland Logs Ltd",
    location: "Inland Yard 2",
    time: "Tomorrow 14:00",
    logs: 35,
    day: "tomorrow",
    status: "urgent",
  },
  {
    id: "9",
    shipment: "#SHIP-2024-009",
    exporter: "River Bend Exports",
    location: "River Terminal",
    time: "Later",
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
  return (
    <div
      className="sticky top-0 z-40 w-full"
      style={{
        background: dark ? "#1e293b" : "#ffffff",
        borderBottom: dark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(15,47,143,0.14)",
        boxShadow: dark ? "none" : "0 1px 4px rgba(15,47,143,0.06)",
      }}
    >
      <div className="w-full max-w-[480px] mx-auto px-5 py-4">
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
    <div className="flex items-center justify-between">
      <img
        src={sustainscanLogo}
        alt="SustainScan"
        className="h-11 object-contain object-left"
        style={{ filter: dark ? "brightness(0) invert(1)" : "none" }}
      />
      <div className="flex items-center gap-2">
        {onBack && (
          <button onClick={onBack}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 focus:outline-none"
            style={btn} aria-label="Go back">
            <ArrowLeft size={17} />
          </button>
        )}
        {onDarkToggle && (
          <button onClick={onDarkToggle}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 focus:outline-none"
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
      <div className="relative z-10 w-full max-w-[420px] mx-4 flex flex-col min-h-screen py-10 items-center justify-between gap-6">
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
      <div className="relative z-10 w-full max-w-[420px] mx-4 flex flex-col min-h-screen py-10 items-center justify-between gap-6">
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
      <div className="relative z-10 w-full max-w-[420px] mx-4 flex flex-col min-h-screen py-10 items-center justify-between gap-6">
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
            <h1 className="text-xl font-bold tracking-tight" style={{ color: dark ? "#ffffff" : "#0a1a4a" }}>
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
            <h1 className="text-xl font-bold tracking-tight" style={{ color: "#0a1a4a" }}>
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

// ─── Schedule Inspection Screen ───────────────────────────────────────────────

function ScheduleInspectionScreen({
  onBack,
  onStartInspection,
  getProgress,
}: {
  onBack: () => void;
  onStartInspection: (task: InspectionTask) => void;
  getProgress: (taskId: string) => InspectionProgress;
}) {
  const [dayFilter, setDayFilter] = useState<DayFilter>("today");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [draftDay, setDraftDay] = useState<DayFilter>("today");
  const [draftStatus, setDraftStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
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

  const filtered = SCHEDULED_INSPECTIONS.filter(task => {
    if (task.day !== dayFilter) return false;
    if (statusFilter !== "all" && task.status !== statusFilter) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      return (
        task.shipment.toLowerCase().includes(q) ||
        task.exporter.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const dayChips: { id: DayFilter; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "tomorrow", label: "Tomorrow" },
    { id: "later", label: "Later" },
  ];

  const statusChips: { id: StatusFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "pending", label: "Pending" },
    { id: "urgent", label: "Urgent" },
  ];

  const selectStyle = {
    background: "#ffffff",
    border: "1px solid rgba(15,47,143,0.14)",
    color: "#0a1a4a",
  } as const;

  return (
    <div
      className="min-h-screen w-full animate-fadeIn"
      style={{ background: "#f0f4ff", fontFamily: "'Inter', sans-serif", color: "#0a1a4a" }}
    >
      <AppHeaderBar>
        <div className="flex items-center gap-3">
          <BackCardButton onClick={onBack} />
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight" style={{ color: "#0a1a4a" }}>
              Schedule Inspection
            </h1>
            <p className="text-xs" style={{ color: "#5a6a99" }}>
              Your assigned log grading tasks
            </p>
          </div>
        </div>
      </AppHeaderBar>

      <div className="w-full max-w-[480px] mx-auto flex flex-col px-5 py-5 gap-5">
        {/* Search + filter */}
        <div className="flex items-center gap-2">
          <div
            className="flex-1 min-w-0 flex items-center gap-3 h-12 px-3.5 rounded-xl"
            style={{ background: "#ffffff", border: "1px solid rgba(15,47,143,0.14)" }}
          >
            <Search size={18} style={{ color: "#5a6a99", flexShrink: 0 }} />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search shipment ID or exporter"
              className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-[#5a6a99]/70"
              style={{ color: "#0a1a4a" }}
            />
          </div>
          <button
            type="button"
            onClick={openFilters}
            className="relative w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 focus:outline-none active:scale-95 transition-transform"
            style={{
              background: filtersActive ? "#93c5fd" : "rgba(15,47,143,0.08)",
              color: "#0f2f8f",
              border: `1px solid ${filtersActive ? "#93c5fd" : "rgba(15,47,143,0.14)"}`,
            }}
            aria-label="Open filters"
            aria-expanded={filterOpen}
          >
            <ListFilter size={20} />
            {filtersActive && (
              <span
                className="absolute top-2 right-2 w-2 h-2 rounded-full"
                style={{ background: "#d4183d" }}
              />
            )}
          </button>
        </div>

        {/* Task list */}
        <div className="flex flex-col gap-3 pb-2">
          {filtered.length === 0 ? (
            <div
              className="rounded-xl p-5 text-center"
              style={{ background: "#ffffff", border: "1px solid rgba(15,47,143,0.14)" }}
            >
              <p className="text-sm font-medium" style={{ color: "#0a1a4a" }}>
                No inspections {dayFilter === "today" ? "today" : dayFilter === "tomorrow" ? "tomorrow" : "later"}
              </p>
              <p className="text-xs mt-1" style={{ color: "#5a6a99" }}>
                Try another filter or clear your search.
              </p>
            </div>
          ) : (
            filtered.map(task => (
              <article
                key={task.id}
                className="rounded-xl p-4 flex flex-col gap-3"
                style={{
                  background: "#ffffff",
                  border: "1px solid rgba(15,47,143,0.14)",
                  boxShadow: "0 1px 3px rgba(15,47,143,0.06)",
                }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-semibold"
                    style={
                      task.status === "urgent"
                        ? { background: "rgba(212,24,61,0.10)", color: "#d4183d" }
                        : { background: "rgba(15,47,143,0.08)", color: "#5a6a99" }
                    }
                  >
                    {task.status === "urgent" ? "Urgent" : "Pending"}
                  </span>
                  <span
                    className="inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-semibold"
                    style={{ background: "rgba(15,47,143,0.08)", color: "#0f2f8f" }}
                  >
                    {task.shipment}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <h3 className="text-[15px] font-bold leading-snug" style={{ color: "#0a1a4a" }}>
                    {task.exporter}
                  </h3>
                  <p className="text-xs leading-relaxed" style={{ color: "#5a6a99" }}>
                    {task.location} · {task.time} · {task.logs} logs
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onStartInspection(task)}
                  className="w-full h-12 rounded-xl text-sm font-semibold text-white focus:outline-none active:scale-[0.98] transition-transform hover:brightness-110"
                  style={{ background: GRADIENT, boxShadow: "0 4px 14px rgba(15,47,143,0.28)" }}
                >
                  {(() => {
                    const p = getProgress(task.id);
                    const allDone = p.preShipment === "completed" && p.loading === "completed";
                    const anyStarted = p.preShipment !== "not-started" || p.loading !== "not-started";
                    return allDone ? "View Inspection" : anyStarted ? "Continue Inspection" : "Start Inspection";
                  })()}
                </button>
              </article>
            ))
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
            className="relative z-10 w-full rounded-t-3xl px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col gap-5"
            style={{
              background: "#ffffff",
              boxShadow: "0 -8px 32px rgba(15,47,143,0.18)",
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
                    className="w-8 h-8 rounded-lg flex items-center justify-center focus:outline-none"
                    style={{ background: "rgba(15,47,143,0.08)", color: "#0f2f8f" }}
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="filter-schedule" className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#5a6a99" }}>
                Schedule
              </label>
              <div className="relative">
                <select
                  id="filter-schedule"
                  value={draftDay}
                  onChange={e => setDraftDay(e.target.value as DayFilter)}
                  className="w-full h-12 appearance-none rounded-xl pl-3.5 pr-10 text-sm font-medium outline-none focus:outline-none"
                  style={selectStyle}
                >
                  {dayChips.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2"
                  style={{ color: "#5a6a99" }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="filter-status" className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#5a6a99" }}>
                Status
              </label>
              <div className="relative">
                <select
                  id="filter-status"
                  value={draftStatus}
                  onChange={e => setDraftStatus(e.target.value as StatusFilter)}
                  className="w-full h-12 appearance-none rounded-xl pl-3.5 pr-10 text-sm font-medium outline-none focus:outline-none"
                  style={selectStyle}
                >
                  {statusChips.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2"
                  style={{ color: "#5a6a99" }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={applyFilters}
              className="w-full h-12 rounded-xl text-sm font-semibold text-white focus:outline-none active:scale-[0.98] transition-transform"
              style={{ background: GRADIENT, boxShadow: "0 4px 14px rgba(15,47,143,0.28)" }}
            >
              Apply filters
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

function InspectionDetailsScreen({ task, progress, onAdvance, onBack }: {
  task: InspectionTask;
  progress: InspectionProgress;
  onAdvance: (key: "preShipment" | "loading") => void;
  onBack: () => void;
}) {
  const [infoExpanded, setInfoExpanded] = useState(false);
  const scheduleLabel = task.day === "today" ? `Today · ${task.time}` : task.day === "tomorrow" ? `Tomorrow · ${task.time}` : task.time;

  return (
    <div className="min-h-screen w-full animate-fadeIn" style={{ background: "#f0f4ff", fontFamily: "'Inter', sans-serif" }}>
      <AppHeaderBar>
        <div className="flex items-center gap-3">
          <BackCardButton onClick={onBack} />
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight truncate" style={{ color: "#0a1a4a" }}>{task.shipment}</h1>
            <p className="text-xs truncate" style={{ color: "#5a6a99" }}>{task.exporter}</p>
          </div>
        </div>
      </AppHeaderBar>

      <div className="w-full max-w-[480px] mx-auto flex flex-col px-5 py-5 gap-6">

        {/* Inspection Info — read only, expandable */}
        <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: "#ffffff", border: "1px solid rgba(15,47,143,0.14)", boxShadow: "0 1px 4px rgba(15,47,143,0.06)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#f0f4ff", border: "1px solid rgba(15,47,143,0.18)" }}>
              <ClipboardList size={18} style={{ color: "#0f2f8f" }} />
            </div>
            <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex-shrink-0" style={{ background: "#ffffff", border: "1px solid rgba(15,47,143,0.28)", color: "#0f2f8f" }}>
              <Lock size={10} /> Read Only
            </span>
          </div>

          <div>
            <h2 className="text-base font-bold" style={{ color: "#0a1a4a" }}>Inspection Info</h2>
            <p className="text-xs leading-relaxed mt-1.5" style={{ color: "#5a6a99" }}>
              Read-only shipment data: reference number, client &amp; location details, and schedule vs status overview.
            </p>
          </div>

          {infoExpanded && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 pt-3" style={{ borderTop: "1px solid rgba(15,47,143,0.10)" }}>
              {[
                ["Reference No.", task.shipment],
                ["Client", task.exporter],
                ["Location", task.location],
                ["Schedule", scheduleLabel],
                ["Status", task.status === "urgent" ? "Urgent" : "Pending"],
                ["Logs", `${task.logs} logs`],
                ["Inspector", "Assigned on arrival"],
                ["Notes", "No additional remarks"],
              ].map(([label, val]) => (
                <div key={label}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#94a3b8" }}>{label}</p>
                  <p className="text-sm font-semibold mt-0.5 truncate" style={{ color: "#0a1a4a" }}>{val}</p>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setInfoExpanded(v => !v)}
            className="self-end w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 focus:outline-none transition-colors hover:brightness-105"
            style={{ background: "rgba(15,47,143,0.08)", color: "#0f2f8f" }}
            aria-label={infoExpanded ? "Show less" : "Show more"}
          >
            <ArrowRight size={16} style={{ transform: infoExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
          </button>
        </div>

        {/* Inspection process — connected timeline */}
        <div className="relative pb-1">
          <div className="absolute left-6 top-6 bottom-6 w-0.5 rounded-full" style={{ background: "linear-gradient(180deg, rgba(15,47,143,0.35), rgba(15,47,143,0.08))" }} aria-hidden="true" />

          <div className="flex flex-col gap-8">
            {INSPECTION_STEPS.map((step, idx) => {
              const status = progress[step.key];
              const isDone = status === "completed";
              const isActive = status === "in-progress";
              return (
                <div key={step.key} className="relative flex gap-4">
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

                  <div className="flex-1 min-w-0 flex flex-col gap-2 pt-1.5">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <h3 className="text-[15px] font-bold" style={{ color: "#0a1a4a" }}>
                        {idx + 1}. {step.title}
                      </h3>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "#5a6a99" }}>{step.description}</p>
                    <div><SubInspectionStatusPill status={status} /></div>

                    <button
                      type="button"
                      onClick={() => onAdvance(step.key)}
                      disabled={isDone}
                      className="w-full h-12 mt-1 rounded-xl text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 focus:outline-none active:scale-[0.98] transition-all duration-200 hover:brightness-110 disabled:active:scale-100 disabled:hover:brightness-100"
                      style={{
                        background: isDone ? "#eef1f6" : GRADIENT,
                        color: isDone ? "#94a3b8" : "#ffffff",
                        boxShadow: isDone ? "none" : "0 4px 16px rgba(15,47,143,0.30)",
                      }}
                    >
                      {isDone ? <><CheckCircle2 size={16} /> Completed</> : isActive
                        ? <>Continue {step.shortLabel} <ChevronRight size={16} /></>
                        : <>Start {step.shortLabel} <ChevronRight size={16} /></>}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
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
            <h1 className="text-xl font-bold tracking-tight" style={{ color: textPrimary }}>Log Inventory</h1>
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
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);
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
    saveSession({ screen, userType, location, dark });
  }, [screen, userType, location, dark]);

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
  if (screen === "schedule-inspection") {
    return (
      <ScheduleInspectionScreen
        onBack={() => setScreen("home")}
        onStartInspection={task => { setSelectedInspectionId(task.id); setScreen("inspection-details"); }}
        getProgress={getInspectionProgress}
      />
    );
  }
  if (screen === "inspection-details") {
    const task = SCHEDULED_INSPECTIONS.find(t => t.id === selectedInspectionId);
    if (!task) return null;
    return (
      <InspectionDetailsScreen
        task={task}
        progress={getInspectionProgress(task.id)}
        onAdvance={key => advanceInspectionProgress(task.id, key)}
        onBack={() => setScreen("schedule-inspection")}
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
