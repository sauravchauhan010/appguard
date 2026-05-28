import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot, getDoc } from "firebase/firestore";

// ── Firebase config ──────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDuQqO9esWa3hvHS0ycih-twJ12HaTQklE",
  authDomain: "guardianshield-e625e.firebaseapp.com",
  projectId: "guardianshield-e625e",
  storageBucket: "guardianshield-e625e.firebasestorage.app",
  messagingSenderId: "964078074876",
  appId: "1:964078074876:web:3eb9b8ec93ed71d26c5079",
  measurementId: "G-NCF5LX05J0",
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// ── Constants ────────────────────────────────────────────────────
const DEFAULT_APPS = [
  { id: "youtube",   name: "YouTube",     icon: "▶",  color: "#FF0000" },
  { id: "freefire",  name: "Free Fire",   icon: "🔥", color: "#FF6B00" },
  { id: "pubg",      name: "BGMI / PUBG", icon: "🎯", color: "#F5A623" },
  { id: "instagram", name: "Instagram",   icon: "📸", color: "#C13584" },
  { id: "snapchat",  name: "Snapchat",    icon: "👻", color: "#FFFC00" },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const defaultSchedule = () => ({
  enabled: false,
  days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  slots: [{ from: "16:00", to: "18:00" }],
});

// ── Status Pill ──────────────────────────────────────────────────
function StatusPill({ status }) {
  const map = {
    loading:   { color: "#facc15", text: "⏳ Connecting…" },
    connected: { color: "#4ade80", text: "🔥 Firebase Connected" },
    saving:    { color: "#60a5fa", text: "💾 Saving…" },
    saved:     { color: "#4ade80", text: "✓ Saved!" },
    error:     { color: "#f87171", text: "⚠ Firebase Error" },
  };
  const s = map[status] || map.loading;
  return (
    <div style={{
      background: `${s.color}18`, border: `1px solid ${s.color}55`,
      borderRadius: 20, padding: "5px 14px",
      fontSize: 12, color: s.color, fontWeight: 600, transition: "all 0.3s",
    }}>
      {s.text}
    </div>
  );
}

// ── Section wrapper ──────────────────────────────────────────────
function Section({ title, extra, children }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)", borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.08)", padding: 20, marginBottom: 18,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: 1.5 }}>
          {title}
        </div>
        {extra}
      </div>
      {children}
    </div>
  );
}

const timeInputStyle = {
  background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: 8, padding: "7px 10px", color: "#fff",
  fontSize: 15, fontWeight: 600, outline: "none",
};

// ── Main App ─────────────────────────────────────────────────────
export default function AppScheduler() {
  const [apps, setApps]           = useState(DEFAULT_APPS);
  const [schedules, setSchedules] = useState({});
  const [selected, setSelected]   = useState(null);
  const [fbStatus, setFbStatus]   = useState("loading");
  const [customApp, setCustomApp] = useState("");

  // Load from Firestore + real-time listener
  useEffect(() => {
    const rulesRef = doc(db, "guardianshield", "rules");
    const appsRef  = doc(db, "guardianshield", "apps");

    const unsubRules = onSnapshot(rulesRef, (snap) => {
      if (snap.exists()) setSchedules(snap.data());
      setFbStatus("connected");
    }, () => setFbStatus("error"));

    getDoc(appsRef).then((snap) => {
      if (snap.exists() && snap.data().list) setApps(snap.data().list);
    });

    return () => unsubRules();
  }, []);

  // Save schedules
  const saveToFirebase = async (newSchedules) => {
    setFbStatus("saving");
    try {
      await setDoc(doc(db, "guardianshield", "rules"), newSchedules);
      setFbStatus("saved");
      setTimeout(() => setFbStatus("connected"), 2000);
    } catch (e) {
      console.error(e);
      setFbStatus("error");
    }
  };

  // Save apps list
  const saveAppsToFirebase = async (newApps) => {
    try {
      await setDoc(doc(db, "guardianshield", "apps"), { list: newApps });
    } catch (e) {
      console.error(e);
    }
  };

  const getSchedule = (id) => schedules[id] || defaultSchedule();

  const updateSchedule = (id, updates) => {
    const newSchedules = { ...schedules, [id]: { ...getSchedule(id), ...updates } };
    setSchedules(newSchedules);
    saveToFirebase(newSchedules);
  };

  const toggleDay = (id, day) => {
    const days = getSchedule(id).days;
    updateSchedule(id, {
      days: days.includes(day) ? days.filter((d) => d !== day) : [...days, day],
    });
  };

  const updateSlot = (id, idx, field, val) => {
    const slots = [...getSchedule(id).slots];
    slots[idx] = { ...slots[idx], [field]: val };
    updateSchedule(id, { slots });
  };

  const addSlot = (id) => {
    updateSchedule(id, { slots: [...getSchedule(id).slots, { from: "09:00", to: "11:00" }] });
  };

  const removeSlot = (id, idx) => {
    updateSchedule(id, { slots: getSchedule(id).slots.filter((_, i) => i !== idx) });
  };

  const addCustomApp = () => {
    if (!customApp.trim()) return;
    const newApp = {
      id: customApp.toLowerCase().replace(/\s+/g, "_") + "_" + Date.now(),
      name: customApp, icon: "📱", color: "#7C3AED",
    };
    const newApps = [...apps, newApp];
    setApps(newApps);
    saveAppsToFirebase(newApps);
    setCustomApp("");
    setSelected(newApp.id);
  };

  const activeCount = Object.values(schedules).filter((s) => s.enabled).length;

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
      fontFamily: "'Segoe UI', sans-serif", color: "#fff",
    }}>
      {/* Header */}
      <div style={{
        background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        padding: "18px 28px", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>🛡️ AppGuard Control Panel</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
            Schedule app access • Changes sync to her phone instantly
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <StatusPill status={fbStatus} />
          <div style={{
            background: activeCount > 0 ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.08)",
            border: `1px solid ${activeCount > 0 ? "rgba(74,222,128,0.4)" : "rgba(255,255,255,0.15)"}`,
            borderRadius: 20, padding: "5px 14px",
            fontSize: 12, color: activeCount > 0 ? "#4ade80" : "rgba(255,255,255,0.5)",
          }}>
            {activeCount} active rule{activeCount !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", height: "calc(100vh - 69px)" }}>
        {/* Sidebar */}
        <div style={{
          width: 255, borderRight: "1px solid rgba(255,255,255,0.08)",
          padding: "18px 10px", overflowY: "auto", flexShrink: 0,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: 1.5, marginBottom: 10, paddingLeft: 8 }}>
            APPS TO MANAGE
          </div>

          {apps.map((app) => {
            const sch = getSchedule(app.id);
            return (
              <div key={app.id} onClick={() => setSelected(app.id)} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 10px", borderRadius: 12, cursor: "pointer", marginBottom: 3,
                background: selected === app.id ? "rgba(124,58,237,0.25)" : "transparent",
                border: `1px solid ${selected === app.id ? "rgba(124,58,237,0.5)" : "transparent"}`,
                transition: "all 0.15s",
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 9,
                  background: `${app.color}22`, border: `1px solid ${app.color}44`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, flexShrink: 0,
                }}>
                  {app.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {app.name}
                  </div>
                  <div style={{ fontSize: 10, color: sch.enabled ? "#4ade80" : "rgba(255,255,255,0.3)", marginTop: 1 }}>
                    {sch.enabled ? `✓ ${sch.slots.length} slot${sch.slots.length > 1 ? "s" : ""} active` : "No restriction"}
                  </div>
                </div>
                {/* Toggle switch */}
                <div
                  onClick={(e) => { e.stopPropagation(); updateSchedule(app.id, { enabled: !sch.enabled }); }}
                  style={{
                    width: 34, height: 19, borderRadius: 10, flexShrink: 0,
                    background: sch.enabled ? "#7C3AED" : "rgba(255,255,255,0.15)",
                    position: "relative", cursor: "pointer", transition: "background 0.2s",
                  }}
                >
                  <div style={{
                    position: "absolute", top: 2.5, left: sch.enabled ? 17 : 2.5,
                    width: 14, height: 14, borderRadius: "50%",
                    background: "#fff", transition: "left 0.2s",
                  }} />
                </div>
              </div>
            );
          })}

          {/* Add custom app */}
          <div style={{ padding: "10px 8px", marginTop: 10, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: 1.5, marginBottom: 8 }}>
              ADD CUSTOM APP
            </div>
            <input
              value={customApp}
              onChange={(e) => setCustomApp(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustomApp()}
              placeholder="e.g. Clash of Clans"
              style={{
                width: "100%", background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8,
                padding: "7px 10px", color: "#fff", fontSize: 12, outline: "none",
                boxSizing: "border-box",
              }}
            />
            <button onClick={addCustomApp} style={{
              width: "100%", marginTop: 6, background: "rgba(124,58,237,0.3)",
              border: "1px solid rgba(124,58,237,0.5)", borderRadius: 8,
              padding: "6px", color: "#a78bfa", fontSize: 12, cursor: "pointer",
            }}>
              + Add App
            </button>
          </div>
        </div>

        {/* Schedule Editor */}
        <div style={{ flex: 1, padding: 28, overflowY: "auto" }}>
          {!selected ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", height: "100%", opacity: 0.35,
            }}>
              <div style={{ fontSize: 56 }}>📅</div>
              <div style={{ fontSize: 17, marginTop: 14 }}>Select an app to configure its schedule</div>
              <div style={{ fontSize: 13, marginTop: 6, color: "rgba(255,255,255,0.5)" }}>
                Rules save to Firebase instantly
              </div>
            </div>
          ) : (() => {
            const app = apps.find((a) => a.id === selected);
            if (!app) return null;
            const sch = getSchedule(selected);
            return (
              <div>
                {/* App header */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
                  <div style={{
                    width: 50, height: 50, borderRadius: 14,
                    background: `${app.color}22`, border: `2px solid ${app.color}66`,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
                  }}>
                    {app.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{app.name}</div>
                    <div style={{ fontSize: 13, color: sch.enabled ? "#4ade80" : "rgba(255,255,255,0.4)", marginTop: 2 }}>
                      {sch.enabled ? "✓ Restriction active — synced to her phone" : "⚪ No restriction — app freely accessible"}
                    </div>
                  </div>
                  <button
                    onClick={() => updateSchedule(selected, { enabled: !sch.enabled })}
                    style={{
                      marginLeft: "auto",
                      background: sch.enabled ? "rgba(239,68,68,0.2)" : "rgba(74,222,128,0.2)",
                      border: `1px solid ${sch.enabled ? "rgba(239,68,68,0.4)" : "rgba(74,222,128,0.4)"}`,
                      color: sch.enabled ? "#f87171" : "#4ade80",
                      borderRadius: 10, padding: "9px 18px",
                      fontSize: 13, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    {sch.enabled ? "Disable Rule" : "Enable Rule"}
                  </button>
                </div>

                {/* Allowed Days */}
                <Section title="ALLOWED DAYS">
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {DAYS.map((day) => {
                      const active = sch.days.includes(day);
                      return (
                        <div key={day} onClick={() => toggleDay(selected, day)} style={{
                          padding: "8px 16px", borderRadius: 10, cursor: "pointer",
                          background: active ? `${app.color}33` : "rgba(255,255,255,0.06)",
                          border: `1px solid ${active ? app.color + "88" : "rgba(255,255,255,0.1)"}`,
                          color: active ? "#fff" : "rgba(255,255,255,0.35)",
                          fontWeight: active ? 600 : 400, fontSize: 14, transition: "all 0.15s",
                        }}>
                          {day}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 10 }}>
                    Tap a day to toggle. App is accessible only on highlighted days.
                  </div>
                </Section>

                {/* Time Slots */}
                <Section title="ALLOWED TIME SLOTS" extra={
                  <button onClick={() => addSlot(selected)} style={{
                    background: "rgba(124,58,237,0.25)", border: "1px solid rgba(124,58,237,0.4)",
                    color: "#a78bfa", borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer",
                  }}>
                    + Add Slot
                  </button>
                }>
                  {sch.slots.map((slot, idx) => (
                    <div key={idx} style={{
                      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                      background: "rgba(255,255,255,0.05)", borderRadius: 10,
                      padding: "12px 14px", marginBottom: 8,
                      border: "1px solid rgba(255,255,255,0.07)",
                    }}>
                      <span style={{ fontSize: 16 }}>🕐</span>
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>From</span>
                      <input type="time" value={slot.from}
                        onChange={(e) => updateSlot(selected, idx, "from", e.target.value)}
                        style={timeInputStyle} />
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>To</span>
                      <input type="time" value={slot.to}
                        onChange={(e) => updateSlot(selected, idx, "to", e.target.value)}
                        style={timeInputStyle} />
                      <div style={{
                        marginLeft: "auto", background: "rgba(74,222,128,0.1)",
                        border: "1px solid rgba(74,222,128,0.25)",
                        borderRadius: 8, padding: "4px 12px", fontSize: 12, color: "#4ade80",
                      }}>
                        {slot.from} – {slot.to}
                      </div>
                      {sch.slots.length > 1 && (
                        <button onClick={() => removeSlot(selected, idx)} style={{
                          background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
                          color: "#f87171", borderRadius: 8, padding: "4px 9px", cursor: "pointer", fontSize: 13,
                        }}>✕</button>
                      )}
                    </div>
                  ))}
                  <div style={{
                    marginTop: 14, padding: "11px 14px",
                    background: "rgba(124,58,237,0.1)", borderRadius: 10,
                    border: "1px solid rgba(124,58,237,0.2)",
                    fontSize: 12, color: "rgba(255,255,255,0.5)",
                  }}>
                    💡 Outside these slots, the app will be <strong style={{ color: "#f87171" }}>blocked</strong> on her phone automatically.
                  </div>
                </Section>

                {/* Firebase sync note */}
                <div style={{
                  marginTop: 20, padding: "14px 18px",
                  background: "rgba(255,255,255,0.03)", borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.07)",
                  fontSize: 12, color: "rgba(255,255,255,0.35)",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <span style={{ fontSize: 18 }}>🔥</span>
                  <span>
                    All changes save to <strong style={{ color: "rgba(255,255,255,0.6)" }}>Firebase Firestore</strong> in real-time.
                    The Android agent app on her phone reads these rules every 30 seconds.
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
