/* Tracking & courier admin page + customer self-service lookup view */

const { useState: useStateTrk, useEffect: useEffectTrk, useRef: useRefTrk, useMemo: useMemoTrk } = React;

const ORDERS_KEY = "ims_orders_overrides";

function loadOrderOverrides() {
  try { return JSON.parse(localStorage.getItem(ORDERS_KEY) || "{}"); }
  catch { return {}; }
}

function setOrderField(id, changes) {
  const m = loadOrderOverrides();
  m[id] = { ...m[id], ...changes };
  try { localStorage.setItem(ORDERS_KEY, JSON.stringify(m)); } catch (e) {}
  window.dispatchEvent(new CustomEvent("ims-orders-change"));
}

function useOrders() {
  const [overrides, setO] = useStateTrk(() => loadOrderOverrides());
  useEffectTrk(() => {
    const h = () => setO(loadOrderOverrides());
    window.addEventListener("ims-orders-change", h);
    return () => window.removeEventListener("ims-orders-change", h);
  }, []);
  return OUTBOUND
    .map(o => ({ ...o, ...(overrides[o.id] || {}) }))
    .filter(o => !o.deleted);
}

/* Status pipeline order */
const TRACK_STAGES = [
  { id: "picking",   label: "กำลังจัดเตรียม", icon: Icons.Box },
  { id: "packed",    label: "พร้อมส่ง",       icon: Icons.Pkg },
  { id: "shipped",   label: "ส่งให้ขนส่ง",     icon: Icons.Truck },
  { id: "delivered", label: "ถึงปลายทาง",     icon: Icons.Door }
];

const stageIndex = (status) => TRACK_STAGES.findIndex(s => s.id === status);

/* ============ ADMIN: Tracking page ============ */

function TrackingPage({ pushToast, store }) {
  const orders = useOrders();
  const [q, setQ] = useStateTrk("");
  const [statusFilter, setStatusFilter] = useStateTrk("all");
  const [shareOpen, setShareOpen] = useStateTrk(false);
  const [edit, setEdit] = useStateTrk(null);
  const [selected, setSelected] = useStateTrk({});
  const [bulkMenu, setBulkMenu] = useStateTrk(null);
  const [bulkConfirm, setBulkConfirm] = useStateTrk(null);

  const filtered = orders.filter(o => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (q) {
      const ql = q.toLowerCase();
      const match = (o.id + " " + o.customer + " " + o.phone + " " + o.tracking + " " + o.carrier).toLowerCase().includes(ql);
      if (!match) return false;
    }
    return true;
  });

  const filteredIds = filtered.map(o => o.id);
  const selectedIds = Object.keys(selected).filter(k => selected[k]);
  const selectedCount = selectedIds.length;
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selected[id]);
  const someFilteredSelected = !allFilteredSelected && filteredIds.some(id => selected[id]);

  const toggleOne = (id) => setSelected(s => {
    const n = { ...s };
    if (n[id]) delete n[id]; else n[id] = true;
    return n;
  });
  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected(s => { const n = { ...s }; filteredIds.forEach(id => delete n[id]); return n; });
    } else {
      setSelected(s => { const n = { ...s }; filteredIds.forEach(id => { n[id] = true; }); return n; });
    }
  };
  const clearSelection = () => { setSelected({}); setBulkMenu(null); };

  const bulkStatus = (status) => {
    const stageLabel = TRACK_STAGES.find(s => s.id === status)?.label || status;
    setBulkConfirm({
      title: "ยืนยันการแก้ไขสถานะ",
      description: `อัปเดตสถานะของ ${selectedCount} ออร์เดอร์เป็น \"${stageLabel}\"`,
      count: selectedCount,
      changes: [{ label: "สถานะ", from: "หลายสถานะ", to: stageLabel }],
      action: "อัปเดต",
      onConfirm: () => {
        selectedIds.forEach(id => setOrderField(id, { status }));
        recordChange({
          entity: "order", action: "bulk-update",
          summary: `เปลี่ยนสถานะ ${selectedCount} ออร์เดอร์เป็น ยลยสถานะ: ${stageLabel}`,
          count: selectedCount,
          changes: [{ label: "สถานะใหม่", to: stageLabel }],
          note: `ออร์เดอร์: ${selectedIds.join(", ")}`
        });
        pushToast(`อัปเดตสถานะ ${selectedCount} ออร์เดอร์`);
        setBulkConfirm(null);
        clearSelection();
      }
    });
  };
  const bulkCarrier = (carrier) => {
    setBulkConfirm({
      title: "ยืนยันการเปลี่ยนขนส่ง",
      description: `เปลี่ยนขนส่งของ ${selectedCount} ออร์เดอร์`,
      count: selectedCount,
      changes: [{ label: "ขนส่ง", from: "หลายราย", to: carrier }],
      action: "อัปเดต",
      onConfirm: () => {
        selectedIds.forEach(id => setOrderField(id, { carrier }));
        recordChange({
          entity: "order", action: "bulk-update",
          summary: `เปลี่ยนขนส่ง ${selectedCount} ออร์เดอร์เป็น ${carrier}`,
          count: selectedCount,
          changes: [{ label: "ขนส่งใหม่", to: carrier }],
          note: `ออร์เดอร์: ${selectedIds.join(", ")}`
        });
        pushToast(`เปลี่ยนขนส่ง ${selectedCount} ออร์เดอร์`);
        setBulkConfirm(null);
        clearSelection();
      }
    });
  };
  const bulkDelete = () => {
    setBulkConfirm({
      title: "ยืนยันการลบออร์เดอร์",
      description: `ลบ ${selectedCount} ออร์เดอร์ออกจากระบบติดตาม — จะหายจากตารางและหน้าลูกค้า`,
      count: selectedCount,
      action: "ลบออร์เดอร์",
      danger: true,
      onConfirm: () => {
        selectedIds.forEach(id => setOrderField(id, { deleted: true }));
        recordChange({
          entity: "order", action: "bulk-delete",
          summary: `ลบ ${selectedCount} ออร์เดอร์จากระบบ`,
          count: selectedCount,
          note: `ออร์เดอร์: ${selectedIds.join(", ")}`
        });
        pushToast(`ลบ ${selectedCount} ออร์เดอร์แล้ว`);
        setBulkConfirm(null);
        clearSelection();
      }
    });
  };

  const counts = {
    total: orders.length,
    waiting: orders.filter(o => !o.tracking || o.tracking === "").length,
    shipped: orders.filter(o => o.status === "shipped" || o.status === "delivered").length,
    delivered: orders.filter(o => o.status === "delivered").length
  };

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">ติดตามพัสดุ</h1>
          <div className="page-sub">ระบุเลขพัสดุและขนส่งของออร์เดอร์ที่จัดส่ง ลูกค้าใช้ลิงก์เดียวกันค้นหาเองได้</div>
        </div>
        <div className="row">
          <button className="btn"><Icons.Pkg size={14}/> ส่งออก CSV</button>
          <button className="btn btn-accent" onClick={() => setShareOpen(true)}><Icons.Copy size={14}/> ลิงก์ค้นหาของลูกค้า</button>
        </div>
      </div>

      <div className="grid-3">
        <SmallStat label="ออร์เดอร์ทั้งหมด" value={counts.total} tone="info" hint="ในระบบติดตาม"/>
        <SmallStat label="รอใส่เลขพัสดุ" value={counts.waiting} tone={counts.waiting > 0 ? "warning" : "success"} hint={counts.waiting > 0 ? "ต้องเพิ่มเลขพัสดุ" : "ครบถ้วน"}/>
        <SmallStat label="ส่งให้ขนส่งแล้ว" value={counts.shipped} tone="success" hint={`ถึงปลายทาง ${counts.delivered} ออร์เดอร์`}/>
      </div>

      <div className="card" style={{ padding: 14 }}>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <div className="search" style={{ width: 380 }}>
            <Icons.Search size={14}/>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาออร์เดอร์ ลูกค้า โทรศัพท์ เลขพัสดุ"/>
            {q && <Icons.X size={13} style={{ cursor: "pointer", color: "var(--muted)" }} onClick={() => setQ("")}/>}
          </div>
          <div className="seg">
            <button className={statusFilter === "all" ? "on" : ""} onClick={() => setStatusFilter("all")}>ทุกสถานะ</button>
            {TRACK_STAGES.map(s => (
              <button key={s.id} className={statusFilter === s.id ? "on" : ""} onClick={() => setStatusFilter(s.id)}>{s.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div style={{
          position: "sticky", top: 70, zIndex: 9,
          background: "var(--fg)", color: "oklch(0.99 0.003 250)",
          padding: "10px 18px",
          borderRadius: 14,
          display: "flex", alignItems: "center", gap: 12,
          boxShadow: "var(--shadow-lg)",
          animation: "modalin 0.18s cubic-bezier(0.2, 0.8, 0.3, 1)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 28, height: 28, borderRadius: 999, background: "oklch(0.99 0.003 250)", color: "var(--fg)", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 600 }} className="tnum">{selectedCount}</span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>เลือก {selectedCount} ออร์เดอร์</span>
            <button onClick={clearSelection} style={{ background: "transparent", border: "none", color: "oklch(0.85 0.005 250)", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>ล้างการเลือก</button>
          </div>
          <div className="spacer"/>
          <div className="row" style={{ gap: 6, position: "relative" }}>
            <BulkBtn icon={<Icons.Truck size={13}/>} label="อัปเดตสถานะ" onClick={() => setBulkMenu(bulkMenu === "status" ? null : "status")}/>
            <BulkBtn icon={<Icons.Tag size={13}/>}   label="เปลี่ยนขนส่ง" onClick={() => setBulkMenu(bulkMenu === "carrier" ? null : "carrier")}/>
            <BulkBtn icon={<Icons.Pkg size={13}/>}   label="ส่งออก" onClick={() => pushToast(`ส่งออก ${selectedCount} ออร์เดอร์`)}/>
            <BulkBtn icon={<Icons.Trash size={13}/>} label="ลบ" onClick={bulkDelete} danger/>

            {bulkMenu === "status" && (
              <BulkPopover onClose={() => setBulkMenu(null)} title="เปลี่ยนสถานะเป็น">
                {TRACK_STAGES.map(s => {
                  const I = s.icon;
                  return (
                    <button key={s.id} className="popover-item" onClick={() => bulkStatus(s.id)}>
                      <I size={13} style={{ color: "var(--muted)" }}/>
                      <span style={{ flex: 1 }}>{s.label}</span>
                    </button>
                  );
                })}
              </BulkPopover>
            )}

            {bulkMenu === "carrier" && (
              <BulkPopover onClose={() => setBulkMenu(null)} title="เปลี่ยนขนส่งเป็น">
                {CARRIERS.map(c => (
                  <button key={c.id} className="popover-item" onClick={() => bulkCarrier(c.name)}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: c.color, flexShrink: 0 }}/>
                    <span style={{ flex: 1 }}>{c.name}</span>
                  </button>
                ))}
              </BulkPopover>
            )}
          </div>
        </div>
      )}

      <div className="card card-tight">
        <table className="t">
          <thead><tr>
            <th style={{ width: 36 }}>
              <span
                className={"check" + (allFilteredSelected || someFilteredSelected ? " on" : "")}
                onClick={toggleAll}
                style={someFilteredSelected && !allFilteredSelected ? { background: "var(--accent-soft)", borderColor: "var(--accent)" } : {}}
              />
            </th>
            <th>ออร์เดอร์</th>
            <th>ลูกค้า</th>
            <th>ขนส่ง</th>
            <th>เลขพัสดุ</th>
            <th>สถานะ</th>
            <th>วันที่</th>
            <th style={{ width: 1 }}/>
          </tr></thead>
          <tbody>
            {filtered.map(o => {
              const carrierMeta = CARRIERS.find(c => c.name.toLowerCase().includes(o.carrier.toLowerCase().split(" ")[0])) || {};
              const idx = stageIndex(o.status);
              const stageLabel = TRACK_STAGES[idx]?.label || o.status;
              const isSelected = !!selected[o.id];
              return (
                <tr key={o.id} style={{ cursor: "pointer", background: isSelected ? "var(--accent-soft)" : undefined }}>
                  <td onClick={(e) => { e.stopPropagation(); toggleOne(o.id); }}>
                    <span className={"check" + (isSelected ? " on" : "")}/>
                  </td>
                  <td className="t-mono" style={{ color: "var(--fg)", fontWeight: 500 }} onClick={() => setEdit(o)}>{o.id}</td>
                  <td onClick={() => setEdit(o)}>
                    <div style={{ fontSize: 13 }}>{o.customer}</div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{o.phone}</div>
                  </td>
                  <td onClick={() => setEdit(o)}>
                    {o.carrier ? (
                      <span className="ch-chip">
                        <span className="swatch" style={{ background: carrierMeta.color || "var(--muted)" }}/>
                        {o.carrier}
                      </span>
                    ) : <span style={{ color: "var(--faint)", fontSize: 12 }}>—</span>}
                  </td>
                  <td onClick={() => setEdit(o)}>
                    {o.tracking ? (
                      <span className="mono" style={{ fontSize: 12, color: "var(--fg)", fontWeight: 500 }}>{o.tracking}</span>
                    ) : (
                      <span className="badge badge-warning"><span className="dot"/>ยังไม่ได้ระบุ</span>
                    )}
                  </td>
                  <td onClick={() => setEdit(o)}>
                    <span className={"badge " + (idx === 3 ? "badge-success" : idx === 2 ? "badge-info" : idx === 1 ? "badge-info" : "badge-warning")}>
                      <span className="dot"/>{stageLabel}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--muted)" }} onClick={() => setEdit(o)}>{o.date} {o.ts}</td>
                  <td onClick={() => setEdit(o)}><Icons.Edit size={14} style={{ color: "var(--muted)" }}/></td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan="8" style={{ textAlign: "center", padding: 48, color: "var(--muted)", fontSize: 13 }}>
                ไม่พบออร์เดอร์
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ padding: 16, display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--info-soft)", color: "var(--info)", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Icons.Help size={18}/>
        </div>
        <div style={{ fontSize: 12, color: "var(--fg-2)", lineHeight: 1.5 }}>
          <div style={{ fontWeight: 600, color: "var(--fg)", fontSize: 13, marginBottom: 4 }}>วิธีให้ลูกค้าใช้งาน</div>
          ส่งลิงก์ <strong style={{ color: "var(--accent)" }}>ค้นหาของลูกค้า</strong> ไปทาง LINE, SMS หรือแนบในอีเมลยืนยันคำสั่งซื้อ ลูกค้าสามารถใส่เบอร์โทรหรือชื่อเพื่อดูสถานะพัสดุของตัวเองได้โดยไม่ต้องเข้าสู่ระบบ
        </div>
      </div>

      {edit && <OrderEditDrawer order={edit} onClose={() => setEdit(null)} pushToast={pushToast}/>}
      {shareOpen && <ShareLinkModal store={store} onClose={() => setShareOpen(false)} pushToast={pushToast}/>}
      <ConfirmDialog open={!!bulkConfirm} {...(bulkConfirm || {})} onCancel={() => setBulkConfirm(null)}/>
    </div>
  );
}

function BulkBtn({ icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "6px 10px",
        background: danger ? "oklch(0.42 0.16 25)" : "oklch(0.3 0.01 250)",
        color: "oklch(0.99 0.003 250)",
        border: "none",
        borderRadius: 8,
        fontSize: 12, fontWeight: 500,
        cursor: "pointer",
        fontFamily: "inherit"
      }}
    >
      {icon} {label}
    </button>
  );
}

function BulkPopover({ title, onClose, children }) {
  const ref = useRefTrk(null);
  useEffectTrk(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    setTimeout(() => document.addEventListener("mousedown", h), 0);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} style={{
      position: "absolute",
      top: "calc(100% + 8px)",
      right: 0,
      background: "var(--surface)",
      color: "var(--fg)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      boxShadow: "var(--shadow-lg)",
      padding: 6,
      minWidth: 220,
      zIndex: 30,
      animation: "modalin 0.14s ease-out"
    }}>
      <div style={{ padding: "6px 10px 4px", fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>{title}</div>
      {children}
    </div>
  );
}

/* ============ ORDER EDIT DRAWER (tracking + carrier) ============ */

function OrderEditDrawer({ order, onClose, pushToast }) {
  const [carrier, setCarrier] = useStateTrk(order.carrier || "");
  const [tracking, setTracking] = useStateTrk(order.tracking || "");
  const [status, setStatus] = useStateTrk(order.status);
  const [confirmOpen, setConfirmOpen] = useStateTrk(false);

  const carrierMeta = CARRIERS.find(c => c.name === carrier);

  const STATUS_LABEL = Object.fromEntries(TRACK_STAGES.map(s => [s.id, s.label]));
  const changes = [
    carrier !== (order.carrier || "") && { label: "ผู้ให้บริการขนส่ง", from: order.carrier || "", to: carrier || "—" },
    tracking !== (order.tracking || "") && { label: "เลขพัสดุ", from: order.tracking || "", to: tracking || "—" },
    status !== order.status && { label: "สถานะการจัดส่ง", from: STATUS_LABEL[order.status], to: STATUS_LABEL[status] }
  ].filter(Boolean);

  const requestSave = () => {
    if (changes.length === 0) { onClose(); return; }
    setConfirmOpen(true);
  };

  const doSave = () => {
    setOrderField(order.id, { carrier, tracking, status });
    recordChange({
      entity: "order",
      entityId: order.id,
      action: "update",
      summary: `แก้ไขข้อมูลจัดส่ง ${order.id}`,
      changes
    });
    pushToast(`อัปเดต ${order.id} แล้ว`);
    setConfirmOpen(false);
    onClose();
  };

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose}/>
      <div className="drawer">
        <div className="drawer-head">
          <div>
            <div className="eyebrow">แก้ไขข้อมูลจัดส่ง</div>
            <div className="mono" style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{order.id}</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><Icons.X/></button>
        </div>
        <div className="drawer-body">
          <div style={{ padding: 12, background: "var(--surface-2)", borderRadius: 10, marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>ลูกค้า</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{order.customer}</div>
            <div className="row" style={{ gap: 12, marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
              <span className="mono">{order.phone}</span>
              <span>{order.channel} · {order.items} รายการ</span>
            </div>
          </div>

          <div className="eyebrow" style={{ marginBottom: 8 }}>ขนส่ง</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 18 }}>
            {CARRIERS.map(c => (
              <button
                key={c.id}
                onClick={() => setCarrier(c.name)}
                className="btn"
                style={{
                  justifyContent: "flex-start",
                  padding: "10px 12px",
                  background: carrier === c.name ? "var(--accent-soft)" : "var(--surface)",
                  borderColor: carrier === c.name ? "var(--accent)" : "var(--border)"
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 999, background: c.color, flexShrink: 0 }}/>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{c.name}</span>
                {carrier === c.name && <Icons.Check size={12} style={{ marginLeft: "auto", color: "var(--accent)" }}/>}
              </button>
            ))}
          </div>

          <div className="field" style={{ marginBottom: 18 }}>
            <label>เลขพัสดุ / Tracking Number</label>
            <input
              className="input"
              value={tracking}
              onChange={e => setTracking(e.target.value)}
              placeholder="เช่น TH8842919012"
              style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 14, letterSpacing: "0.04em" }}
            />
            <span className="hint">รหัสที่ขนส่งให้สำหรับติดตามพัสดุ</span>
          </div>

          <div className="eyebrow" style={{ marginBottom: 8 }}>สถานะการจัดส่ง</div>
          <div className="stack" style={{ gap: 6 }}>
            {TRACK_STAGES.map((s, i) => {
              const I = s.icon;
              const isCurrent = s.id === status;
              return (
                <div
                  key={s.id}
                  onClick={() => setStatus(s.id)}
                  style={{
                    padding: 12,
                    background: isCurrent ? "var(--accent-soft)" : "var(--surface-2)",
                    border: "1px solid " + (isCurrent ? "var(--accent)" : "var(--border)"),
                    borderRadius: 10,
                    cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 10
                  }}
                >
                  <span className={"check" + (isCurrent ? " on" : "")}/>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--surface)", display: "grid", placeItems: "center", color: isCurrent ? "var(--accent)" : "var(--muted)" }}>
                    <I size={14}/>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{s.label}</span>
                  <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: "auto" }}>ขั้นที่ {i + 1}</span>
                </div>
              );
            })}
          </div>

          {tracking && carrier && (
            <div style={{ marginTop: 18, padding: 12, background: "var(--success-soft)", color: "var(--success)", borderRadius: 10, fontSize: 12 }}>
              <div className="row" style={{ gap: 8 }}>
                <Icons.Check size={14}/>
                <span><strong>พร้อมแชร์ให้ลูกค้า</strong> — ลูกค้าค้นหาด้วยเบอร์ <span className="mono" style={{ color: "var(--fg)" }}>{order.phone}</span> จะเห็นเลข <span className="mono" style={{ color: "var(--fg)" }}>{tracking}</span></span>
              </div>
            </div>
          )}
        </div>
        <div className="drawer-foot">
          <button className="btn" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={requestSave} disabled={changes.length === 0} style={changes.length === 0 ? { opacity: 0.5, cursor: "not-allowed" } : {}}>
            <Icons.Check size={14}/> บันทึก{changes.length > 0 ? ` (${changes.length} เปลี่ยน)` : ""}
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="ยืนยันการแก้ไขข้อมูลจัดส่ง"
        description={`การเปลี่ยนแปลงนี้จะมีผลกับออร์เดอร์ ${order.id}`}
        changes={changes}
        action="บันทึก"
        onConfirm={doSave}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

/* ============ SHARE LINK MODAL ============ */

function ShareLinkModal({ store, onClose, pushToast }) {
  const [dateMode, setDateMode] = useStateTrk("all"); // all | today | custom
  const [customDate, setCustomDate] = useStateTrk(TODAY_ISO);
  const [copied, setCopied] = useStateTrk(false);

  const dateForUrl =
    dateMode === "today" ? TODAY_ISO :
    dateMode === "custom" ? customDate :
    null;

  const base = window.location.origin + window.location.pathname;
  const url = base + "#track" + (dateForUrl ? "/" + dateForUrl : "");

  // Count orders for the chosen date (live preview)
  const orders = useOrders();
  const matchingCount =
    !dateForUrl ? orders.length :
    orders.filter(o => o.dateIso === dateForUrl).length;

  // Reset copied flag whenever the URL changes
  useEffectTrk(() => { setCopied(false); }, [url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      pushToast("คัดลอกลิงก์แล้ว");
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      pushToast("กรุณาคัดลอกลิงก์ด้วยตัวเอง");
    }
  };

  const openPreview = () => window.open(url, "_blank", "noopener");

  const dateLabel =
    dateMode === "today" ? `วันนี้ (${isoToThai(TODAY_ISO)})` :
    dateMode === "custom" ? isoToThai(customDate) :
    "ทุกออร์เดอร์";

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose}/>
      <div className="modal" style={{ width: 580 }}>
        <div className="modal-head">
          <div>
            <h3>ลิงก์ค้นหาของลูกค้า</h3>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>ส่งลิงก์นี้ให้ลูกค้าเพื่อให้ค้นหาสถานะพัสดุของตัวเอง</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><Icons.X/></button>
        </div>
        <div className="modal-body">

          {/* Date scope picker */}
          <div className="eyebrow" style={{ marginBottom: 10 }}>ขอบเขตของลิงก์</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
            <DateModeBtn icon={<Icons.Pkg size={14}/>}     label="ทุกออร์เดอร์" sub="ไม่จำกัดวัน" active={dateMode === "all"}    onClick={() => setDateMode("all")}/>
            <DateModeBtn icon={<Icons.Dot size={14}/>}     label="วันนี้"       sub={isoToThai(TODAY_ISO)} active={dateMode === "today"}  onClick={() => setDateMode("today")}/>
            <DateModeBtn icon={<Icons.Calendar size={14}/>}label="ระบุวัน"     sub={dateMode === "custom" ? isoToThai(customDate) : "เลือกวันที่"} active={dateMode === "custom"} onClick={() => setDateMode("custom")}/>
          </div>

          {dateMode === "custom" && (
            <div style={{ padding: 12, background: "var(--surface-2)", borderRadius: 12, marginBottom: 14, border: "1px solid var(--border)" }}>
              <div className="row" style={{ gap: 10, alignItems: "center" }}>
                <Icons.Calendar size={16} style={{ color: "var(--muted)" }}/>
                <input
                  type="date"
                  value={customDate}
                  onChange={e => setCustomDate(e.target.value)}
                  className="input"
                  style={{ flex: 1, padding: "8px 12px", fontSize: 14 }}
                />
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{isoToThai(customDate)}</span>
              </div>
              <div className="row" style={{ gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "var(--muted)", marginRight: 4 }}>เลือกด่วน:</span>
                {[
                  { iso: TODAY_ISO, label: "วันนี้" },
                  { iso: "2026-05-18", label: "เมื่อวาน" },
                  { iso: "2026-05-16", label: "16 พ.ค." }
                ].map(d => (
                  <button key={d.iso} className={"btn btn-sm" + (customDate === d.iso ? " btn-primary" : "")} style={{ padding: "3px 9px", fontSize: 11 }} onClick={() => setCustomDate(d.iso)}>{d.label}</button>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 12, fontSize: 12, color: "var(--muted)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>ลิงก์นี้ครอบคลุม: <strong style={{ color: "var(--fg)" }}>{dateLabel}</strong></span>
            <span><strong className="tnum" style={{ color: "var(--fg)" }}>{matchingCount}</strong> ออร์เดอร์</span>
          </div>

          {/* URL row */}
          <div style={{ padding: 14, background: "var(--surface-2)", borderRadius: 14, marginBottom: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>ลิงก์ของคุณ</div>
            <div style={{ display: "flex", gap: 8 }}>
              <div className="mono" style={{
                flex: 1,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 12,
                color: "var(--fg)",
                wordBreak: "break-all",
                userSelect: "all"
              }}>{url}</div>
              <button className="btn btn-primary" onClick={copy} style={{ flexShrink: 0 }}>
                {copied ? <><Icons.Check size={14}/> คัดลอกแล้ว</> : <><Icons.Copy size={14}/> คัดลอก</>}
              </button>
            </div>
          </div>

          {/* QR + tips */}
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 18, marginBottom: 18, alignItems: "center" }}>
            <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: 12, padding: 10 }}>
              <QR value={url} size={120}/>
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>QR Code สำหรับโปสเตอร์หรือซองพัสดุ</div>
              <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
                พิมพ์ QR ไว้บนซองสินค้าหรือใส่ในข้อความขอบคุณ ลูกค้าสแกนแล้วเข้าหน้าค้นหาได้ทันที — ไม่ต้องล็อกอิน
              </div>
              <button className="btn btn-sm" style={{ marginTop: 10 }}><Icons.Print size={12}/> พิมพ์ QR ขนาด A6</button>
            </div>
          </div>

          <div className="eyebrow" style={{ marginBottom: 8 }}>ตัวอย่างข้อความที่ส่งให้ลูกค้า</div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, fontSize: 13, lineHeight: 1.7 }}>
            สวัสดีค่ะ {dateForUrl ? "ออร์เดอร์ที่จัดส่งวัน" + isoToThai(dateForUrl) : "ออร์เดอร์ของคุณจาก"} <strong>{store?.name || "คลังพร้อมส่ง"}</strong> 🎉<br/>
            ติดตามสถานะพัสดุของคุณได้ที่:<br/>
            <span className="mono" style={{ color: "var(--accent)", fontSize: 12 }}>{url}</span><br/>
            กรอกชื่อหรือเบอร์โทรที่ใช้สั่งซื้อเพื่อดูสถานะการจัดส่งได้ตลอด 24 ชม.
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={openPreview}><Icons.Eye size={14}/> ดูตัวอย่างหน้าจริง</button>
          <button className="btn btn-primary" onClick={copy}>
            {copied ? <><Icons.Check size={14}/> คัดลอกแล้ว</> : <><Icons.Copy size={14}/> คัดลอกลิงก์</>}
          </button>
        </div>
      </div>
    </>
  );
}

function DateModeBtn({ icon, label, sub, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="btn"
      style={{
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 4,
        padding: "10px 12px",
        background: active ? "var(--accent-soft)" : "var(--surface)",
        borderColor: active ? "var(--accent)" : "var(--border)",
        lineHeight: 1.2
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 6, color: active ? "var(--accent)" : "var(--fg-2)" }}>
        {icon}
        <span style={{ fontSize: 12, fontWeight: 600, color: active ? "var(--accent)" : "var(--fg)" }}>{label}</span>
        {active && <Icons.Check size={11} style={{ marginLeft: "auto" }}/>}
      </span>
      <span style={{ fontSize: 10, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>{sub}</span>
    </button>
  );
}

/* ============ CUSTOMER LOOKUP (public, no login) ============ */

function CustomerLookup() {
  const [store, setStore] = useStateTrk(() => {
    try { return { ...DEFAULT_STORE, ...JSON.parse(localStorage.getItem("ims_store") || "{}") }; }
    catch { return DEFAULT_STORE; }
  });
  const [q, setQ] = useStateTrk("");
  const [searched, setSearched] = useStateTrk(false);
  const [selected, setSelected] = useStateTrk(null);
  const [overrides, setOverrides] = useStateTrk(() => loadOrderOverrides());
  const inputRef = useRefTrk(null);

  // Parse date from URL hash (#track/2026-05-19)
  const parseDateFromHash = () => {
    const parts = window.location.hash.replace("#", "").split("/");
    const candidate = parts[1];
    if (candidate && /^\d{4}-\d{2}-\d{2}$/.test(candidate)) return candidate;
    return null;
  };
  const [dateFilter, setDateFilter] = useStateTrk(() => parseDateFromHash());

  useEffectTrk(() => {
    inputRef.current?.focus();
    const h = () => setOverrides(loadOrderOverrides());
    window.addEventListener("ims-orders-change", h);
    const hh = () => setDateFilter(parseDateFromHash());
    window.addEventListener("hashchange", hh);
    return () => {
      window.removeEventListener("ims-orders-change", h);
      window.removeEventListener("hashchange", hh);
    };
  }, []);

  const orders = OUTBOUND.map(o => ({ ...o, ...(overrides[o.id] || {}) }));
  const dateFilteredOrders = dateFilter ? orders.filter(o => o.dateIso === dateFilter) : orders;

  const search = () => {
    setSearched(true);
    setSelected(null);
  };

  const clearDateFilter = () => {
    setDateFilter(null);
    window.history.replaceState(null, "", window.location.pathname + "#track");
  };

  const matches = useMemoTrk(() => {
    if (!searched || !q.trim()) return [];
    const ql = q.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return dateFilteredOrders.filter(o => {
      if (ql.length >= 3 && o.customer.toLowerCase().includes(ql)) return true;
      if (digits.length >= 4 && o.phone.replace(/\D/g, "").includes(digits)) return true;
      if (ql.length >= 4 && o.tracking.toLowerCase().includes(ql)) return true;
      if (ql.length >= 4 && o.id.toLowerCase().includes(ql)) return true;
      return false;
    });
  }, [q, searched, overrides, dateFilter]);

  if (selected) return <CustomerOrderDetail order={selected} store={store} onBack={() => setSelected(null)}/>;

  const isToday = dateFilter === TODAY_ISO;

  return (
    <div className="auth-page" style={{ alignItems: "flex-start", paddingTop: 60, paddingBottom: 40 }}>
      <div style={{ width: "100%", maxWidth: 640 }}>
        {/* Branded header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
            <StoreLogoMark store={store} size={56}/>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", margin: "8px 0 4px" }}>{store.name}</h1>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>ติดตามสถานะพัสดุของคุณได้ตลอด 24 ชม.</div>
        </div>

        {/* Date scope banner */}
        {dateFilter && (
          <div style={{
            background: isToday ? "linear-gradient(135deg, var(--accent), oklch(0.45 0.22 252))" : "linear-gradient(135deg, var(--fg), oklch(0.16 0.01 250))",
            color: "white",
            borderRadius: 14,
            padding: "14px 18px",
            marginBottom: 16,
            display: "flex", alignItems: "center", gap: 14,
            boxShadow: "0 12px 28px oklch(0.3 0.1 252 / 0.18)"
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "oklch(1 0 0 / 0.2)", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Icons.Calendar size={18}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, opacity: 0.8, letterSpacing: "0.06em", textTransform: "uppercase" }}>สรุปการจัดส่งประจำวัน</div>
              <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em", marginTop: 1 }}>
                {isToday ? "วันนี้ · " : ""}{isoToThai(dateFilter)}
              </div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                {dateFilteredOrders.length === 0 ? "ไม่มีออร์เดอร์ในวันนี้" : `${dateFilteredOrders.length} ออร์เดอร์ในวันที่นี้ — ค้นหาด้วยเบอร์หรือชื่อด้านล่าง`}
              </div>
            </div>
            <button onClick={clearDateFilter} className="btn btn-sm" style={{ background: "oklch(1 0 0 / 0.15)", color: "white", border: "1px solid oklch(1 0 0 / 0.2)", flexShrink: 0 }}>
              ดูทุกวัน
            </button>
          </div>
        )}

        <div className="auth-card" style={{ maxWidth: 640 }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em" }}>ค้นหาพัสดุของคุณ</h2>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>กรอก <strong>เบอร์โทรศัพท์</strong> หรือ <strong>ชื่อ</strong> ที่ใช้สั่งซื้อ</div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); search(); }}>
            <div style={{ display: "flex", gap: 8 }}>
              <div className="search" style={{ flex: 1, width: "auto", padding: "12px 16px" }}>
                <Icons.Search size={16}/>
                <input
                  ref={inputRef}
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="เช่น 081-552-0917 หรือ ปิยะนุช"
                  style={{ fontSize: 15 }}
                />
                {q && <Icons.X size={14} style={{ cursor: "pointer", color: "var(--muted)" }} onClick={() => { setQ(""); setSearched(false); inputRef.current?.focus(); }}/>}
              </div>
              <button type="submit" className="btn btn-accent" disabled={!q.trim()} style={{ padding: "12px 22px", fontSize: 14 }}>
                ค้นหา
              </button>
            </div>
          </form>

          {!searched && (
            <div style={{ marginTop: 18 }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>{dateFilter ? "ลองค้นหาในวันนี้" : "ลองค้นหา (ตัวอย่าง)"}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(() => {
                  // Show example queries from orders in current scope
                  const scope = dateFilter ? dateFilteredOrders : orders;
                  const samples = [...new Set(scope.flatMap(o => [o.phone, o.customer.replace("คุณ ", "").split(" ")[0]]))].slice(0, 4);
                  return samples.map(s => (
                    <button key={s} className="btn btn-sm" onClick={() => { setQ(s); setSearched(true); }}>
                      <Icons.Search size={11}/> {s}
                    </button>
                  ));
                })()}
              </div>
            </div>
          )}

          {searched && (
            <div style={{ marginTop: 24 }}>
              {matches.length === 0 ? (
                <div style={{ padding: 36, textAlign: "center", background: "var(--surface-2)", borderRadius: 14 }}>
                  <Icons.Search size={32} style={{ color: "var(--muted)", opacity: 0.5, marginBottom: 10 }}/>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>ไม่พบพัสดุที่ตรงกับ "{q}"{dateFilter && " ในวันที่ " + isoToThai(dateFilter)}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>
                    ตรวจสอบเบอร์โทรหรือชื่อให้ตรงกับที่ใช้ตอนสั่งซื้อ<br/>
                    หากต้องการความช่วยเหลือ ติดต่อ <a className="lnk" href="#">{store.sender?.phone || "02-555-0188"}</a>
                  </div>
                  {dateFilter && (
                    <button className="btn btn-sm" style={{ marginTop: 14 }} onClick={clearDateFilter}>
                      <Icons.Refresh size={12}/> ค้นหาในทุกวัน
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>พบพัสดุ <strong style={{ color: "var(--fg)" }}>{matches.length}</strong> รายการที่ตรงกับ "{q}"{dateFilter && ` (วันที่ ${isoToThai(dateFilter)})`}</div>
                  <div className="stack" style={{ gap: 10 }}>
                    {matches.map(o => <CustomerOrderCard key={o.id} order={o} onOpen={() => setSelected(o)}/>)}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div style={{ marginTop: 28, textAlign: "center", fontSize: 12, color: "var(--muted)" }}>
          <div>หากต้องการความช่วยเหลือ ติดต่อ <a className="lnk" href={`tel:${store.sender?.phone}`}>{store.sender?.phone || "02-555-0188"}</a> · {store.sender?.addr1}</div>
          <div style={{ marginTop: 8 }}>© {new Date().getFullYear()} {store.name}</div>
        </div>
      </div>
    </div>
  );
}

function CustomerOrderCard({ order, onOpen }) {
  const idx = stageIndex(order.status);
  const stage = TRACK_STAGES[idx] || TRACK_STAGES[0];
  const Icon = stage.icon;
  const carrierMeta = CARRIERS.find(c => c.name.toLowerCase().includes(order.carrier.toLowerCase().split(" ")[0])) || {};
  return (
    <button onClick={onOpen} style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      padding: 16,
      width: "100%",
      cursor: "pointer",
      textAlign: "left",
      fontFamily: "inherit",
      color: "var(--fg)",
      display: "flex", alignItems: "center", gap: 14,
      transition: "transform 0.08s, box-shadow 0.12s"
    }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: carrierMeta.color || "var(--surface-3)", color: "white", display: "grid", placeItems: "center", flexShrink: 0 }}>
        <Icon size={20}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ gap: 8, justifyContent: "space-between" }}>
          <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{order.id}</span>
          <span className={"badge " + (idx === 3 ? "badge-success" : idx === 2 ? "badge-info" : "badge-warning")} style={{ fontSize: 11 }}>
            <span className="dot"/>{stage.label}
          </span>
        </div>
        <div style={{ fontSize: 13, marginTop: 4 }}>{order.customer}</div>
        <div className="row" style={{ gap: 8, marginTop: 4, fontSize: 11, color: "var(--muted)" }}>
          <span>{order.carrier}</span>
          {order.tracking && <><span>·</span><span className="mono">{order.tracking}</span></>}
          <span>·</span><span>{order.date}</span>
        </div>
      </div>
      <Icons.Chev size={14} style={{ color: "var(--muted)", flexShrink: 0 }}/>
    </button>
  );
}

function CustomerOrderDetail({ order, store, onBack }) {
  const idx = stageIndex(order.status);
  const carrierMeta = CARRIERS.find(c => c.name.toLowerCase().includes(order.carrier.toLowerCase().split(" ")[0])) || {};

  // Generate fake timestamps based on date
  const baseDate = order.date;
  const timeline = [
    { stage: 0, time: "10:30",   date: "17 พ.ค. 2569", note: "ได้รับคำสั่งซื้อจาก " + order.channel },
    { stage: 1, time: "14:20",   date: "17 พ.ค. 2569", note: "พนักงานหยิบสินค้าเสร็จ" },
    { stage: 2, time: order.ts,  date: baseDate,        note: "ส่งมอบให้ " + order.carrier },
    { stage: 3, time: "—",       date: "ประมาณ 21 พ.ค.", note: "อยู่ระหว่างนำส่งโดยผู้จัดส่ง" }
  ];

  return (
    <div className="auth-page" style={{ alignItems: "flex-start", paddingTop: 40, paddingBottom: 40 }}>
      <div style={{ width: "100%", maxWidth: 640 }}>
        <button onClick={onBack} className="btn" style={{ marginBottom: 18, background: "oklch(1 0 0 / 0.7)", backdropFilter: "blur(10px)" }}>
          <Icons.Chev size={14} style={{ transform: "rotate(180deg)" }}/> กลับไปค้นหา
        </button>

        <div className="auth-card" style={{ maxWidth: 640, padding: 32 }}>
          <div className="row" style={{ gap: 14, marginBottom: 20 }}>
            <StoreLogoMark store={store} size={44}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{store.name}</div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>{order.id}</div>
            </div>
            <span className={"badge " + (idx === 3 ? "badge-success" : "badge-info")} style={{ fontSize: 12, padding: "4px 10px" }}>
              <span className="dot"/>{TRACK_STAGES[idx].label}
            </span>
          </div>

          {/* Tracking number prominent */}
          <div style={{ padding: 20, background: "linear-gradient(135deg, var(--fg), oklch(0.12 0.01 250))", color: "oklch(0.99 0.003 250)", borderRadius: 16, marginBottom: 20 }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 11, opacity: 0.7, letterSpacing: "0.08em", textTransform: "uppercase" }}>เลขพัสดุ</span>
              {order.carrier && <span className="row" style={{ gap: 6, fontSize: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: carrierMeta.color || "white" }}/>
                {order.carrier}
              </span>}
            </div>
            {order.tracking ? (
              <div className="mono" style={{ fontSize: 24, fontWeight: 600, letterSpacing: "0.04em" }}>{order.tracking}</div>
            ) : (
              <div style={{ fontSize: 14, opacity: 0.7 }}>ยังไม่ได้ระบุเลขพัสดุ — กำลังจัดเตรียม</div>
            )}
            {order.tracking && (
              <button className="btn btn-sm" style={{ marginTop: 12, background: "oklch(1 0 0 / 0.15)", color: "white", border: "1px solid oklch(1 0 0 / 0.2)" }} onClick={() => navigator.clipboard?.writeText(order.tracking)}>
                <Icons.Copy size={12}/> คัดลอกเลขพัสดุ
              </button>
            )}
          </div>

          {/* Timeline */}
          <div className="eyebrow" style={{ marginBottom: 14 }}>ไทม์ไลน์การจัดส่ง</div>
          <div style={{ position: "relative" }}>
            {timeline.map((step, i) => {
              const past = step.stage <= idx;
              const isCurrent = step.stage === idx;
              const StageIcon = TRACK_STAGES[step.stage].icon;
              return (
                <div key={i} style={{ display: "flex", gap: 14, marginBottom: i < timeline.length - 1 ? 16 : 0, position: "relative" }}>
                  {i < timeline.length - 1 && (
                    <div style={{
                      position: "absolute",
                      left: 17, top: 36, bottom: -16,
                      width: 2,
                      background: past ? "var(--success)" : "var(--border)"
                    }}/>
                  )}
                  <div style={{
                    width: 36, height: 36,
                    borderRadius: 999,
                    background: past ? (isCurrent ? "var(--accent)" : "var(--success)") : "var(--surface-3)",
                    color: past ? "white" : "var(--muted)",
                    display: "grid", placeItems: "center",
                    flexShrink: 0,
                    boxShadow: isCurrent ? "0 0 0 4px var(--accent-ring)" : "none",
                    zIndex: 1
                  }}>
                    {past ? <Icons.Check size={14} stroke={2.2}/> : <StageIcon size={14}/>}
                  </div>
                  <div style={{ flex: 1, paddingTop: 6 }}>
                    <div style={{ fontWeight: isCurrent ? 600 : 500, fontSize: 14, color: past ? "var(--fg)" : "var(--muted)" }}>
                      {TRACK_STAGES[step.stage].label}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{step.note}</div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{step.date} · {step.time}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Order summary */}
          <div className="divider" style={{ margin: "24px 0" }}/>
          <div className="eyebrow" style={{ marginBottom: 10 }}>สรุปคำสั่งซื้อ</div>
          <div style={{ background: "var(--surface-2)", borderRadius: 12, padding: 14 }}>
            <div className="row" style={{ justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
              <span style={{ color: "var(--muted)" }}>ชื่อผู้รับ</span>
              <span style={{ fontWeight: 500 }}>{order.customer}</span>
            </div>
            <div className="row" style={{ justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
              <span style={{ color: "var(--muted)" }}>เบอร์ติดต่อ</span>
              <span className="mono">{order.phone}</span>
            </div>
            <div className="row" style={{ justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
              <span style={{ color: "var(--muted)" }}>ช่องทางสั่งซื้อ</span>
              <span>{order.channel}</span>
            </div>
            <div className="row" style={{ justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
              <span style={{ color: "var(--muted)" }}>จำนวนสินค้า</span>
              <span><strong className="tnum">{order.items}</strong> รายการ</span>
            </div>
          </div>

          {/* Help footer */}
          <div style={{ marginTop: 20, padding: 14, background: "var(--info-soft)", color: "var(--fg-2)", borderRadius: 12, fontSize: 12, lineHeight: 1.6 }}>
            มีคำถามเกี่ยวกับพัสดุนี้? ติดต่อ {store.name} ที่ <a className="lnk" href={`tel:${store.sender?.phone}`}>{store.sender?.phone || "02-555-0188"}</a>
            <br/>หรือนำเลขพัสดุไปตรวจสอบที่เว็บไซต์ของ {order.carrier}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TrackingPage, CustomerLookup, useOrders, setOrderField });
