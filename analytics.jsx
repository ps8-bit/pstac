/* Sales analytics — revenue / cost / profit / margin per period */

const { useState: useStateAn, useMemo: useMemoAn } = React;

const PERIODS = [
  { id: "today", label: "วันนี้",    days: 1,   bars: 24, barLabel: "ชั่วโมง" },
  { id: "week",  label: "สัปดาห์นี้", days: 7,   bars: 7,  barLabel: "วัน" },
  { id: "month", label: "เดือนนี้",  days: 30,  bars: 30, barLabel: "วัน" },
  { id: "year",  label: "ปีนี้",      days: 365, bars: 12, barLabel: "เดือน" }
];

/* Deterministic fake sales series per SKU */
function generateSales(sku, bars) {
  let seed = 0;
  for (let i = 0; i < sku.length; i++) seed = (seed * 131 + sku.charCodeAt(i)) >>> 0;
  const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff; };
  const baseRate = 0.6 + rng() * 4.5;
  const series = [];
  for (let i = 0; i < bars; i++) {
    const mul = 0.35 + rng() * 1.4 + Math.sin(i * 0.4) * 0.2;
    series.push(Math.max(0, Math.floor(baseRate * mul)));
  }
  return series;
}

const fmt = (n) => Math.round(n).toLocaleString("th-TH");
const fmtMoney = (n) => "฿" + Math.round(n).toLocaleString("th-TH");

/* ============ ANALYTICS PAGE ============ */

function AnalyticsPage({ pushToast }) {
  const [period, setPeriod] = useStateAn("month");
  const [open, setOpen] = useStateAn(null);
  const def = PERIODS.find(p => p.id === period);

  const data = useMemoAn(() => {
    return PRODUCTS.map(p => {
      const series = generateSales(p.sku, def.bars);
      const units = series.reduce((s, x) => s + x, 0);
      const cost = p.cost ?? Math.round(p.price * 0.6);
      const revenue = units * p.price;
      const costTotal = units * cost;
      const profit = revenue - costTotal;
      const margin = revenue > 0 ? profit / revenue : 0;
      return { ...p, costPrice: cost, series, units, revenue, costTotal, profit, margin };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [period]);

  const total = data.reduce((acc, p) => ({
    units: acc.units + p.units,
    revenue: acc.revenue + p.revenue,
    cost: acc.cost + p.costTotal,
    profit: acc.profit + p.profit
  }), { units: 0, revenue: 0, cost: 0, profit: 0 });
  const totalMargin = total.revenue > 0 ? total.profit / total.revenue : 0;

  // Aggregated bar series across all products
  const chart = useMemoAn(() => {
    const arr = new Array(def.bars).fill(0);
    data.forEach(p => p.series.forEach((u, i) => { arr[i] += u * p.price; }));
    return arr;
  }, [data, def.bars]);
  const chartMax = Math.max(...chart, 1);

  // Periodicity comparison (vs previous period — deterministic +/- with seed offset)
  const prev = useMemoAn(() => {
    let r = 0;
    PRODUCTS.forEach(p => { r += p.price * (def.bars + (p.sku.charCodeAt(0) % 5)); });
    return Math.round(r * (def.days / 30) * 0.92);
  }, [def]);
  const revDelta = total.revenue - prev;
  const revPct = prev > 0 ? (revDelta / prev) * 100 : 0;

  const barLabels = useMemoAn(() => {
    if (period === "today") return Array.from({ length: 24 }, (_, i) => i % 6 === 0 ? `${i}:00` : "");
    if (period === "week") return ["จ","อ","พ","พฤ","ศ","ส","อา"];
    if (period === "month") return Array.from({ length: 30 }, (_, i) => i % 5 === 0 ? `${i+1}` : "");
    return ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  }, [period]);

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">วิเคราะห์ยอดขาย</h1>
          <div className="page-sub">ภาพรวมรายได้ ต้นทุน และกำไร — แยกตามช่วงเวลาและตามสินค้า</div>
        </div>
        <div className="row">
          <div className="seg">
            {PERIODS.map(p => (
              <button key={p.id} className={period === p.id ? "on" : ""} onClick={() => setPeriod(p.id)}>{p.label}</button>
            ))}
          </div>
          <button className="btn" onClick={() => { const csv = "Period,Revenue,Cost,Profit\n" + PERIODS.map(p => `${p.label},${Math.round(Math.random() * 50000)},${Math.round(Math.random() * 30000)},${Math.round(Math.random() * 20000)}`).join("\n"); const blob = new Blob([csv], {type: "text/csv"}); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "analytics.csv"; a.click(); URL.revokeObjectURL(url); }}><Icons.Pkg size={14}/> ส่งออก CSV</button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">ยอดขาย</div>
          <div className="kpi-value" style={{ marginTop: 4 }}>{fmtMoney(total.revenue)}</div>
          <div className="kpi-delta">
            <span className={revDelta >= 0 ? "up" : "down"}>{revDelta >= 0 ? "▲" : "▼"} {Math.abs(revPct).toFixed(1)}%</span>
            <span>เทียบช่วงก่อน</span>
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">ต้นทุน</div>
          <div className="kpi-value" style={{ marginTop: 4 }}>{fmtMoney(total.cost)}</div>
          <div className="kpi-delta">{((total.cost/total.revenue||0)*100).toFixed(0)}% ของยอดขาย</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">กำไรขั้นต้น</div>
          <div className="kpi-value" style={{ marginTop: 4, color: "var(--success)" }}>{fmtMoney(total.profit)}</div>
          <div className="kpi-delta"><span className="up">+{(totalMargin*100).toFixed(1)}%</span> มาร์จิ้น</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">จำนวนชิ้นที่ขาย</div>
          <div className="kpi-value" style={{ marginTop: 4 }}>{fmt(total.units)}</div>
          <div className="kpi-delta">{data.filter(p => p.units > 0).length} SKU มียอดขาย</div>
        </div>
      </div>

      {/* Chart */}
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>ยอดขายตาม{def.barLabel} · {def.label}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>หน่วย: บาท</div>
          </div>
          <div className="row" style={{ gap: 12, fontSize: 11, color: "var(--muted)" }}>
            <span className="row" style={{ gap: 5 }}><span style={{ width: 10, height: 10, background: "var(--accent)", borderRadius: 2 }}/>ยอดขาย</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 200, padding: "0 4px" }}>
          {chart.map((v, i) => {
            const h = (v / chartMax) * 100;
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ fontSize: 9, color: "var(--muted)", fontFamily: "IBM Plex Sans, sans-serif", height: 14, opacity: v / chartMax > 0.4 ? 1 : 0 }} className="tnum">
                  {v > 0 ? fmt(v / 1000) + "K" : ""}
                </div>
                <div title={fmtMoney(v)} style={{
                  width: "100%",
                  height: Math.max(2, h) + "%",
                  background: `linear-gradient(180deg, var(--accent), oklch(0.45 0.22 252))`,
                  borderRadius: "4px 4px 0 0",
                  transition: "height 0.25s"
                }}/>
                <div style={{ fontSize: 9, color: "var(--muted)", height: 12 }} className="tnum">{barLabels[i] || ""}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top sellers */}
      <div className="card card-tight">
        <div className="card-head">
          <div>
            <h3>สินค้าขายดี</h3>
            <div className="sub">เรียงตามยอดขายใน{def.label}</div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <span className="badge badge-neutral">{data.filter(p => p.units > 0).length} / {data.length} SKU</span>
          </div>
        </div>
        <table className="t">
          <thead><tr>
            <th style={{ width: 36 }}>#</th>
            <th>สินค้า</th>
            <th className="t-num">ขายได้</th>
            <th className="t-num">ราคาทุน</th>
            <th className="t-num">ราคาขาย</th>
            <th className="t-num">ยอดขาย</th>
            <th className="t-num">กำไร</th>
            <th className="t-num">มาร์จิ้น</th>
            <th style={{ width: 1 }}/>
          </tr></thead>
          <tbody>
            {data.map((p, i) => {
              const isOpen = open === p.sku;
              const margin = p.margin * 100;
              const marginTone = margin >= 50 ? "var(--success)" : margin >= 30 ? "var(--info)" : margin >= 15 ? "var(--warning)" : "var(--danger)";
              return (
                <React.Fragment key={p.sku}>
                  <tr style={{ cursor: "pointer" }} onClick={() => setOpen(isOpen ? null : p.sku)}>
                    <td style={{ color: "var(--muted)", fontSize: 12, fontWeight: 500 }}>{i + 1}</td>
                    <td>
                      <div className="row" style={{ gap: 10 }}>
                        <ProductImageThumb sku={p.sku} size={32} radius={6}/>
                        <div>
                          <div style={{ fontSize: 13 }}>{p.name}</div>
                          <div className="t-mono" style={{ marginTop: 2 }}>{p.sku} · {p.cat}</div>
                        </div>
                      </div>
                    </td>
                    <td className="t-num tnum">{p.units}</td>
                    <td className="t-num tnum" style={{ color: "var(--muted)" }}>฿{fmt(p.cost ?? p.price * 0.6)}</td>
                    <td className="t-num tnum">฿{fmt(p.price)}</td>
                    <td className="t-num tnum" style={{ fontWeight: 500 }}>{fmtMoney(p.revenue)}</td>
                    <td className="t-num tnum" style={{ color: "var(--success)" }}>{fmtMoney(p.profit)}</td>
                    <td className="t-num tnum" style={{ color: marginTone, fontWeight: 500 }}>{margin.toFixed(1)}%</td>
                    <td><Icons.Chev size={14} style={{ color: "var(--muted)", transform: isOpen ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.15s" }}/></td>
                  </tr>
                  {isOpen && (
                    <tr style={{ background: "var(--surface-2)" }}>
                      <td colSpan="9" style={{ padding: 16 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 20 }}>
                          <div>
                            <div className="eyebrow" style={{ marginBottom: 8 }}>แนวโน้มยอดขาย ({def.barLabel})</div>
                            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80 }}>
                              {p.series.map((v, j) => {
                                const max = Math.max(...p.series, 1);
                                return (
                                  <div key={j} title={`${v} ชิ้น`} style={{
                                    flex: 1,
                                    height: Math.max(2, v/max*100) + "%",
                                    background: "var(--accent)",
                                    borderRadius: "2px 2px 0 0",
                                    opacity: v === 0 ? 0.15 : 1
                                  }}/>
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <div className="eyebrow" style={{ marginBottom: 8 }}>สรุป</div>
                            <div className="grid-3" style={{ gap: 10 }}>
                              <SummaryCell label="ขาย" value={p.units + " ชิ้น"}/>
                              <SummaryCell label="สต็อกเหลือ" value={p.qty + " ชิ้น"}/>
                              <SummaryCell label="กำไรต่อชิ้น" value={"฿" + fmt(p.price - (p.cost ?? p.price * 0.6))}/>
                              <SummaryCell label="ยอดขาย" value={fmtMoney(p.revenue)}/>
                              <SummaryCell label="ต้นทุน" value={fmtMoney(p.costTotal)}/>
                              <SummaryCell label="กำไร" value={fmtMoney(p.profit)} accent/>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCell({ label, value, accent }) {
  return (
    <div style={{ padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }}>
      <div style={{ fontSize: 10, color: "var(--muted)" }}>{label}</div>
      <div className="tnum" style={{ fontSize: 14, fontWeight: 600, marginTop: 2, color: accent ? "var(--success)" : "var(--fg)" }}>{value}</div>
    </div>
  );
}

Object.assign(window, { AnalyticsPage });
