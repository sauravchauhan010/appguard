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
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const defaultSchedule = () => ({
  enabled: false,
  days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  slots: [{ from: "16:00", to: "18:00" }],
});

// ── Status Pill ──────────────────────────────────────────────────
function StatusPill({ status }) {
  const map = {
    loading:      { color: "#facc15", text: "⏳ Connecting…" },
    connected:    { color: "#4ade80", text: "🔥 Firebase Connected" },
    saving:       { color: "#60a5fa", text: "💾 Saving…" },
    saved:        { color: "#4ade80", text: "✓ Saved!" },
    error:        { color: "#f87171", text: "⚠ Firebase Error" },
    scanning:     { color: "#fb923c", text: "📱 Reading phone apps…" },
  };
  const s = map[status] || map.loading;
  return (
    <div style={{
      background: `${s.color}18`, border: `1px solid ${s.color}55`,
      borderRadius: 20, padding: "5px 14px",
      fontSize: 12, color: s.color, fontWeight: 600, transition: "all 0.3s",
    }}>{s.text}</div>
  );
}

// ── Tamper Alert Banner ───────────────────────────────────────────
function TamperBanner({ alert, onDismiss }) {
  if (!alert) return null;
  return (
    <div style={{
      background: "rgba(239,68,68,0.15)", borderBottom: "1px solid rgba(239,68,68,0.4)",
      padding: "12px 28px", display: "flex", alignItems: "center", gap: 12,
    }}>
      <span style={{ fontSize: 20 }}>🚨</span>
      <div style={{ flex: 1 }}>
        <span style={{ color: "#f87171", fontWeight: 700, fontSize: 13 }}>TAMPER ALERT: </span>
        <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>{alert.message}</span>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginLeft: 10 }}>
          {alert.timestamp ? new Date(alert.timestamp).toLocaleString() : ""}
        </span>
      </div>
      <button onClick={onDismiss} style={{
        background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)",
        color: "#f87171", borderRadius: 8, padding: "4px 12px", cursor: "pointer", fontSize: 12,
      }}>Dismiss</button>
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
  const [apps, setApps]               = useState([]);
  const [schedules, setSchedules]     = useState({});
  const [selected, setSelected]       = useState(null);
  const [fbStatus, setFbStatus]       = useState("loading");
  const [search, setSearch]           = useState("");
  const [tamperAlert, setTamperAlert] = useState(null);
  const [deviceInfo, setDeviceInfo]   = useState(null);
  const [lastSeen, setLastSeen]       = useState(null);

  // ── Load everything from Firebase ────────────────────────────
  useEffect(() => {
    // 1. Real-time rules listener
    const unsubRules = onSnapshot(
      doc(db, "guardianshield", "rules"),
      (snap) => {
        if (snap.exists()) setSchedules(snap.data() || {});
        setFbStatus("connected");
      },
      () => setFbStatus("error")
    );

    // 2. Real-time installed apps listener (from her phone)
    const unsubApps = onSnapshot(
      doc(db, "guardianshield", "installed_apps"),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.list && data.list.length > 0) {
            setApps(data.list);
            setDeviceInfo(data.deviceId || null);
            setLastSeen(data.updatedAt || null);
            setFbStatus("connected");
          }
        }
      }
    );

    // 3. Tamper alert listener
    const unsubTamper = onSnapshot(
      doc(db, "guardianshield", "tamper_alert"),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data && !data.resolved) setTamperAlert(data);
        }
      }
    );

    return () => { unsubRules(); unsubApps(); unsubTamper(); };
  }, []);

  // ── Dismiss tamper alert ──────────────────────────────────────
  const dismissTamper = async () => {
    await setDoc(doc(db, "guardianshield", "tamper_alert"), { resolved: true }, { merge: true });
    setTamperAlert(null);
  };

  // ── Save schedules ────────────────────────────────────────────
  const saveToFirebase = async (newSchedules) => {
    setFbStatus("saving");
    try {
      await setDoc(doc(db, "guardianshield", "rules"), newSchedules);
      setFbStatus("saved");
      setTimeout(() => setFbStatus("connected"), 2000);
    } catch (e) {
      setFbStatus("error");
    }
  };

  const getSchedule = (id) => schedules[id] || defaultSchedule();

  const updateSchedule = (id, updates) => {
    const n = { ...schedules, [id]: { ...getSchedule(id), ...updates } };
    setSchedules(n);
    saveToFirebase(n);
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

  const addSlot    = (id) => updateSchedule(id, { slots: [...getSchedule(id).slots, { from: "09:00", to: "11:00" }] });
  const removeSlot = (id, idx) => updateSchedule(id, { slots: getSchedule(id).slots.filter((_, i) => i !== idx) });

  const activeCount  = Object.values(schedules).filter((s) => s.enabled).length;
  const filteredApps = apps.filter(a => a.name?.toLowerCase().includes(search.toLowerCase()));

  // ── Render ────────────────────────────────────────────────────
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
        padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 10,
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>🛡️ AppGuard Control Panel</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
            {deviceInfo
              ? `📱 Connected: ${deviceInfo} • ${apps.length} apps loaded`
              : "Waiting for phone to connect…"}
            {lastSeen && (
              <span style={{ marginLeft: 8, color: "rgba(255,255,255,0.3)" }}>
                • Last seen: {new Date(lastSeen).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
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

      {/* Tamper Alert */}
      <TamperBanner alert={tamperAlert} onDismiss={dismissTamper} />

      <div style={{ display: "flex", height: "calc(100vh - 69px)" }}>
        {/* Sidebar */}
        <div style={{
          width: 270, borderRight: "1px solid rgba(255,255,255,0.08)",
          padding: "14px 10px", overflowY: "auto", flexShrink: 0,
          display: "flex", flexDirection: "column", gap: 0,
        }}>
          {/* Search */}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Search apps…"
            style={{
              width: "100%", background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10,
              padding: "9px 12px", color: "#fff", fontSize: 13, outline: "none",
              boxSizing: "border-box", marginBottom: 12,
            }}
          />

          {/* App count */}
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: 1.5, marginBottom: 8, paddingLeft: 4 }}>
            {apps.length === 0
              ? "WAITING FOR PHONE…"
              : `${filteredApps.length} OF ${apps.length} APPS`}
          </div>

          {/* Empty state */}
          {apps.length === 0 && (
            <div style={{
              textAlign: "center", padding: "40px 16px",
              color: "rgba(255,255,255,0.3)", fontSize: 13,
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📱</div>
              Install the APK on her phone first.<br/><br/>
              Her apps will appear here automatically!
            </div>
          )}

          {/* App list */}
          {filteredApps.map((app) => {
            const sch = getSchedule(app.id);
            return (
              <div key={app.id} onClick={() => setSelected(app.id)} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 10px", borderRadius: 11, cursor: "pointer", marginBottom: 2,
                background: selected === app.id ? "rgba(124,58,237,0.25)" : "transparent",
                border: `1px solid ${selected === app.id ? "rgba(124,58,237,0.5)" : "transparent"}`,
                transition: "all 0.15s",
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                  background: `${app.color || "#7C3AED"}22`,
                  border: `1px solid ${app.color || "#7C3AED"}44`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                }}>
                  {app.icon || "📱"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {app.name}
                  </div>
                  <div style={{ fontSize: 10, color: sch.enabled ? "#4ade80" : "rgba(255,255,255,0.3)", marginTop: 1 }}>
                    {sch.enabled ? `✓ ${sch.slots.length} slot${sch.slots.length > 1 ? "s" : ""} active` : "No restriction"}
                  </div>
                </div>
                {/* Toggle */}
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
        </div>

        {/* Schedule Editor */}
        <div style={{ flex: 1, padding: 28, overflowY: "auto" }}>
          {!selected ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", height: "100%", opacity: 0.35,
            }}>
              <div style={{ fontSize: 56 }}>{apps.length === 0 ? "📱" : "📅"}</div>
              <div style={{ fontSize: 17, marginTop: 14 }}>
                {apps.length === 0
                  ? "Install APK on her phone first"
                  : "Select an app to set its schedule"}
              </div>
              <div style={{ fontSize: 13, marginTop: 6, color: "rgba(255,255,255,0.5)" }}>
                {apps.length === 0
                  ? "Her installed apps will appear in the sidebar automatically"
                  : `${apps.length} apps loaded from her phone`}
              </div>
            </div>
          ) : (() => {
            const app = apps.find((a) => a.id === selected);
            if (!app) return null;
            const sch = getSchedule(selected);
            const color = app.color || "#7C3AED";
            return (
              <div>
                {/* App header */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
                  <div style={{
                    width: 50, height: 50, borderRadius: 14,
                    background: `${color}22`, border: `2px solid ${color}66`,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
                  }}>
                    {app.icon || "📱"}
                  </div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{app.name}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2, fontFamily: "monospace" }}>
                      {app.packageName}
                    </div>
                    <div style={{ fontSize: 12, color: sch.enabled ? "#4ade80" : "rgba(255,255,255,0.4)", marginTop: 3 }}>
                      {sch.enabled ? "✓ Restriction active" : "⚪ No restriction"}
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
                          background: active ? `${color}33` : "rgba(255,255,255,0.06)",
                          border: `1px solid ${active ? color + "88" : "rgba(255,255,255,0.1)"}`,
                          color: active ? "#fff" : "rgba(255,255,255,0.35)",
                          fontWeight: active ? 600 : 400, fontSize: 14, transition: "all 0.15s",
                        }}>{day}</div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 10 }}>
                    Tap a day to toggle. App accessible only on highlighted days.
                  </div>
                </Section>

                {/* Time Slots */}
                <Section title="ALLOWED TIME SLOTS" extra={
                  <button onClick={() => addSlot(selected)} style={{
                    background: "rgba(124,58,237,0.25)", border: "1px solid rgba(124,58,237,0.4)",
                    color: "#a78bfa", borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer",
                  }}>+ Add Slot</button>
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
                      }}>{slot.from} – {slot.to}</div>
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
                    💡 Outside these slots, <strong style={{ color: "#f87171" }}>app is blocked</strong> on her phone automatically.
                  </div>
                </Section>

                {/* Sync note */}
                <div style={{
                  padding: "12px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.07)",
                  fontSize: 12, color: "rgba(255,255,255,0.35)",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <span style={{ fontSize: 16 }}>🔥</span>
                  Changes save to Firebase instantly and sync to her phone within 30 seconds.
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
