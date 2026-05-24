/* Main app: AuthGate + sidebar + routing + tweaks + layout customization */

const { useState: useStateApp, useEffect: useEffectApp, useRef: useRefApp, useMemo: useMemoApp } = React;

const ALL_NAV = [
  { id: "dashboard", label: "หน้าหลัก",       icon: Icons.Dash,    group: "main" },
  { id: "inbound",   label: "รับเข้าสินค้า",   icon: Icons.In,      group: "ops"   },
  { id: "outbound",  label: "จัดส่งสินค้า",    icon: Icons.Out,     group: "ops"   },
  { id: "inventory", label: "สินค้าคงคลัง",    icon: Icons.Box,     group: "stock" },
  { id: "locations", label: "ตำแหน่งจัดเก็บ",  icon: Icons.Map,     group: "stock" },
  { id: "import",    label: "นำเข้า SKU",      icon: Icons.Pkg,     group: "stock" },
  { id: "labels",    label: "พิมพ์ฉลาก",       icon: Icons.Tag,     group: "ship"  },
  { id: "tracking",  label: "ติดตามพัสดุ",       icon: Icons.Truck,   group: "ship" },
  { id: "analytics", label: "วิเคราะห์ยอดขาย",     icon: Icons.Dash,    group: "stock" },
  { id: "history",   label: "ประวัติการแก้ไข", icon: Icons.History, group: "system" },
  { id: "handheld",  label: "โหมดมือถือ",      icon: Icons.Phone,   group: "ship" },
  { id: "users",     label: "ผู้ใช้งานและสิทธิ์", icon: Icons.Help,  group: "system" },
  { id: "layout",    label: "ปรับแต่งเลย์เอาต์",  icon: Icons.Edit,  group: "system" },
  { id: "bundles",   label: "ชุดสินค้า",          icon: Icons.Bundle,  group: "stock" },
  { id: "settings",  label: "ตั้งค่าร้านค้า",    icon: Icons.Setting, group: "system" }
];

const DEFAULT_NAV_STATE = ALL_NAV.map(n => ({ id: n.id, visible: true }));

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "comfortable"
}/*EDITMODE-END*/;

const CRUMB_MAP = {
  dashboard: "หน้าหลัก",
  inbound: "รับเข้าสินค้า",
  outbound: "จัดส่งสินค้า",
  inventory: "สินค้าคงคลัง",
  locations: "ตำแหน่งจัดเก็บ",
  import: "นำเข้า SKU จำนวนมาก",
  labels: "พิมพ์ฉลาก",
  tracking: "ติดตามพัสดุ",
  analytics: "วิเคราะห์ยอดขาย",
  history: "ประวัติการแก้ไข",
  handheld: "โหมดมือถือ",
  users: "ผู้ใช้งานและสิทธิ์",
  layout: "ปรับแต่งเลย์เอาต์",
  bundles: "ชุดสินค้า (Bundles)",
  settings: "ตั้งค่าร้านค้า"
};

/* ======== LIVE BADGE COUNTS ========
   Each badge reflects real data so it updates the moment anything changes.
   - inbound  : products at or below their reorder point (need restocking)
   - outbound : orders still needing action (picking or packed)
   - labels   : total labels waiting in the print queue               */
function computeBadges() {
  // --- inbound: low-stock / out-of-stock products ---
  const inbound = PRODUCTS.filter(p => p.qty <= p.reorder).length;

  // --- outbound: orders not yet shipped (prefer Supabase cache) ---
  const outbound = loadOrders().filter(o => o.status === "picking" || o.status === "packed").length;

  // --- labels: items in print queue (prefer Supabase cache) ---
  let labelsArr = window._DB_LABELS || SAMPLE_LABELS;
  try {
    if (!window._DB_LABELS) {
      const raw = localStorage.getItem("ims_labels");
      if (raw !== null) { const a = JSON.parse(raw); if (Array.isArray(a)) labelsArr = a; }
    }
  } catch (e) {}
  const labels = labelsArr.length;

  return {
    inbound:  inbound  > 0 ? inbound  : null,
    outbound: outbound > 0 ? outbound : null,
    labels:   labels   > 0 ? labels   : null,
  };
}

function useBadges() {
  const [b, setB] = useStateApp(computeBadges);
  useEffectApp(() => {
    const refresh = () => setB(computeBadges());
    window.addEventListener("ims-products-change", refresh);
    window.addEventListener("ims-orders-change",   refresh);
    window.addEventListener("ims-labels-change",   refresh);
    return () => {
      window.removeEventListener("ims-products-change", refresh);
      window.removeEventListener("ims-orders-change",   refresh);
      window.removeEventListener("ims-labels-change",   refresh);
    };
  }, []);
  return b;
}

/* ======== GLOBAL SEARCH OVERLAY ======== */
function SearchOverlay({ q, setQ, onClose, goTo }) {
  const inputRef = useRefApp(null);
  useEffectApp(() => { inputRef.current?.focus(); }, []);

  const results = useMemoApp(() => {
    const lq = q.trim().toLowerCase();
    if (!lq) return { products: [], orders: [] };
    return {
      products: PRODUCTS.filter(p =>
        p.sku.toLowerCase().includes(lq) ||
        p.name.toLowerCase().includes(lq) ||
        p.supplier.toLowerCase().includes(lq)
      ).slice(0, 6),
      orders: loadOrders().filter(o =>
        o.id.toLowerCase().includes(lq) ||
        (o.customer || "").toLowerCase().includes(lq) ||
        (o.channel || "").toLowerCase().includes(lq)
      ).slice(0, 4)
    };
  }, [q]);

  const hasResults = results.products.length > 0 || results.orders.length > 0;

  return (
    <>
      <div style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,0.4)", backdropFilter:"blur(2px)" }} onClick={onClose}/>
      <div style={{ position:"fixed", top:72, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:640, zIndex:201, padding:"0 16px" }}>
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:16, boxShadow:"var(--shadow-lg)", overflow:"hidden" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 18px", borderBottom:"1px solid var(--border)" }}>
            <Icons.Search size={16} style={{ color:"var(--muted)", flexShrink:0 }}/>
            <input
              ref={inputRef}
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="ค้นหา SKU, ชื่อสินค้า, เลขออร์เดอร์, ลูกค้า..."
              style={{ flex:1, border:"none", outline:"none", background:"transparent", fontSize:15, color:"var(--fg)", fontFamily:"inherit" }}
            />
            <span className="kbd" style={{ cursor:"pointer" }} onClick={onClose}>Esc</span>
          </div>

          {!q.trim() ? (
            <div style={{ padding:"28px 18px", color:"var(--muted)", fontSize:13, textAlign:"center" }}>
              พิมพ์เพื่อค้นหา SKU, ชื่อสินค้า, เลขออร์เดอร์ หรือชื่อลูกค้า
            </div>
          ) : !hasResults ? (
            <div style={{ padding:"28px 18px", color:"var(--muted)", fontSize:13, textAlign:"center" }}>
              ไม่พบผลลัพธ์สำหรับ "<strong>{q}</strong>"
            </div>
          ) : (
            <div style={{ maxHeight:420, overflowY:"auto" }}>
              {results.products.length > 0 && (<>
                <div style={{ padding:"8px 18px 4px", fontSize:11, fontWeight:600, color:"var(--muted)", letterSpacing:"0.06em", textTransform:"uppercase" }}>สินค้า</div>
                {results.products.map(p => {
                  const st = stockStatus(p);
                  return (
                    <div key={p.sku} className="search-hit" onClick={() => { goTo("inventory"); onClose(); }}>
                      <Icons.Box size={14} style={{ color:"var(--muted)", flexShrink:0 }}/>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</div>
                        <div style={{ fontSize:11, color:"var(--muted)", fontFamily:"IBM Plex Mono, monospace" }}>{p.sku} · {p.supplier}</div>
                      </div>
                      <span className={"badge " + st.cls} style={{ fontSize:10, flexShrink:0 }}>{p.qty} ชิ้น</span>
                    </div>
                  );
                })}
              </>)}
              {results.orders.length > 0 && (<>
                <div style={{ padding:"8px 18px 4px", fontSize:11, fontWeight:600, color:"var(--muted)", letterSpacing:"0.06em", textTransform:"uppercase", marginTop:4 }}>ออร์เดอร์</div>
                {results.orders.map(o => {
                  const stCls = { picking:"badge-warning", packed:"badge-info", shipped:"badge-success", delivered:"badge-neutral" }[o.status] || "badge-neutral";
                  const stLab = { picking:"กำลังหยิบ", packed:"พร้อมส่ง", shipped:"ส่งแล้ว", delivered:"จัดส่งสำเร็จ" }[o.status] || o.status;
                  return (
                    <div key={o.id} className="search-hit" onClick={() => { goTo("outbound"); onClose(); }}>
                      <Icons.Truck size={14} style={{ color:"var(--muted)", flexShrink:0 }}/>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:500 }}>{o.customer}</div>
                        <div style={{ fontSize:11, color:"var(--muted)", fontFamily:"IBM Plex Mono, monospace" }}>{o.id} · {o.channel}</div>
                      </div>
                      <span className={"badge " + stCls} style={{ fontSize:10, flexShrink:0 }}>{stLab}</span>
                    </div>
                  );
                })}
              </>)}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ======== NOTIFICATION POPOVER ======== */
function NotifPopover({ onClose, goTo }) {
  const outOfStock = PRODUCTS.filter(p => p.qty === 0);
  const lowStock   = PRODUCTS.filter(p => p.qty > 0 && p.qty <= p.reorder);
  const pending    = loadOrders().filter(o => o.status === "picking" || o.status === "packed");
  const nothing    = outOfStock.length === 0 && lowStock.length === 0 && pending.length === 0;

  return (
    <div style={{ position:"absolute", top:"calc(100% + 8px)", right:0, width:320, background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, boxShadow:"var(--shadow-lg)", zIndex:60, overflow:"hidden" }}>
      <div style={{ padding:"12px 16px 8px", fontSize:13, fontWeight:600, borderBottom:"1px solid var(--border)" }}>การแจ้งเตือน</div>

      {nothing && (
        <div style={{ padding:"24px 16px", textAlign:"center", color:"var(--muted)", fontSize:13 }}>✅ ไม่มีการแจ้งเตือนใหม่</div>
      )}

      {outOfStock.length > 0 && (
        <div style={{ padding:"8px 16px 4px" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"var(--danger)", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" }}>
            หมดสต็อก ({outOfStock.length})
          </div>
          {outOfStock.slice(0, 4).map(p => (
            <div key={p.sku} className="notif-row" onClick={() => { goTo("inventory"); onClose(); }}>
              <span style={{ width:7, height:7, borderRadius:999, background:"var(--danger)", flexShrink:0 }}/>
              <span style={{ flex:1, fontSize:12, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</span>
              <span style={{ fontSize:11, color:"var(--muted)", fontFamily:"IBM Plex Mono, monospace", flexShrink:0 }}>{p.sku}</span>
            </div>
          ))}
        </div>
      )}

      {lowStock.length > 0 && (
        <div style={{ padding:"8px 16px 4px" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"var(--warning)", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" }}>
            ใกล้หมด ({lowStock.length})
          </div>
          {lowStock.slice(0, 5).map(p => (
            <div key={p.sku} className="notif-row" onClick={() => { goTo("inventory"); onClose(); }}>
              <span style={{ width:7, height:7, borderRadius:999, background:"var(--warning)", flexShrink:0 }}/>
              <span style={{ flex:1, fontSize:12, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</span>
              <span style={{ fontSize:11, fontWeight:600, color:"var(--warning)", fontFamily:"IBM Plex Mono, monospace", flexShrink:0 }} className="tnum">{p.qty}</span>
            </div>
          ))}
        </div>
      )}

      {pending.length > 0 && (
        <div style={{ padding:"8px 16px 4px" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"var(--info)", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" }}>
            ออร์เดอร์ค้างส่ง ({pending.length})
          </div>
          {pending.slice(0, 4).map(o => (
            <div key={o.id} className="notif-row" onClick={() => { goTo("outbound"); onClose(); }}>
              <span style={{ width:7, height:7, borderRadius:999, background:"var(--info)", flexShrink:0 }}/>
              <span style={{ flex:1, fontSize:12 }}>{o.customer}</span>
              <span style={{ fontSize:11, color:"var(--muted)", fontFamily:"IBM Plex Mono, monospace", flexShrink:0 }}>{o.id}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding:"8px 16px 10px", borderTop:"1px solid var(--border)", display:"flex", justifyContent:"space-between", marginTop:4 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => { goTo("inventory"); onClose(); }}>ดูสินค้า →</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { goTo("outbound"); onClose(); }}>ดูออร์เดอร์ →</button>
      </div>
    </div>
  );
}

/* ======== ROOT WITH AUTH GATE ======== */

/* Detect mobile/tablet via viewport width OR coarse pointer (real touch device).
   Tablets in landscape can have >1024px viewports but are still touch — pointer:coarse
   catches those, while max-width handles narrow desktop windows that the desktop
   layout (designed for 1280px+) would not fit. */
function useIsMobile() {
  const [mobile, setMobile] = useStateApp(() => {
    if (typeof window === "undefined") return false;
    const mq = window.matchMedia("(max-width: 1024px), (pointer: coarse)");
    return mq.matches;
  });
  useEffectApp(() => {
    const mq = window.matchMedia("(max-width: 1024px), (pointer: coarse)");
    const handler = (e) => setMobile(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
  }, []);
  return mobile;
}

/* ── Loading screen shown while dbInit() fetches data from Supabase ── */
function DBLoadingScreen() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "100vh", gap: 16,
      background: "var(--bg, #f5f5f5)", color: "var(--fg, #111)"
    }}>
      <div style={{ fontSize: 40 }}>📦</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>คลังพร้อมส่ง</div>
      <div style={{ fontSize: 14, opacity: 0.6 }}>กำลังเชื่อมต่อฐานข้อมูล...</div>
    </div>
  );
}

function Root() {
  /* DB init — must complete before any screen mounts so components
     read from window._DB_* (Supabase) instead of localStorage */
  const [dbReady, setDbReady] = useStateApp(false);
  useEffectApp(() => {
    if (window.dbInit) {
      window.dbInit().then(() => setDbReady(true)).catch(() => setDbReady(true));
    } else {
      setDbReady(true); // no DB wired up, fall back to localStorage
    }
  }, []);

  const [view, setView] = useStateApp(() => window.location.hash.replace("#", "") || "app");
  useEffectApp(() => {
    const h = () => setView(window.location.hash.replace("#", "") || "app");
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);

  const [user, setUser] = useStateApp(() => {
    try { return JSON.parse(localStorage.getItem("ims_user") || "null"); } catch { return null; }
  });

  const isMobile = useIsMobile();

  if (!dbReady) return <DBLoadingScreen />;

  const login = (u) => {
    setUser(u);
    try { localStorage.setItem("ims_user", JSON.stringify(u)); } catch (e) {}
  };
  const logout = () => {
    setUser(null);
    try { localStorage.removeItem("ims_user"); } catch (e) {}
  };

  // Public customer-lookup route bypasses auth entirely
  if (view === "track" || view.startsWith("track/")) return <CustomerLookup/>;

  if (!user) return <LoginScreen onLogin={login} isMobile={isMobile}/>;

  // Mobile / tablet: render the mobile app fullscreen, no desktop chrome
  if (isMobile) return <MobileFullscreen user={user} onLogout={logout} onSwitchUser={login}/>;

  return <App user={user} onLogout={logout} onSwitchUser={login}/>;
}

/* ======== MOBILE FULLSCREEN WRAPPER ========
   The MobileApp component normally lives inside a 360×740 phone frame.
   When the user is actually on a phone/tablet we drop the frame and
   let it fill the viewport with safe-area insets. */
function MobileFullscreen({ user, onLogout, onSwitchUser }) {
  const [toast, setToast] = useStateApp(null);
  const pushToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  useEffectApp(() => { window.__currentUser = user; }, [user]);

  // Lock body so the mobile shell controls scrolling
  useEffectApp(() => {
    const prev = {
      overflow: document.body.style.overflow,
      bg: document.body.style.background
    };
    document.body.style.overflow = "hidden";
    document.body.style.background = "var(--bg)";
    document.documentElement.setAttribute("data-mobile", "1");
    return () => {
      document.body.style.overflow = prev.overflow;
      document.body.style.background = prev.bg;
      document.documentElement.removeAttribute("data-mobile");
    };
  }, []);

  return (
    <div
      className="mobile-fullscreen"
      data-screen-label="00 Mobile App"
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)"
      }}>
      <MobileApp pushToast={pushToast} user={user} onLogout={onLogout} onSwitchUser={onSwitchUser} fullscreen/>
      {toast && <div className="toast"><Icons.Check size={14}/> {toast}</div>}
    </div>
  );
}

/* ======== APP ======== */

function App({ user, onLogout, onSwitchUser }) {
  const [page, setPage] = useStateApp("dashboard");
  const [toast, setToast] = useStateApp(null);
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [sellOpen, setSellOpen] = useStateApp(false);
  const [searchOpen, setSearchOpen] = useStateApp(false);
  const [searchQ, setSearchQ] = useStateApp("");
  const [notifOpen, setNotifOpen] = useStateApp(false);
  const notifRef = useRefApp(null);

  // Expose current user for audit log
  useEffectApp(() => { window.__currentUser = user; }, [user]);

  const badges = useBadges();

  const [store, setStoreRaw] = useStateApp(() => {
    if (window._DB_STORE) return { ...DEFAULT_STORE, ...window._DB_STORE };
    try {
      const saved = localStorage.getItem("ims_store");
      if (saved) return { ...DEFAULT_STORE, ...JSON.parse(saved) };
    } catch (e) {}
    return DEFAULT_STORE;
  });
  const setStore = (updater) => {
    setStoreRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try { localStorage.setItem("ims_store", JSON.stringify(next)); } catch (e) {}
      if (window.dbSaveStoreSettings) dbSaveStoreSettings(next).catch(() => {});
      return next;
    });
  };

  useEffectApp(() => {
    const h = () => {
      if (!window._DB_STORE) return;
      const next = { ...DEFAULT_STORE, ...window._DB_STORE };
      try { localStorage.setItem("ims_store", JSON.stringify(next)); } catch (e) {}
      setStoreRaw(next);
    };
    window.addEventListener("ims-store-change", h);
    return () => window.removeEventListener("ims-store-change", h);
  }, []);

  /* Nav customization state */
  const [navItems, setNavItemsRaw] = useStateApp(() => {
    try {
      const saved = localStorage.getItem("ims_nav_layout");
      if (saved) {
        const parsed = JSON.parse(saved);
        const known = new Set(parsed.map(i => i.id));
        return [...parsed, ...DEFAULT_NAV_STATE.filter(i => !known.has(i.id))];
      }
    } catch (e) {}
    return DEFAULT_NAV_STATE;
  });
  const setNavItems = (updater) => {
    setNavItemsRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try { localStorage.setItem("ims_nav_layout", JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };

  useEffectApp(() => {
    document.documentElement.setAttribute("data-density", t.density);
  }, [t.density]);

  // ⌘K / Ctrl+K → open search; Escape → close overlays
  useEffectApp(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchQ("");
        setSearchOpen(true);
      }
      if (e.key === "Escape") { setSearchOpen(false); setNotifOpen(false); }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  // Close notif popover on outside click
  useEffectApp(() => {
    if (!notifOpen) return;
    const h = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [notifOpen]);

  const notifCount = PRODUCTS.filter(p => p.qty <= p.reorder).length +
    loadOrders().filter(o => o.status === "picking" || o.status === "packed").length;

  const pushToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const goTo = (p) => { setPage(p); window.scrollTo(0, 0); };

  /* Build the visible NAV: filter by role + visibility + order */
  const allowed = new Set(ROLE_NAV[user.role] || []);
  const visibleNav = navItems
    .filter(i => i.visible)
    .map(i => ALL_NAV.find(n => n.id === i.id))
    .filter(n => n && allowed.has(n.id));

  // group by group
  const navByGroup = {};
  visibleNav.forEach(n => { (navByGroup[n.group] ||= []).push(n); });

  // If current page is not allowed for this role, redirect to dashboard
  useEffectApp(() => {
    if (!allowed.has(page)) setPage("dashboard");
  }, [user.role]);

  // Capability check: only admins see users/layout
  const isAdmin = user.role === "admin";

  return (
    <div className="app" data-screen-label={"01 " + (CRUMB_MAP[page] || "หน้าหลัก")}>
      {/* Sidebar */}
      <aside className="sidebar no-print">
        <div className="brand" onClick={() => allowed.has("settings") && goTo("settings")} style={{ cursor: allowed.has("settings") ? "pointer" : "default" }} title={allowed.has("settings") ? "ตั้งค่าร้านค้า" : ""}>
          <StoreLogoMark store={store} size={32}/>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="brand-name" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{store.name}</div>
            <div className="brand-sub" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{store.tagline}</div>
          </div>
        </div>

        {["main", "ops", "stock", "ship", "system"].map(group => {
          const items = navByGroup[group];
          if (!items || items.length === 0) return null;
          return (
            <React.Fragment key={group}>
              <div className="nav-group">{NAV_GROUP_LABELS[group]}</div>
              {items.map(n => (
                <NavItem key={n.id} item={n} active={page === n.id} onClick={() => goTo(n.id)} badge={badges[n.id]}/>
              ))}
            </React.Fragment>
          );
        })}

        <UserDock user={user} onLogout={onLogout} onSwitchUser={onSwitchUser} goTo={goTo} canSeeUsers={isAdmin}/>
      </aside>

      {/* Main */}
      <main className="main">
        <header className="topbar no-print">
          <div className="crumb">
            <span>WMS</span> <span style={{ margin: "0 8px", color: "var(--faint)" }}>/</span> <strong>{CRUMB_MAP[page]}</strong>
          </div>
          <div className="topbar-right">
            <div className="search" onClick={() => { setSearchQ(""); setSearchOpen(true); }} style={{ cursor:"pointer", userSelect:"none" }}>
              <Icons.Search size={14}/>
              <span style={{ fontSize:13, color:"var(--muted)", flex:1 }}>ค้นหา SKU, ออร์เดอร์, ลูกค้า...</span>
              <span className="kbd">⌘K</span>
            </div>
            <button className="btn btn-primary" onClick={() => setSellOpen(true)} style={{ gap: 7 }}>
              <Icons.Cart size={14}/> ขายสินค้า
            </button>
            <button className="btn btn-ghost btn-icon" title="ช่วยเหลือ" onClick={() => alert("สำหรับคำถามเพิ่มเติม ติดต่อ admin@bangkokfulfill.co")}><Icons.Help size={16}/></button>
            <div ref={notifRef} style={{ position:"relative" }}>
              <button className="btn btn-ghost btn-icon" style={{ position:"relative" }} onClick={() => setNotifOpen(o => !o)}>
                <Icons.Bell size={16}/>
                {notifCount > 0 && <span style={{ position:"absolute", top:5, right:5, width:7, height:7, borderRadius:999, background:"var(--danger)" }}/>}
              </button>
              {notifOpen && <NotifPopover onClose={() => setNotifOpen(false)} goTo={goTo}/>}
            </div>
          </div>
        </header>

        <div className="content">
          {page === "dashboard" && <Dashboard density={t.density} goTo={goTo}/>}
          {page === "inbound"   && <Inbound goTo={goTo} pushToast={pushToast}/>}
          {page === "outbound"  && <Outbound goTo={goTo} pushToast={pushToast}/>}
          {page === "inventory" && <Inventory pushToast={pushToast} density={t.density} goTo={goTo}/>}
          {page === "locations" && <Locations/>}
          {page === "import"    && <ImportPage pushToast={pushToast} goTo={goTo}/>}
          {page === "labels"    && <Labels pushToast={pushToast} store={store}/>}
          {page === "tracking"  && <TrackingPage pushToast={pushToast} store={store}/>}
          {page === "analytics" && <AnalyticsPage pushToast={pushToast}/>}
          {page === "history"   && <HistoryPage pushToast={pushToast}/>}
          {page === "handheld"  && <Handheld pushToast={pushToast}/>}
          {page === "users"     && <UserManagement currentUser={user} pushToast={pushToast}/>}
          {page === "layout"    && <LayoutCustomize navItems={navItems} setNavItems={setNavItems} pushToast={pushToast} allNavItems={ALL_NAV}/>}
          {page === "bundles"   && <BundlePage pushToast={pushToast}/>}
          {page === "settings"  && <StoreSettings store={store} setStore={setStore} pushToast={pushToast}/>}
        </div>
      </main>

      {toast && <div className="toast"><Icons.Check size={14}/> {toast}</div>}

      {sellOpen && (
        <SellProductModal
          onClose={() => setSellOpen(false)}
          onSellComplete={({ orderId, customerName, itemCount }) => {
            pushToast(`สร้างออร์เดอร์ ${orderId} — ${itemCount} รายการ สำหรับ ${customerName}`);
            setSellOpen(false);
            goTo("outbound");
          }}
        />
      )}

      {searchOpen && <SearchOverlay q={searchQ} setQ={setSearchQ} onClose={() => setSearchOpen(false)} goTo={goTo}/>}

      <TweaksPanel title="ปรับแต่งหน้าจอ">
        <TweakSection label="การแสดงผล">
          <TweakRadio label="ความหนาแน่น" value={t.density} onChange={v => setTweak("density", v)} options={["comfortable", "compact"]}/>
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

function NavItem({ item, active, onClick, badge }) {
  const Icon = item.icon;
  return (
    <div className={"nav-item" + (active ? " active" : "")} onClick={onClick}>
      <Icon className="nav-icon" size={16}/>
      <span>{item.label}</span>
      {badge != null && <span className="nav-badge">{badge}</span>}
    </div>
  );
}

/* ======== USER DOCK (sidebar footer with logout / switch role) ======== */

function UserDock({ user, onLogout, onSwitchUser, goTo, canSeeUsers }) {
  const [open, setOpen] = useStateApp(false);
  const ref = useRefApp(null);
  const role = ROLES.find(r => r.id === user.role);

  useEffectApp(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--border)", position: "relative" }}>
      {open && (
        <div className="popover" style={{ left: 4, right: 4 }}>
          <div style={{ padding: "8px 10px 4px", fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>เข้าสู่ระบบในฐานะ</div>
          <div style={{ padding: "0 10px 8px" }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{user.name}</div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>{user.email}</div>
          </div>
          <div className="popover-divider"/>
          {canSeeUsers && (
            <>
              <button className="popover-item" onClick={() => { goTo("users"); setOpen(false); }}>
                <Icons.Help size={14}/> จัดการสมาชิก
              </button>
              <button className="popover-item" onClick={() => { goTo("layout"); setOpen(false); }}>
                <Icons.Edit size={14}/> ปรับแต่งเลย์เอาต์
              </button>
              <div className="popover-divider"/>
            </>
          )}
          <div style={{ padding: "6px 10px 4px", fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>สลับเป็น (เดโม)</div>
          {ROLES.map(r => {
            const u = USERS.find(x => x.role === r.id && x.active) || USERS.find(x => x.role === r.id);
            if (!u) return null;
            const isCurrent = u.id === user.id;
            return (
              <button key={r.id} className="popover-item" onClick={() => { if (!isCurrent) onSwitchUser(u); setOpen(false); }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: r.color }}/>
                <span style={{ flex: 1 }}>{r.label}</span>
                {isCurrent && <Icons.Check size={12} style={{ color: "var(--accent)" }}/>}
              </button>
            );
          })}
          <div className="popover-divider"/>
          <button className="popover-item danger" onClick={() => { onLogout(); setOpen(false); }}>
            <Icons.Door size={14}/> ออกจากระบบ
          </button>
        </div>
      )}

      <div onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px 4px", cursor: "pointer", borderRadius: 10 }}>
        <div className="avatar" style={{ background: role.color }}>{user.avatar}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</div>
          <div className="row" style={{ gap: 6, marginTop: 1 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: role.color, flexShrink: 0 }}/>
            <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{role.label}</span>
          </div>
        </div>
        <Icons.Setting size={14} style={{ color: "var(--muted)" }}/>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root/>);
