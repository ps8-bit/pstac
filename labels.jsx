/* Label editor + batch print */

const { useState: useStateLB, useMemo: useMemoLB, useEffect: useEffectLB } = React;

const MM_TO_PX = 3.78; // ~96dpi screen approximation

/* Create a well-formed blank label (every field the editor + LabelPaper expect) */
function makeBlankLabel(existing) {
  const senderTemplate = (typeof SAMPLE_LABELS !== "undefined" && SAMPLE_LABELS[0])
    ? { ...SAMPLE_LABELS[0].sender }
    : { name: "", addr1: "", addr2: "", phone: "" };
  return {
    id: "LBL-NEW-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
    soId: "ฉลากใหม่ " + ((existing ? existing.length : 0) + 1),
    sender: senderTemplate,
    recipient: { name: "", addr1: "", addr2: "", phone: "" },
    carrier: "Kerry Express",
    tracking: "",
    cod: 0,
    weight: "0.5 kg",
    items: []
  };
}

/* The label queue persists to localStorage so edits and freshly-created labels
   survive navigating away from the page and back (the component unmounts on
   navigation, so in-memory-only state would reset to the samples every time). */
function loadLabels() {
  if (window._DB_LABELS) return window._DB_LABELS;
  try {
    const raw = localStorage.getItem("ims_labels");
    if (raw !== null) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    }
  } catch (e) {}
  return SAMPLE_LABELS.map(l => ({ ...l, items: l.items.map(it => ({ ...it })) }));
}
function saveLabels(labels) {
  // Detect and delete removed labels from DB
  const prev = window._DB_LABELS;
  if (prev && window.dbDeleteLabel) {
    const newIds = new Set(labels.map(l => l.id));
    prev.filter(l => !newIds.has(l.id)).forEach(l => dbDeleteLabel(l.id).catch(() => {}));
  }
  try { localStorage.setItem("ims_labels", JSON.stringify(labels)); } catch (e) {}
  window._DB_LABELS = labels;
  window.dispatchEvent(new CustomEvent("ims-labels-change"));
  if (window.dbUpsertLabels) dbUpsertLabels(labels).catch(() => {});
}

function Labels({ pushToast, store }) {
  const [labels, setLabels] = useStateLB(loadLabels);
  const [activeId, setActiveId] = useStateLB(() => (labels[0] ? labels[0].id : null));
  const [savedSnapshots, setSavedSnapshots] = useStateLB(() => {
    const m = {};
    loadLabels().forEach(l => { m[l.id] = JSON.stringify(l); });
    return m;
  });
  const [confirmOpen, setConfirmOpen] = useStateLB(false);
  const [showErrors, setShowErrors] = useStateLB(false);
  const [sizeId, setSizeId] = useStateLB("100x150");
  const [selected, setSelected] = useStateLB(() => Object.fromEntries(labels.map(l => [l.id, true])));
  const [view, setView] = useStateLB("editor"); // editor | batch
  const [zoom, setZoom] = useStateLB(1);
  const [pdfLoading, setPdfLoading] = useStateLB(false);

  const size = LABEL_SIZES.find(s => s.id === sizeId);
  // Fallback to the first label so `active` is never undefined while the queue is non-empty
  const active = labels.find(l => l.id === activeId) || labels[0] || null;

  // Persist the queue on every change so edits + created labels are never lost
  useEffectLB(() => { saveLabels(labels); }, [labels]);

  // Reload from DB when a remote team-member change arrives via real-time
  useEffectLB(() => {
    const reload = () => { if (window._DB_LABELS) setLabels(window._DB_LABELS); };
    window.addEventListener("ims-labels-change", reload);
    return () => window.removeEventListener("ims-labels-change", reload);
  }, []);

  // Pick up labels queued from the Outbound page ("สร้างฉลาก")
  useEffectLB(() => {
    const pending = window.__pendingLabels;
    if (!pending || !pending.length) return;
    window.__pendingLabels = [];
    // Map labels already in the queue by their order id (soId) — avoid duplicates
    const existingIdBySoId = {};
    labels.forEach(l => { if (!(l.soId in existingIdBySoId)) existingIdBySoId[l.soId] = l.id; });
    const toAdd = pending.filter(p => !(p.soId in existingIdBySoId));
    if (toAdd.length) {
      setLabels(prev => [...toAdd, ...prev]);
      setSelected(s => {
        const n = { ...s };
        toAdd.forEach(p => { n[p.id] = true; });
        return n;
      });
    }
    // Activate the label for the first requested order (newly added or pre-existing)
    const first = pending[0];
    setActiveId(existingIdBySoId[first.soId] || first.id);
    setView("editor");
  }, []);

  const updateActive = (fn) => {
    setLabels(ls => ls.map(l => l.id === activeId ? fn(l) : l));
    setShowErrors(false);
  };

  const validateLabel = (label) => {
    if (!label) return { ok: false, reason: "ไม่พบฉลาก" };
    if (!label.items.length) return { ok: false, reason: "ต้องมีรายการอย่างน้อย 1 รายการ" };
    const missing = label.items.filter(it => !it.sku);
    if (missing.length) return { ok: false, reason: `มี ${missing.length} รายการที่ยังไม่ได้เลือกสินค้า` };
    const badQty = label.items.filter(it => !it.qty || it.qty <= 0);
    if (badQty.length) return { ok: false, reason: `มี ${badQty.length} รายการจำนวนไม่ถูกต้อง` };
    if (!label.recipient.name.trim()) return { ok: false, reason: "ยังไม่ได้ระบุชื่อผู้รับ" };
    return { ok: true };
  };

  const isDirty = active && savedSnapshots[active.id] !== JSON.stringify(active);
  const validation = validateLabel(active);

  const requestSave = () => {
    if (!validation.ok) {
      setShowErrors(true);
      pushToast(validation.reason);
      return;
    }
    if (!isDirty) {
      pushToast("ไม่มีการเปลี่ยนแปลง");
      return;
    }
    setConfirmOpen(true);
  };

  const doSave = () => {
    setSavedSnapshots(s => ({ ...s, [active.id]: JSON.stringify(active) }));
    recordChange({
      entity: "label",
      entityId: active.soId,
      action: "update",
      summary: `บันทึกฉลาก ${active.soId} · ${active.items.length} รายการ`,
      changes: [
        { label: "ผู้รับ", to: active.recipient.name },
        { label: "ขนส่ง", to: active.carrier },
        { label: "เลขพัสดุ", to: active.tracking || "—" },
        { label: "รายการ", to: `${active.items.length} SKU · ${active.items.reduce((s,x)=>s+x.qty,0)} ชิ้น` }
      ]
    });
    pushToast(`บันทึกฉลาก ${active.soId} แล้ว`);
    setConfirmOpen(false);
    setShowErrors(false);
  };

  /* ── PDF export helpers ─────────────────────────────────────────────────── */
  const _capturePaper = (el) =>
    window.html2canvas(el, {
      scale: 3 / zoom,   // compensate for CSS zoom transform on parent
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      onclone: (clonedDoc) => {
        // html2canvas 1.4.1 throws on oklch() in stylesheets.
        // LabelPaper is 100% inline-styled (hex/rgb only), so dropping
        // all external sheets from the clone has zero visual effect.
        clonedDoc.querySelectorAll('link[rel="stylesheet"]').forEach(n => n.remove());
        clonedDoc.querySelectorAll('style').forEach(n => n.remove());
        const s = clonedDoc.createElement("style");
        s.textContent = [
          "*, *::before, *::after { box-sizing: border-box; }",
          "body { margin: 0; }",
          '.label-paper { background: #fff; font-family: "IBM Plex Sans","IBM Plex Sans Thai",sans-serif; color: #111; }',
          '.mono { font-family: "IBM Plex Mono",monospace; }',
        ].join("\n");
        clonedDoc.head.appendChild(s);
      },
    });

  const exportSinglePDF = async () => {
    const el = document.querySelector(".label-stage .label-paper");
    if (!el) throw new Error("ไม่พบ element ฉลาก");
    const canvas = await _capturePaper(el);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "mm", format: [size.w, size.h] });
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, size.w, size.h);
    const filename = (active.soId || "label").replace(/[/\\:*?"<>|]/g, "_") + "_label.pdf";
    pdf.save(filename);
    pushToast("ดาวน์โหลด " + filename + " แล้ว ✓");
  };

  const exportBatchPDF = async () => {
    const sel = labels.filter(l => selected[l.id]);
    if (!sel.length) { pushToast("ยังไม่ได้เลือกฉลาก"); return; }
    const paperEls = [...document.querySelectorAll(".batch-card .label-paper")];
    if (!paperEls.length) { pushToast("ไม่พบฉลากในชุดพิมพ์"); return; }
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "mm", format: [size.w, size.h] });
    for (let i = 0; i < paperEls.length; i++) {
      if (i > 0) pdf.addPage([size.w, size.h]);
      const canvas = await _capturePaper(paperEls[i]);
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, size.w, size.h);
    }
    const filename = "labels_batch_" + sel.length + "pcs.pdf";
    pdf.save(filename);
    pushToast("ดาวน์โหลด PDF ชุด " + sel.length + " ใบแล้ว ✓");
  };

  const printNow = async () => {
    if (!window.html2canvas || !window.jspdf) {
      pushToast("⚠️ ไลบรารี PDF ยังโหลดไม่เสร็จ กรุณารอสักครู่แล้วลองใหม่");
      return;
    }
    setPdfLoading(true);
    try {
      if (view === "batch") {
        await exportBatchPDF();
      } else {
        await exportSinglePDF();
      }
    } catch (e) {
      console.error("PDF export error:", e);
      pushToast("เกิดข้อผิดพลาด: " + (e.message || String(e)));
    }
    setPdfLoading(false);
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head no-print">
        <div>
          <h1 className="page-title">พิมพ์ฉลากจัดส่ง</h1>
          <div className="page-sub">แก้ไขรายละเอียดฉลาก เลือกขนาด และพิมพ์ทีละแผ่นหรือเป็นชุด</div>
        </div>
        <div className="row">
          <div className="seg">
            <button className={view === "editor" ? "on" : ""} onClick={() => setView("editor")}>แก้ไขทีละใบ</button>
            <button className={view === "batch" ? "on" : ""} onClick={() => setView("batch")}>ชุดพิมพ์ ({selectedCount})</button>
          </div>
          <button className="btn" onClick={() => {
            const blank = makeBlankLabel(labels);
            setLabels(ls => [...ls, blank]);
            setSelected(s => ({ ...s, [blank.id]: true }));
            setActiveId(blank.id);
            setView("editor");
            pushToast("สร้างฉลากใหม่แล้ว");
          }}><Icons.Plus/> สร้างฉลากใหม่</button>
          <button className="btn btn-primary" onClick={printNow} disabled={pdfLoading} style={pdfLoading ? { opacity: 0.75, cursor: "wait" } : {}}>
            {pdfLoading ? "⏳ กำลังสร้าง PDF…" : <><Icons.Print/> ส่งออก PDF</>}
          </button>
        </div>
      </div>

      {/* Size + batch controls */}
      <div className="card no-print" style={{ padding: 14 }}>
        <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>ขนาดฉลาก</div>
            <div className="row" style={{ gap: 6 }}>
              {LABEL_SIZES.map(s => (
                <button
                  key={s.id}
                  className={"btn btn-sm" + (sizeId === s.id ? " btn-primary" : "")}
                  onClick={() => setSizeId(s.id)}
                  style={{ flexDirection: "column", alignItems: "flex-start", padding: "8px 12px", lineHeight: 1.2 }}
                >
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{s.label}</span>
                  <span style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{s.desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch", margin: "0 6px" }}/>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>การพิมพ์</div>
            <div className="row" style={{ gap: 6 }}>
              <div className="seg">
                <button className={zoom === 0.75 ? "on" : ""} onClick={() => setZoom(0.75)}>75%</button>
                <button className={zoom === 1 ? "on" : ""} onClick={() => setZoom(1)}>100%</button>
                <button className={zoom === 1.25 ? "on" : ""} onClick={() => setZoom(1.25)}>125%</button>
              </div>
              <button className="btn btn-sm" onClick={() => {
                if (!active) { pushToast("ยังไม่ได้เลือกฉลาก"); return; }
                const copy = {
                  ...active,
                  id: "LBL-COPY-" + Date.now(),
                  soId: active.soId + " (สำเนา)",
                  recipient: { ...active.recipient },
                  sender: { ...active.sender },
                  items: active.items.map(it => ({ ...it }))
                };
                setLabels(ls => [...ls, copy]);
                setSelected(s => ({ ...s, [copy.id]: true }));
                setActiveId(copy.id);
                pushToast("คัดลอกฉลากสำเร็จ");
              }}><Icons.Copy size={13}/> คัดลอกฉลาก</button>
            </div>
          </div>
          <div className="spacer"/>
          <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "right" }}>
            <div>ขนาดจริงเมื่อพิมพ์: <strong style={{ color: "var(--fg)" }}>{size.w} × {size.h} mm</strong></div>
            <div style={{ marginTop: 2 }}>{view === "batch" ? `เลือก ${selectedCount} จาก ${labels.length} ใบ` : `ฉลากที่ ${labels.findIndex(l => l.id === activeId)+1} จาก ${labels.length}`}</div>
          </div>
        </div>
      </div>

      {view === "editor" ? (
        labels.length === 0 ? (
          <div className="card no-print" style={{ padding: 60, textAlign: "center", color: "var(--muted)" }}>
            <Icons.Tag size={32} style={{ opacity: 0.3, marginBottom: 12 }}/>
            <div style={{ fontSize: 15, fontWeight: 500, color: "var(--fg)" }}>คิวฉลากว่าง</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>กดปุ่ม "สร้างฉลากใหม่" ด้านบน หรือไปที่หน้า "จัดส่งสินค้า" แล้วเลือกออร์เดอร์เพื่อสร้างฉลาก</div>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => {
              const blank = makeBlankLabel(labels);
              setLabels([blank]);
              setSelected({ [blank.id]: true });
              setActiveId(blank.id);
            }}>
              <Icons.Plus size={14}/> สร้างฉลากใหม่
            </button>
          </div>
        ) : (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr 380px", gap: 20 }}>
          {/* Sidebar: label queue */}
          <div className="card card-tight no-print">
            <div className="card-head">
              <div>
                <h3 style={{ whiteSpace: "nowrap" }}>คิวฉลาก</h3>
                <div className="sub">{labels.length} ใบ</div>
              </div>
              <div className="row" style={{ gap: 4 }}>
                {labels.length > 0 && (
                  <button
                    className="btn btn-ghost btn-sm"
                    title="ล้างคิวทั้งหมด"
                    onClick={() => {
                      if (!confirm(`ลบฉลากทั้งหมด ${labels.length} ใบออกจากคิว?`)) return;
                      setLabels([]);
                      pushToast(`ล้างคิว ${labels.length} ฉลากแล้ว`);
                    }}
                    style={{ color: "var(--danger)" }}
                  >
                    <Icons.Trash size={13}/>
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" title="เพิ่มฉลากใหม่" onClick={() => {
                  const blank = makeBlankLabel(labels);
                  setLabels(ls => [...ls, blank]);
                  setSelected(s => ({ ...s, [blank.id]: true }));
                  setActiveId(blank.id);
                }}><Icons.Plus size={13}/></button>
              </div>
            </div>
            <div className="stack" style={{ gap: 0, padding: "6px 0" }}>
              {labels.map(l => {
                const isActive = l.id === activeId;
                return (
                  <div
                    key={l.id}
                    onClick={() => setActiveId(l.id)}
                    className="queue-row"
                    style={{
                      padding: "10px 16px",
                      borderLeft: "3px solid " + (isActive ? "var(--accent)" : "transparent"),
                      background: isActive ? "var(--accent-soft)" : "transparent",
                      cursor: "pointer",
                      position: "relative"
                    }}
                  >
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span className="mono" style={{ fontSize: 12, color: "var(--fg)", fontWeight: 500 }}>{l.soId}</span>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>{l.carrier.split(" ")[0]}</span>
                    </div>
                    <div style={{ fontSize: 13, marginTop: 4, paddingRight: 22 }}>{l.recipient.name}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {l.items.length} รายการ · {l.weight}
                    </div>
                    <button
                      className="queue-del"
                      title="ลบออกจากคิว"
                      onClick={(e) => {
                        e.stopPropagation();
                        const remaining = labels.filter(x => x.id !== l.id);
                        setLabels(remaining);
                        setSelected(s => { const n = { ...s }; delete n[l.id]; return n; });
                        if (isActive && remaining.length > 0) setActiveId(remaining[0].id);
                        pushToast(`ลบฉลาก ${l.soId} ออกจากคิว`);
                      }}
                    >
                      <Icons.X size={11}/>
                    </button>
                  </div>
                );
              })}
              {labels.length === 0 && (
                <div style={{ padding: "28px 16px", textAlign: "center", color: "var(--muted)", fontSize: 12 }}>
                  <Icons.Tag size={20} style={{ opacity: 0.4, marginBottom: 6 }}/>
                  <div>คิวฉลากว่าง</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>กดปุ่ม "สร้างฉลากใหม่" เพื่อเริ่ม</div>
                </div>
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="label-stage no-print-stage">
            <div style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}>
              <LabelPaper label={active} size={size} store={store}/>
            </div>
          </div>

          {/* Edit form */}
          <div className="card no-print" style={{ padding: 0 }}>
            <div className="card-head">
              <div>
                <h3>แก้ไขฉลาก</h3>
                <div className="sub mono">{active.soId}{isDirty && <span style={{ color: "var(--warning)", marginLeft: 6 }}>· ยังไม่ได้บันทึก</span>}</div>
              </div>
              <button
                className={"btn btn-sm " + (isDirty && validation.ok ? "btn-primary" : "")}
                onClick={requestSave}
                disabled={!isDirty}
                style={!isDirty ? { opacity: 0.5, cursor: "not-allowed" } : {}}
                title={validation.ok ? "บันทึกการเปลี่ยนแปลง" : validation.reason}
              >
                <Icons.Check size={13}/> บันทึก
              </button>
            </div>
            <div style={{ padding: 18, overflow: "auto", maxHeight: 720 }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>ผู้รับ</div>
              <div className="stack" style={{ gap: 8 }}>
                <Field label="ชื่อ-นามสกุล" value={active.recipient.name} onChange={v => updateActive(l => ({ ...l, recipient: { ...l.recipient, name: v } }))}/>
                <Field label="ที่อยู่ (บรรทัด 1)" value={active.recipient.addr1} onChange={v => updateActive(l => ({ ...l, recipient: { ...l.recipient, addr1: v } }))}/>
                <Field label="ที่อยู่ (บรรทัด 2)" value={active.recipient.addr2} onChange={v => updateActive(l => ({ ...l, recipient: { ...l.recipient, addr2: v } }))}/>
                <Field label="โทรศัพท์" value={active.recipient.phone} onChange={v => updateActive(l => ({ ...l, recipient: { ...l.recipient, phone: v } }))}/>
              </div>

              <div className="divider"/>
              <div className="eyebrow" style={{ marginBottom: 10 }}>ผู้ส่ง</div>
              <div className="stack" style={{ gap: 8 }}>
                <Field label="ชื่อ / บริษัท" value={active.sender.name} onChange={v => updateActive(l => ({ ...l, sender: { ...l.sender, name: v } }))}/>
                <Field label="ที่อยู่ (บรรทัด 1)" value={active.sender.addr1} onChange={v => updateActive(l => ({ ...l, sender: { ...l.sender, addr1: v } }))}/>
                <Field label="ที่อยู่ (บรรทัด 2)" value={active.sender.addr2} onChange={v => updateActive(l => ({ ...l, sender: { ...l.sender, addr2: v } }))}/>
                <Field label="โทรศัพท์" value={active.sender.phone} onChange={v => updateActive(l => ({ ...l, sender: { ...l.sender, phone: v } }))}/>
              </div>

              <div className="divider"/>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
                <div className="eyebrow">รายการสินค้า {showErrors && active.items.some(it => !it.sku) && <span style={{ color: "var(--danger)", marginLeft: 6 }}>· ต้องเลือกสินค้าทุกรายการ</span>}</div>
                <ItemAddPicker
                  onAddProduct={(p) => updateActive(l => ({ ...l, items: [...l.items, { sku: p.sku, name: p.name, qty: 1 }] }))}
                  onAddBundle={(b) => {
                    const expanded = b.items.map(it => {
                      const p = PRODUCTS.find(x => x.sku === it.sku);
                      return { sku: it.sku, name: p ? p.name : it.sku, qty: it.qty, fromBundle: b.name };
                    });
                    updateActive(l => ({ ...l, items: [...l.items, ...expanded] }));
                    pushToast(`เพิ่มชุด "${b.name}" — ${expanded.length} รายการ`);
                  }}
                />
              </div>
              <div className="stack" style={{ gap: 10 }}>
                {active.items.map((it, i) => {
                  const invalid = showErrors && (!it.sku || it.qty <= 0);
                  return (
                    <div key={i} style={{ padding: 10, background: "var(--surface-2)", borderRadius: 8, border: "1px solid " + (invalid ? "var(--danger)" : "var(--border)") }}>
                      {it.fromBundle && (
                        <div style={{ marginBottom: 6 }}>
                          <span className="badge badge-info" style={{ fontSize: 10 }}>
                            <Icons.Bundle size={10}/> จากชุด: {it.fromBundle}
                          </span>
                        </div>
                      )}
                      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8, gap: 6 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <SkuPicker
                            value={it.sku || PRODUCTS[0].sku}
                            onChange={(sku) => {
                              const p = PRODUCTS.find(x => x.sku === sku);
                              updateActive(l => ({ ...l, items: l.items.map((x, j) => j === i ? { ...x, sku, name: p ? p.name : x.name } : x) }));
                            }}
                            products={PRODUCTS}
                          />
                          {!it.sku && (
                            <div style={{ fontSize: 11, color: showErrors ? "var(--danger)" : "var(--muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                              <Icons.Warn size={11}/> ยังไม่ได้เลือกสินค้า
                            </div>
                          )}
                        </div>
                        <button className="btn btn-ghost btn-icon" onClick={() => updateActive(l => ({ ...l, items: l.items.filter((_, j) => j !== i) }))} title="ลบรายการ"><Icons.Trash size={13}/></button>
                      </div>
                      <input
                        className="input"
                        style={{ marginBottom: 6, fontSize: 12 }}
                        value={it.name}
                        onChange={e => updateActive(l => ({ ...l, items: l.items.map((x, j) => j === i ? { ...x, name: e.target.value } : x) }))}
                        placeholder="คำอธิบายที่แสดงบนฉลาก (แก้ไขได้)"
                      />
                      <div className="row" style={{ gap: 8 }}>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>จำนวน</span>
                        <div className="qty-stepper">
                          <button onClick={() => updateActive(l => ({ ...l, items: l.items.map((x, j) => j === i ? { ...x, qty: Math.max(0, x.qty - 1) } : x) }))} disabled={it.qty <= 0}>−</button>
                          <input value={it.qty} onChange={e => updateActive(l => ({ ...l, items: l.items.map((x, j) => j === i ? { ...x, qty: parseInt(e.target.value) || 0 } : x) }))}/>
                          <button onClick={() => updateActive(l => ({ ...l, items: l.items.map((x, j) => j === i ? { ...x, qty: x.qty + 1 } : x) }))}>+</button>
                        </div>
                        {it.sku && <span className="mono" style={{ fontSize: 10, color: "var(--muted)", marginLeft: "auto" }}>{it.sku}</span>}
                      </div>
                    </div>
                  );
                })}
                {active.items.length === 0 && (
                  <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: "var(--muted)", border: "1px dashed var(--border)", borderRadius: 8 }}>
                    ยังไม่มีรายการสินค้า · กด "เพิ่ม" ด้านบน
                  </div>
                )}
              </div>

              <div className="divider"/>
              <div className="eyebrow" style={{ marginBottom: 10 }}>ขนส่ง</div>
              <div className="grid-2">
                <Field label="ผู้ให้บริการ" value={active.carrier} onChange={v => updateActive(l => ({ ...l, carrier: v }))}/>
                <Field label="เลขพัสดุ" value={active.tracking} onChange={v => updateActive(l => ({ ...l, tracking: v }))} mono/>
                <Field label="น้ำหนัก" value={active.weight} onChange={v => updateActive(l => ({ ...l, weight: v }))}/>
                <Field label="COD (บาท)" value={String(active.cod)} onChange={v => updateActive(l => ({ ...l, cod: parseInt(v) || 0 }))} num/>
              </div>
            </div>
          </div>
        </div>
        )
      ) : (
        <BatchView labels={labels} selected={selected} setSelected={setSelected} size={size} zoom={zoom} store={store} onExportPDF={printNow} pdfLoading={pdfLoading}/>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="ยืนยันการบันทึกฉลาก"
        description={active ? `ฉลาก ${active.soId} จะถูกบันทึกในระบบและประวัติการแก้ไข` : ""}
        changes={active ? [
          { label: "ผู้รับ", to: active.recipient.name },
          { label: "ขนส่ง", to: active.carrier },
          { label: "เลขพัสดุ", to: active.tracking || "—" },
          { label: "รายการสินค้า", to: `${active.items.length} SKU · ${active.items.reduce((s,x)=>s+x.qty,0)} ชิ้น` }
        ] : []}
        action="บันทึก"
        onConfirm={doSave}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

/* Unified picker — search & select single products OR product bundles for a label */
function ItemAddPicker({ onAddProduct, onAddBundle }) {
  const [open, setOpen] = useStateLB(false);
  const [q, setQ] = useStateLB("");
  const wrapRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const bundles = useMemoLB(() => (typeof loadBundles === "function" ? loadBundles() : []), [open]);

  useEffectLB(() => {
    if (!open) return;
    const onClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    setTimeout(() => inputRef.current && inputRef.current.focus(), 50);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const ql = q.trim().toLowerCase();
  const prodMatches = PRODUCTS.filter(p =>
    !ql || p.sku.toLowerCase().includes(ql) || p.name.toLowerCase().includes(ql) || p.cat.toLowerCase().includes(ql)
  );
  const bundleMatches = bundles.filter(b =>
    !ql || b.name.toLowerCase().includes(ql) || (b.desc || "").toLowerCase().includes(ql) ||
    b.items.some(it => it.sku.toLowerCase().includes(ql))
  );

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(o => !o)}>
        <Icons.Plus size={12}/> เพิ่มสินค้า / ชุด
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          width: 340, background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 14, boxShadow: "var(--shadow-lg)", zIndex: 200,
          maxHeight: 380, display: "flex", flexDirection: "column", overflow: "hidden",
          animation: "modalin 0.14s cubic-bezier(0.2, 0.8, 0.3, 1)"
        }}>
          <div style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
            <div className="search" style={{ width: "100%" }}>
              <Icons.Search size={14}/>
              <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาสินค้าเดี่ยว หรือ ชุดสินค้า"/>
              {q && <span style={{ cursor: "pointer", color: "var(--muted)" }} onClick={() => setQ("")}><Icons.X size={12}/></span>}
            </div>
          </div>
          <div style={{ overflow: "auto", flex: 1 }}>
            {bundleMatches.length > 0 && (
              <>
                <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>ชุดสินค้า</div>
                {bundleMatches.map(b => {
                  const avail = typeof bundleAvail === "function" ? bundleAvail(b) : 0;
                  return (
                    <div key={b.id} onClick={() => { onAddBundle(b); setOpen(false); }}
                      style={{ padding: "9px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--border)" }}>
                      <span style={{ width: 26, height: 26, borderRadius: 7, background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                        <Icons.Bundle size={14}/>
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>{b.items.length} รายการในชุด</div>
                      </div>
                      <span className={"badge " + (avail > 0 ? "badge-success" : "badge-danger")} style={{ fontSize: 9, flexShrink: 0 }}>
                        <span className="dot"/>{avail > 0 ? "ขายได้ " + avail : "หมด"}
                      </span>
                    </div>
                  );
                })}
              </>
            )}
            <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>สินค้าเดี่ยว</div>
            {prodMatches.map(p => (
              <div key={p.sku} onClick={() => { onAddProduct(p); setOpen(false); }}
                style={{ padding: "9px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--border)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{p.sku} · {p.cat}</div>
                </div>
                <span className="tnum" style={{ fontSize: 12, color: "var(--muted)", flexShrink: 0 }}>คงเหลือ {p.qty}</span>
              </div>
            ))}
            {prodMatches.length === 0 && bundleMatches.length === 0 && (
              <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 12 }}>ไม่พบสินค้าหรือชุดที่ตรงกับ "{q}"</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, mono, num }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        className="input"
        style={mono ? { fontFamily: "IBM Plex Mono, monospace", fontSize: 12 } : num ? { textAlign: "right" } : {}}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

/* ===== Label paper (the actual printed thing) — minimal modern, no barcode/QR ===== */
function LabelPaper({ label, size, store }) {
  const wPx = size.w * MM_TO_PX;
  const hPx = size.h * MM_TO_PX;

  // For very small sizes, condense the layout
  const compact = size.w * size.h < 100 * 130;
  const s = store || DEFAULT_STORE;

  return (
    <div
      className="label-paper"
      style={{
        width: wPx,
        height: hPx,
        padding: compact ? "11px 13px" : "15px 17px",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        fontSize: compact ? 9 : 10
      }}
    >
      {/* Header: store logo + name on left, carrier + SO on right */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1.5px solid #111", paddingBottom: compact ? 7 : 9, gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: compact ? 8 : 10, minWidth: 0 }}>
          <StoreLogoMark store={s} size={compact ? 32 : 40} forLabel/>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: compact ? 11 : 13, fontWeight: 700, color: "#111", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
            <div style={{ fontSize: compact ? 7 : 8, color: "#666", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.tagline}</div>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: compact ? 6.5 : 7.5, color: "#666", letterSpacing: "0.1em", textTransform: "uppercase" }}>Shipping Label</div>
          <div className="mono" style={{ fontSize: compact ? 9 : 10.5, fontWeight: 600, marginTop: 1, color: "#111" }}>{label.soId}</div>
          <div style={{ fontSize: compact ? 7 : 8, color: "#666", marginTop: 2, fontWeight: 500 }}>{label.carrier}</div>
        </div>
      </div>

      {/* Sender */}
      <div style={{ padding: compact ? "7px 0 5px" : "9px 0 7px", borderBottom: "1px dashed #d0d0d0" }}>
        <div style={{ fontSize: compact ? 6.5 : 7.5, color: "#666", letterSpacing: "0.12em", textTransform: "uppercase" }}>From · ผู้ส่ง</div>
        <div style={{ fontSize: compact ? 8.5 : 9.5, marginTop: 3, lineHeight: 1.4 }}>
          <div style={{ fontWeight: 600 }}>{label.sender.name}</div>
          <div>{label.sender.addr1}</div>
          <div>{label.sender.addr2}</div>
          <div className="mono" style={{ marginTop: 1 }}>โทร. {label.sender.phone}</div>
        </div>
      </div>

      {/* Recipient — most prominent */}
      <div style={{ padding: compact ? "8px 0" : "11px 0", borderBottom: "1.5px solid #111" }}>
        <div style={{ fontSize: compact ? 6.5 : 7.5, color: "#666", letterSpacing: "0.12em", textTransform: "uppercase" }}>To · ผู้รับ</div>
        <div style={{ marginTop: 5, lineHeight: 1.4 }}>
          <div style={{ fontSize: compact ? 13 : 16, fontWeight: 700, letterSpacing: "-0.01em" }}>{label.recipient.name}</div>
          <div style={{ fontSize: compact ? 9.5 : 11, marginTop: 4 }}>{label.recipient.addr1}</div>
          <div style={{ fontSize: compact ? 9.5 : 11 }}>{label.recipient.addr2}</div>
          <div className="mono" style={{ fontSize: compact ? 9.5 : 11, marginTop: 4, fontWeight: 600 }}>โทร. {label.recipient.phone}</div>
        </div>
      </div>

      {/* Items list */}
      <div style={{ padding: compact ? "7px 0" : "9px 0", flex: 1, overflow: "hidden", borderBottom: "1px dashed #d0d0d0" }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: compact ? 6.5 : 7.5, color: "#666", letterSpacing: "0.12em", textTransform: "uppercase" }}>Items · รายการ ({label.items.reduce((s,i)=>s+i.qty,0)})</span>
          <span style={{ fontSize: compact ? 7.5 : 8.5, color: "#666", fontWeight: 500 }}>น้ำหนัก {label.weight}</span>
        </div>
        <div style={{ fontSize: compact ? 8.5 : 10, lineHeight: 1.45 }}>
          {label.items.slice(0, compact ? 4 : 6).map((it, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "2px 0" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {it.sku && <span className="mono" style={{ fontSize: compact ? 7 : 8, color: "#888", marginRight: 6 }}>{it.sku}</span>}
                {it.name}
              </span>
              <span className="mono" style={{ flexShrink: 0, fontWeight: 600 }}>× {it.qty}</span>
            </div>
          ))}
          {label.items.length > (compact ? 4 : 6) && (
            <div style={{ fontSize: compact ? 7.5 : 8.5, color: "#666", marginTop: 3, fontStyle: "italic" }}>… และอีก {label.items.length - (compact ? 4 : 6)} รายการ</div>
          )}
        </div>
      </div>

      {/* Footer: tracking number + payment */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingTop: compact ? 7 : 9, gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: compact ? 6.5 : 7.5, color: "#666", letterSpacing: "0.12em", textTransform: "uppercase" }}>Tracking · เลขพัสดุ</div>
          <div className="mono" style={{ fontSize: compact ? 12 : 15, fontWeight: 700, marginTop: 2, letterSpacing: "0.04em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label.tracking}</div>
        </div>
        <div style={{ flexShrink: 0 }}>
          {label.cod > 0 ? (
            <div style={{ background: "#111", color: "white", padding: compact ? "5px 9px" : "6px 12px", fontSize: compact ? 10 : 12, fontWeight: 700, letterSpacing: "0.06em", borderRadius: 2 }}>
              COD ฿{label.cod.toLocaleString()}
            </div>
          ) : (
            <div style={{ border: "1.5px solid #111", padding: compact ? "4px 8px" : "5px 10px", fontSize: compact ? 9 : 10.5, fontWeight: 700, letterSpacing: "0.08em" }}>
              PAID · ชำระแล้ว
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===== Batch view ===== */
function BatchView({ labels, selected, setSelected, size, zoom, store, onExportPDF, pdfLoading }) {
  const sel = labels.filter(l => selected[l.id]);
  return (
    <div className="stack" style={{ gap: 16 }}>
      {/* selection bar */}
      <div className="card no-print" style={{ padding: 12 }}>
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <button className="btn btn-sm" onClick={() => setSelected(Object.fromEntries(labels.map(l => [l.id, true])))}>เลือกทั้งหมด</button>
          <button className="btn btn-sm" onClick={() => setSelected({})}>ล้างการเลือก</button>
          <div className="spacer"/>
          {labels.map(l => (
            <label key={l.id} className="row" style={{ gap: 6, fontSize: 12, cursor: "pointer", padding: "4px 8px", background: "var(--surface-2)", borderRadius: 6 }}>
              <span
                className={"check" + (selected[l.id] ? " on" : "")}
                onClick={() => setSelected(s => ({ ...s, [l.id]: !s[l.id] }))}
              />
              <span className="mono">{l.soId}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="label-stage no-print-stage" style={{ alignItems: "flex-start", padding: 20 }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fill, minmax(${size.w * MM_TO_PX * zoom + 24}px, 1fr))`,
          gap: 20,
          width: "100%",
          justifyItems: "center"
        }}>
          {sel.map(l => (
            <div key={l.id} className="batch-card">
              <div style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}>
                <LabelPaper label={l} size={size} store={store}/>
              </div>
              <div className="row no-print" style={{ marginTop: 8, fontSize: 11, color: "var(--muted)", justifyContent: "center", gap: 6 }}>
                <span className="mono">{l.soId}</span>
                <span>·</span>
                <span>{l.carrier.split(" ")[0]}</span>
              </div>
            </div>
          ))}
          {sel.length === 0 && (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 60, color: "var(--muted)" }}>
              เลือกฉลากด้านบนเพื่อเพิ่มเข้าชุดพิมพ์
            </div>
          )}
        </div>
      </div>

      {sel.length > 0 && (
        <div className="card no-print" style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 13 }}>
            พร้อมพิมพ์ <strong className="tnum">{sel.length}</strong> ใบ · ขนาด {size.label} · กระดาษโดยประมาณ {sel.length} แผ่น
          </div>
          <div className="row">
            <button className="btn btn-primary" onClick={onExportPDF} disabled={pdfLoading} style={pdfLoading ? { opacity: 0.75, cursor: "wait" } : {}}>
              <Icons.Print size={14}/> {pdfLoading ? "กำลังสร้าง…" : "ส่งออก PDF (ชุด)"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { Labels, LabelPaper });
