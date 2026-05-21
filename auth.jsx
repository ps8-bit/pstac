/* Authentication + user management + UI layout customization */

const { useState: useStateAuth, useEffect: useEffectAuth, useRef: useRefAuth } = React;

/* ============ LOGIN SCREEN ============ */

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useStateAuth("somchai@bangkokfulfill.co");
  const [password, setPassword] = useStateAuth("••••••••••");
  const [loading, setLoading] = useStateAuth(false);

  const submit = (e) => {
    e?.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setTimeout(() => {
      const user = USERS.find(u => u.email === email) || USERS[0];
      onLogin(user);
    }, 600);
  };

  const loginAs = (role) => {
    const user = USERS.find(u => u.role === role && u.active) || USERS[0];
    setEmail(user.email);
    setLoading(true);
    setTimeout(() => onLogin(user), 400);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">ค</div>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>คลังพร้อมส่ง</h1>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>ลงชื่อเข้าใช้ระบบบริหารคลังสินค้า</div>
        </div>

        <form onSubmit={submit} className="stack" style={{ gap: 14 }}>
          <div className="field">
            <label>อีเมล</label>
            <input className="input input-lg" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoFocus/>
          </div>
          <div className="field">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <label>รหัสผ่าน</label>
              <a className="lnk" style={{ fontSize: 11 }} onClick={(e) => { e.preventDefault(); alert("ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ไปทางอีเมล"); }} href="#">ลืมรหัสผ่าน?</a>
            </div>
            <input className="input input-lg" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="ใส่รหัสผ่านของคุณ"/>
          </div>

          <button type="submit" className="btn btn-accent" disabled={loading} style={{ padding: "13px 16px", fontSize: 15, justifyContent: "center", marginTop: 6 }}>
            {loading ? "กำลังเข้าสู่ระบบ…" : <>ลงชื่อเข้าใช้ <Icons.ArrowRight size={14}/></>}
          </button>
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "24px 0 18px", fontSize: 11, color: "var(--muted)" }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }}/>
          <span>ลองใช้ในฐานะตัวอย่าง</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }}/>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {ROLES.map(r => (
            <button key={r.id} className="btn btn-sm" onClick={() => loginAs(r.id)} style={{ justifyContent: "flex-start", padding: "10px 12px" }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: r.color, flexShrink: 0 }}/>
              <span style={{ fontSize: 12, fontWeight: 500 }}>{r.label}</span>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 22, fontSize: 11, color: "var(--muted)", textAlign: "center", lineHeight: 1.5 }}>
          ระบบนี้เข้ารหัสด้วย TLS 1.3 · ปฏิบัติตาม PDPA<br/>
          ต้องการบัญชีองค์กร? <a className="lnk" href="#" onClick={(e) => { e.preventDefault(); alert("ติดต่อ admin@bangkokfulfill.co"); }}>ติดต่อทีมงาน</a>
        </div>
      </div>
    </div>
  );
}

/* ============ USER MANAGEMENT PAGE ============ */

function UserManagement({ currentUser, pushToast }) {
  const [users, setUsers] = useStateAuth(USERS);
  const [inviteOpen, setInviteOpen] = useStateAuth(false);
  const [q, setQ] = useStateAuth("");
  const [roleFilter, setRoleFilter] = useStateAuth("all");
  const [openMenu, setOpenMenu] = useStateAuth(null);

  const filtered = users.filter(u => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (q && !(u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  const inviteUser = (newUser) => {
    setUsers(us => [...us, { ...newUser, id: Math.max(...us.map(u => u.id)) + 1, joined: "วันนี้", lastSeen: "ยังไม่เคยเข้าสู่ระบบ" }]);
    pushToast(`เชิญ ${newUser.email} แล้ว ส่งคำเชิญทางอีเมล`);
    setInviteOpen(false);
  };

  const updateRole = (id, role) => {
    setUsers(us => us.map(u => u.id === id ? { ...u, role } : u));
    pushToast("อัปเดตสิทธิ์การใช้งานแล้ว");
    setOpenMenu(null);
  };

  const toggleActive = (id) => {
    setUsers(us => us.map(u => u.id === id ? { ...u, active: !u.active } : u));
    setOpenMenu(null);
  };

  const removeUser = (id) => {
    if (id === currentUser.id) { pushToast("ไม่สามารถลบบัญชีของตัวเองได้"); return; }
    if (!confirm("ลบผู้ใช้งานนี้ออกจากองค์กร?")) return;
    setUsers(us => us.filter(u => u.id !== id));
    pushToast("ลบผู้ใช้งานแล้ว");
    setOpenMenu(null);
  };

  const counts = {
    total: users.length,
    active: users.filter(u => u.active).length,
    admin: users.filter(u => u.role === "admin").length
  };

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">ผู้ใช้งานและสิทธิ์</h1>
          <div className="page-sub">จัดการสมาชิกในองค์กรและกำหนดสิทธิ์การเข้าถึง</div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => { const csv = "Name,Email,Role,Status\n" + allUsers.map(u => `${u.name},${u.email},${u.role},${u.active ? "Active" : "Inactive"}`).join("\n"); const blob = new Blob([csv], {type: "text/csv"}); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "users.csv"; a.click(); URL.revokeObjectURL(url); }}><Icons.Pkg size={14}/> ส่งออกรายชื่อ</button>
          <button className="btn btn-accent" onClick={() => setInviteOpen(true)}><Icons.Plus/> เชิญสมาชิกใหม่</button>
        </div>
      </div>

      <div className="grid-3">
        <SmallStat label="สมาชิกทั้งหมด" value={counts.total} tone="info" hint={`ใช้งานอยู่ ${counts.active} คน`}/>
        <SmallStat label="ผู้ดูแลระบบ" value={counts.admin} tone="warning" hint="แนะนำให้มี admin อย่างน้อย 2 คน"/>
        <SmallStat label="คำเชิญที่รออยู่" value="0" tone="success" hint="ไม่มีคำเชิญค้าง"/>
      </div>

      <div className="card" style={{ padding: 14 }}>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <div className="search" style={{ width: 320 }}>
            <Icons.Search size={14}/>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาชื่อหรืออีเมล"/>
          </div>
          <div className="seg">
            <button className={roleFilter === "all" ? "on" : ""} onClick={() => setRoleFilter("all")}>ทุกบทบาท</button>
            {ROLES.map(r => (
              <button key={r.id} className={roleFilter === r.id ? "on" : ""} onClick={() => setRoleFilter(r.id)}>{r.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="card card-tight">
        <table className="t">
          <thead><tr>
            <th>สมาชิก</th>
            <th>บทบาท</th>
            <th>สถานะ</th>
            <th>เข้าใช้ล่าสุด</th>
            <th>เริ่มใช้งาน</th>
            <th style={{ width: 1 }}/>
          </tr></thead>
          <tbody>
            {filtered.map(u => {
              const r = ROLES.find(x => x.id === u.role);
              const isMe = u.id === currentUser.id;
              return (
                <tr key={u.id} style={{ opacity: u.active ? 1 : 0.55 }}>
                  <td>
                    <div className="row" style={{ gap: 10 }}>
                      <div className="user-avatar" style={{ background: r.color }}>{u.avatar}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                          {u.name} {isMe && <span className="badge badge-neutral" style={{ marginLeft: 6, fontSize: 9 }}>คุณ</span>}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={"badge " + r.badge} title={r.desc}>
                      <span className="dot" style={{ background: r.color }}/>{r.label}
                    </span>
                  </td>
                  <td>
                    <span className={"badge " + (u.active ? "badge-success" : "badge-neutral")}>
                      <span className="dot"/>{u.active ? "ใช้งานอยู่" : "ระงับ"}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--muted)" }}>{u.lastSeen}</td>
                  <td style={{ fontSize: 12, color: "var(--muted)" }}>{u.joined}</td>
                  <td style={{ position: "relative" }}>
                    <button className="btn btn-ghost btn-icon" onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === u.id ? null : u.id); }}>
                      <span style={{ fontSize: 16, lineHeight: 0.5 }}>···</span>
                    </button>
                    {openMenu === u.id && (
                      <UserMenu user={u} onChangeRole={(r) => updateRole(u.id, r)} onToggleActive={() => toggleActive(u.id)} onRemove={() => removeUser(u.id)} onClose={() => setOpenMenu(null)}/>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan="6" style={{ textAlign: "center", padding: 48, color: "var(--muted)", fontSize: 13 }}>
                ไม่พบผู้ใช้งาน
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Role reference */}
      <div className="card">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>คำอธิบายสิทธิ์การใช้งาน</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {ROLES.map(r => (
            <div key={r.id} style={{ padding: 14, background: "var(--surface-2)", borderRadius: 12, border: "1px solid var(--border)" }}>
              <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: r.color }}/>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{r.label}</div>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>{r.desc}</div>
              <div style={{ fontSize: 11, color: "var(--fg-2)", marginTop: 8 }}>
                เข้าถึง: {ROLE_NAV[r.id].length} หน้า
              </div>
            </div>
          ))}
        </div>
      </div>

      {inviteOpen && <InviteUserModal onClose={() => setInviteOpen(false)} onSubmit={inviteUser}/>}
    </div>
  );
}

function UserMenu({ user, onChangeRole, onToggleActive, onRemove, onClose }) {
  const ref = useRefAuth(null);
  useEffectAuth(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);
  return (
    <div ref={ref} style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "var(--shadow-lg)", padding: 6, zIndex: 30, minWidth: 220, animation: "modalin 0.14s ease-out" }}>
      <div style={{ fontSize: 11, color: "var(--muted)", padding: "6px 10px 4px", fontWeight: 500 }}>เปลี่ยนบทบาท</div>
      {ROLES.map(r => (
        <button key={r.id} className="popover-item" onClick={() => onChangeRole(r.id)}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: r.color }}/>
          <span style={{ flex: 1 }}>{r.label}</span>
          {user.role === r.id && <Icons.Check size={12} style={{ color: "var(--accent)" }}/>}
        </button>
      ))}
      <div className="popover-divider"/>
      <button className="popover-item" onClick={onToggleActive}>
        <Icons.Refresh size={13}/> {user.active ? "ระงับการใช้งาน" : "เปิดใช้งาน"}
      </button>
      <button className="popover-item danger" onClick={onRemove}>
        <Icons.Trash size={13}/> ลบสมาชิก
      </button>
    </div>
  );
}

function InviteUserModal({ onClose, onSubmit }) {
  const [name, setName] = useStateAuth("");
  const [email, setEmail] = useStateAuth("");
  const [role, setRole] = useStateAuth("staff");
  const valid = name && email.includes("@");

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose}/>
      <div className="modal">
        <div className="modal-head">
          <div>
            <h3>เชิญสมาชิกใหม่</h3>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>ส่งคำเชิญทางอีเมลให้สมาชิกใหม่เข้าร่วม</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><Icons.X/></button>
        </div>
        <div className="modal-body">
          <div className="stack" style={{ gap: 14 }}>
            <div className="field">
              <label>ชื่อ-นามสกุล</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="เช่น สมศักดิ์ ใจดี" autoFocus/>
            </div>
            <div className="field">
              <label>อีเมล</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="somsak@example.com"/>
              <span className="hint">ระบบจะส่งลิงก์ตั้งรหัสผ่านไปยังอีเมลนี้</span>
            </div>
            <div className="field">
              <label>บทบาท</label>
              <div className="stack" style={{ gap: 6 }}>
                {ROLES.map(r => (
                  <div key={r.id}
                    onClick={() => setRole(r.id)}
                    style={{
                      padding: 12,
                      background: role === r.id ? "var(--accent-soft)" : "var(--surface-2)",
                      border: "1px solid " + (role === r.id ? "var(--accent)" : "var(--border)"),
                      borderRadius: 10,
                      cursor: "pointer"
                    }}
                  >
                    <div className="row" style={{ gap: 10 }}>
                      <span className={"check" + (role === r.id ? " on" : "")}/>
                      <span style={{ width: 10, height: 10, borderRadius: 999, background: r.color }}/>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{r.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, marginLeft: 42 }}>{r.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary" disabled={!valid} onClick={() => onSubmit({ name, email, role, active: true, avatar: name.slice(0, 2) })} style={!valid ? { opacity: 0.5, cursor: "not-allowed" } : {}}>
            <Icons.ArrowRight size={14}/> ส่งคำเชิญ
          </button>
        </div>
      </div>
    </>
  );
}

/* ============ LAYOUT CUSTOMIZE PAGE ============ */

function LayoutCustomize({ navItems, setNavItems, pushToast, allNavItems }) {
  const [dragId, setDragId] = useStateAuth(null);
  const [hoverId, setHoverId] = useStateAuth(null);

  const onDragOver = (id) => { if (dragId && dragId !== id) setHoverId(id); };
  const onDrop = (targetId) => {
    if (!dragId || dragId === targetId) { setDragId(null); setHoverId(null); return; }
    setNavItems(items => {
      const next = [...items];
      const fromIdx = next.findIndex(i => i.id === dragId);
      const toIdx = next.findIndex(i => i.id === targetId);
      const [moved] = next.splice(fromIdx, 1);
      const adj = fromIdx < toIdx ? toIdx - 1 : toIdx;
      next.splice(adj + 1, 0, moved);
      return next;
    });
    setDragId(null);
    setHoverId(null);
  };

  const toggle = (id) => setNavItems(items => items.map(i => i.id === id ? { ...i, visible: !i.visible } : i));
  const reset = () => {
    if (!confirm("คืนค่าการจัดเรียงเมนูเป็นค่าเริ่มต้น?")) return;
    setNavItems(allNavItems.map(n => ({ id: n.id, visible: true })));
    pushToast("คืนค่าเริ่มต้นแล้ว");
  };

  const visible = navItems.filter(i => i.visible).length;

  return (
    <div className="stack" style={{ gap: 24, maxWidth: 900 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">ปรับแต่งเลย์เอาต์</h1>
          <div className="page-sub">เลือกว่าจะให้เมนูใดปรากฏในแถบนำทาง และจัดเรียงตามที่ใช้บ่อย</div>
        </div>
        <div className="row">
          <button className="btn" onClick={reset}><Icons.Refresh size={14}/> คืนค่าเริ่มต้น</button>
          <button className="btn btn-primary" onClick={() => pushToast("บันทึกการตั้งค่าแล้ว")}><Icons.Check size={14}/> บันทึก</button>
        </div>
      </div>

      <div className="grid-2">
        <div className="card" style={{ padding: 16, display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--success-soft)", color: "var(--success)", display: "grid", placeItems: "center" }}>
            <Icons.Check size={20}/>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 600 }} className="tnum">{visible} / {navItems.length}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>เมนูที่แสดงในแถบนำทาง</div>
          </div>
        </div>
        <div className="card" style={{ padding: 16, display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--info-soft)", color: "var(--info)", display: "grid", placeItems: "center" }}>
            <Icons.Help size={20}/>
          </div>
          <div style={{ fontSize: 12, color: "var(--fg-2)", lineHeight: 1.5 }}>
            ลากที่จับด้านซ้ายเพื่อจัดลำดับ ปิดสวิตช์เพื่อซ่อนเมนู<br/>
            การเปลี่ยนแปลงจะบันทึกอัตโนมัติและใช้กับทุกอุปกรณ์
          </div>
        </div>
      </div>

      <div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>เมนูในแถบนำทาง</div>
        {navItems.map(item => {
          const def = allNavItems.find(n => n.id === item.id);
          if (!def) return null;
          const Icon = def.icon;
          return (
            <div
              key={item.id}
              className={"reorder-row" + (dragId === item.id ? " dragging" : "") + (hoverId === item.id && dragId !== item.id ? " drop-target" : "")}
              draggable={true}
              onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDragId(item.id); }}
              onDragOver={(e) => { if (dragId && dragId !== item.id) { e.preventDefault(); onDragOver(item.id); } }}
              onDragEnd={() => { setDragId(null); setHoverId(null); }}
              onDrop={(e) => { e.preventDefault(); onDrop(item.id); }}
            >
              <span className="drag-handle">
                <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
                  <circle cx="3" cy="3" r="1.4"/><circle cx="9" cy="3" r="1.4"/>
                  <circle cx="3" cy="8" r="1.4"/><circle cx="9" cy="8" r="1.4"/>
                  <circle cx="3" cy="13" r="1.4"/><circle cx="9" cy="13" r="1.4"/>
                </svg>
              </span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--surface-2)", color: "var(--fg-2)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Icon size={16}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{def.label}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>หมวด: {NAV_GROUP_LABELS[def.group] || "ทั่วไป"}</div>
              </div>
              <span className={"switch" + (item.visible ? " on" : "")} onClick={() => toggle(item.id)}/>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: "var(--warning-soft)", color: "var(--warning)", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Icons.Warn size={16}/>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>หมายเหตุเรื่องสิทธิ์</div>
            <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
              การปรับแต่งนี้กำหนดเฉพาะการแสดงผลเท่านั้น สิทธิ์การเข้าถึงจริงจะถูกควบคุมโดยบทบาทของผู้ใช้แต่ละคน — ผู้ใช้บทบาท <strong>พนักงานคลัง</strong> หรือ <strong>ดูเท่านั้น</strong> จะไม่สามารถเข้าถึงเมนูที่อยู่นอกเหนือสิทธิ์ของตน แม้จะเปิดให้แสดง
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const NAV_GROUP_LABELS = {
  main: "ภาพรวม",
  ops: "การดำเนินงาน",
  stock: "สต็อก",
  ship: "การจัดส่ง",
  system: "ระบบ"
};

Object.assign(window, { LoginScreen, UserManagement, LayoutCustomize, NAV_GROUP_LABELS });
