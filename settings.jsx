/* Store settings: logo upload, store info */

const { useState: useStateSet, useRef: useRefSet } = React;

function StoreSettings({ store, setStore, pushToast }) {
  const fileRef = useRefSet(null);
  const [drag, setDrag] = useStateSet(false);

  const readFile = (f) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { pushToast("กรุณาเลือกไฟล์รูปภาพ"); return; }
    if (f.size > 2 * 1024 * 1024) { pushToast("ไฟล์ใหญ่เกิน 2 MB"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setStore(s => ({ ...s, logo: reader.result }));
      pushToast("อัปโหลดโลโก้แล้ว");
    };
    reader.readAsDataURL(f);
  };

  const update = (key, value) => setStore(s => ({ ...s, [key]: value }));
  const updateSender = (key, value) => setStore(s => ({ ...s, sender: { ...s.sender, [key]: value } }));

  return (
    <div className="stack" style={{ gap: 24, maxWidth: 1100 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">ตั้งค่าร้านค้า</h1>
          <div className="page-sub">โลโก้ ชื่อร้าน และข้อมูลผู้ส่งเริ่มต้นสำหรับฉลากจัดส่งทุกใบ</div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setStore(DEFAULT_STORE)}>คืนค่าเริ่มต้น</button>
          <button className="btn btn-primary" onClick={() => pushToast("บันทึกการตั้งค่าแล้ว")}><Icons.Check size={14}/> บันทึก</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 20 }}>
        {/* Logo upload */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>โลโก้ร้านค้า</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, marginBottom: 18 }}>
            ใช้แสดงบนแถบนำทาง และเป็นหัวฉลากจัดส่งทุกใบ แนะนำรูปสี่เหลี่ยมจัตุรัส PNG / SVG พื้นหลังโปร่งใส
          </div>

          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); readFile(e.dataTransfer.files?.[0]); }}
            style={{
              border: "1.5px dashed " + (drag ? "var(--accent)" : "var(--border-strong)"),
              background: drag ? "var(--accent-soft)" : "var(--surface-2)",
              borderRadius: 14,
              padding: 28,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              cursor: "pointer",
              transition: "border-color 0.15s, background 0.15s"
            }}
          >
            {store.logo ? (
              <div style={{ display: "flex", alignItems: "center", gap: 20, width: "100%" }}>
                <div style={{
                  width: 96, height: 96,
                  borderRadius: 16,
                  background: "white",
                  border: "1px solid var(--border)",
                  display: "grid", placeItems: "center",
                  padding: 10,
                  flexShrink: 0
                }}>
                  <img src={store.logo} alt="logo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}/>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>โลโก้พร้อมใช้งาน</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>คลิกหรือลากไฟล์มาวางเพื่อเปลี่ยน</div>
                  <div className="row" style={{ marginTop: 10, gap: 6 }}>
                    <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}><Icons.Refresh size={12}/> เปลี่ยนรูป</button>
                    <button className="btn btn-sm btn-danger" onClick={(e) => { e.stopPropagation(); update("logo", null); pushToast("ลบโลโก้แล้ว"); }}><Icons.Trash size={12}/> ลบ</button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)", display: "grid", placeItems: "center", color: "var(--muted)" }}>
                  <Icons.Plus size={22}/>
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, marginTop: 14 }}>คลิกเพื่ออัปโหลด หรือลากไฟล์มาวาง</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>PNG · JPG · SVG · ขนาดไม่เกิน 2 MB</div>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={(e) => readFile(e.target.files?.[0])} style={{ display: "none" }}/>

          <div style={{ marginTop: 18 }}>
            <SField label="ชื่อร้าน (แสดงคู่กับโลโก้)" value={store.name} onChange={(v) => update("name", v)}/>
            <SField label="คำอธิบายสั้น (อยู่ใต้ชื่อร้าน)" value={store.tagline} onChange={(v) => update("tagline", v)}/>
          </div>
        </div>

        {/* Sender info */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>ข้อมูลผู้ส่ง</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, marginBottom: 18 }}>
            ใช้เป็นข้อมูลผู้ส่งเริ่มต้นเมื่อสร้างฉลากใหม่ (แก้ไขทีละใบได้บนหน้าพิมพ์ฉลาก)
          </div>
          <div className="stack" style={{ gap: 10 }}>
            <SField label="ชื่อ / บริษัท" value={store.sender.name} onChange={(v) => updateSender("name", v)}/>
            <SField label="ที่อยู่ บรรทัด 1" value={store.sender.addr1} onChange={(v) => updateSender("addr1", v)}/>
            <SField label="ที่อยู่ บรรทัด 2" value={store.sender.addr2} onChange={(v) => updateSender("addr2", v)}/>
            <SField label="โทรศัพท์" value={store.sender.phone} onChange={(v) => updateSender("phone", v)}/>
          </div>
        </div>
      </div>

      {/* Live previews */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>ตัวอย่างการแสดงผล</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, marginBottom: 18 }}>โลโก้และข้อมูลร้านจะปรากฏในตำแหน่งเหล่านี้</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>บนแถบนำทาง</div>
            <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 18, background: "var(--surface-2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <StoreLogoMark store={store} size={36}/>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{store.name}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{store.tagline}</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>หัวฉลากจัดส่ง</div>
            <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 18, background: "var(--surface-2)" }}>
              <div style={{ background: "white", padding: 14, border: "1px solid #111" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 8, borderBottom: "1px solid #111" }}>
                  <StoreLogoMark store={store} size={40} forLabel/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{store.name}</div>
                    <div style={{ fontSize: 9, color: "#666", marginTop: 1 }}>{store.tagline}</div>
                  </div>
                  <div style={{ fontSize: 9, color: "#666", textAlign: "right" }}>
                    <div>ฉลากจัดส่ง</div>
                    <div className="mono" style={{ fontWeight: 600, color: "#111" }}>SO-XXXXXXXX</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SField({ label, value, onChange }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)}/>
    </div>
  );
}

/* Shared brand-mark component — works for both sidebar and label */
function StoreLogoMark({ store, size = 32, forLabel = false }) {
  if (store.logo) {
    return (
      <div style={{
        width: size, height: size,
        borderRadius: forLabel ? 4 : 8,
        background: "white",
        border: forLabel ? "1px solid #ddd" : "1px solid var(--border)",
        display: "grid", placeItems: "center",
        padding: 3,
        flexShrink: 0,
        overflow: "hidden"
      }}>
        <img src={store.logo} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}/>
      </div>
    );
  }
  // fallback: first letter of store name
  const ch = (store.name || "?").trim()[0] || "?";
  return (
    <div style={{
      width: size, height: size,
      borderRadius: forLabel ? 4 : 8,
      background: forLabel ? "#111" : "var(--fg)",
      color: forLabel ? "white" : "var(--bg)",
      display: "grid", placeItems: "center",
      fontWeight: 600,
      fontSize: size * 0.45,
      letterSpacing: "-0.02em",
      flexShrink: 0
    }}>{ch}</div>
  );
}

const DEFAULT_STORE = {
  logo: null,
  name: "คลังพร้อมส่ง",
  tagline: "Bangkok Fulfill · WMS",
  sender: {
    name: "คลังสินค้า BangkokFulfill",
    addr1: "199/4 ถ.พระราม 9 แขวงห้วยขวาง",
    addr2: "เขตห้วยขวาง กรุงเทพฯ 10310",
    phone: "02-555-0188"
  }
};

Object.assign(window, { StoreSettings, StoreLogoMark, DEFAULT_STORE });
