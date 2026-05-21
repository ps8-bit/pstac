/* ══════════════════════════════════════════════════════════════
   Supabase client + all DB helpers for คลังพร้อมส่ง IMS
   Loaded AFTER data.jsx so PRODUCTS and isoToThai are in scope.
   ══════════════════════════════════════════════════════════════ */

const SUPABASE_URL  = 'https://eayufrfkmpeeeuaimvqw.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheXVmcmZrbXBlZWV1YWltdnF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyODA4MDcsImV4cCI6MjA5NDg1NjgwN30.tLlktiwI61LidG1Vz3tfZrfuor7rI7Wnyqhy7GJhihU';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

/* ═══════════════════════════════════════════
   PRODUCTS
   ═══════════════════════════════════════════ */
async function dbLoadProducts() {
  const { data, error } = await sb.from('products').select('*').order('sku');
  if (error) { console.error('[DB] load products:', error.message); return null; }
  return data;
}
async function dbUpsertProducts(products) {
  if (!products || !products.length) return;
  const rows = products.map(({ sku, name, cat, cost, price, qty, reserved, reorder, loc, supplier }) => ({
    sku, name, cat,
    cost:     Number(cost)     || 0,
    price:    Number(price)    || 0,
    qty:      Number(qty)      ?? 0,
    reserved: Number(reserved) ?? 0,
    reorder:  Number(reorder)  ?? 0,
    loc:      loc      || '-',
    supplier: supplier || 'ไม่ระบุ',
    updated_at: new Date().toISOString()
  }));
  const { error } = await sb.from('products').upsert(rows);
  if (error) console.error('[DB] upsert products:', error.message);
}
async function dbDeleteProducts(skus) {
  if (!skus) return;
  const arr = Array.isArray(skus) ? skus : [...skus];
  if (!arr.length) return;
  const { error } = await sb.from('products').delete().in('sku', arr);
  if (error) console.error('[DB] delete products:', error.message);
}

/* ═══════════════════════════════════════════
   ORDERS
   ═══════════════════════════════════════════ */
function _orderToRow(o) {
  return {
    id:            o.id,
    channel:       o.channel    || '',
    customer:      o.customer   || '',
    phone:         o.phone      || '',
    status:        o.status     || 'picking',
    carrier:       o.carrier    || '',
    tracking:      o.tracking   || '',
    item_count:    typeof o.items === 'number' ? o.items
                   : (Array.isArray(o.items) ? o.items.length : 0),
    is_bundle:     o.isBundle   || false,
    shipping_addr: o.shippingAddr || '',
    cod_amount:    Number(o.codAmount) || 0,
    note:          o.note       || '',
    date_iso:      o.dateIso    || new Date().toISOString().slice(0, 10)
  };
}
function _rowToOrder(row) {
  const dateIso = row.date_iso || row.created_at?.slice(0, 10) || '';
  const ts = row.created_at
    ? new Date(row.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })
    : (row.ts || '');
  return {
    id:           row.id,
    channel:      row.channel    || '',
    customer:     row.customer   || '',
    phone:        row.phone      || '',
    status:       row.status     || 'picking',
    carrier:      row.carrier    || '',
    tracking:     row.tracking   || '',
    items:        row.item_count ?? 0,
    isBundle:     row.is_bundle  || false,
    shippingAddr: row.shipping_addr || '',
    codAmount:    row.cod_amount || 0,
    note:         row.note       || '',
    dateIso,
    date: isoToThai(dateIso),
    ts
  };
}
async function dbLoadOrders() {
  const { data, error } = await sb
    .from('orders').select('*').order('created_at', { ascending: false });
  if (error) { console.error('[DB] load orders:', error.message); return null; }
  return data.map(_rowToOrder);
}
async function dbUpsertOrders(orders) {
  if (!orders || !orders.length) return;
  const { error } = await sb.from('orders').upsert(orders.map(_orderToRow));
  if (error) console.error('[DB] upsert orders:', error.message);
}
async function dbDeleteOrder(id) {
  const { error } = await sb.from('orders').delete().eq('id', id);
  if (error) console.error('[DB] delete order:', error.message);
}

/* ═══════════════════════════════════════════
   BUNDLES
   ═══════════════════════════════════════════ */
async function dbLoadBundles() {
  const { data, error } = await sb
    .from('bundles').select('*, bundle_items(sku, qty)').order('id');
  if (error) { console.error('[DB] load bundles:', error.message); return null; }
  return data.map(b => ({
    id:        b.id,
    name:      b.name,
    desc:      b.descr || '',
    descr:     b.descr || '',
    price:     b.price || 0,
    items:     (b.bundle_items || []).map(i => ({ sku: i.sku, qty: i.qty })),
    createdAt: b.created_at?.slice(0, 10) || ''
  }));
}
async function dbUpsertBundles(bundles) {
  if (!bundles || !bundles.length) return;
  for (const b of bundles) {
    const { error: e1 } = await sb.from('bundles').upsert({
      id: b.id, name: b.name,
      descr: b.desc || b.descr || '',
      price: b.price || 0
    });
    if (e1) { console.error('[DB] upsert bundle:', e1.message); continue; }
    await sb.from('bundle_items').delete().eq('bundle_id', b.id);
    if (b.items && b.items.length > 0) {
      const { error: e2 } = await sb.from('bundle_items').insert(
        b.items.map(i => ({ bundle_id: b.id, sku: i.sku, qty: i.qty }))
      );
      if (e2) console.error('[DB] insert bundle_items:', e2.message);
    }
  }
}
async function dbDeleteBundle(bundleId) {
  const { error } = await sb.from('bundles').delete().eq('id', bundleId);
  if (error) console.error('[DB] delete bundle:', error.message);
}

/* ═══════════════════════════════════════════
   LABELS
   ═══════════════════════════════════════════ */
async function dbLoadLabels() {
  const { data, error } = await sb
    .from('labels').select('*').order('created_at', { ascending: false });
  if (error) { console.error('[DB] load labels:', error.message); return null; }
  return data.map(l => ({ ...l.data, id: l.id }));
}
async function dbUpsertLabels(labels) {
  if (!labels || !labels.length) return;
  const rows = labels.map(l => ({ id: l.id, so_id: l.soId || '', data: l }));
  const { error } = await sb.from('labels').upsert(rows);
  if (error) console.error('[DB] upsert labels:', error.message);
}
async function dbDeleteLabel(id) {
  const { error } = await sb.from('labels').delete().eq('id', id);
  if (error) console.error('[DB] delete label:', error.message);
}

/* ═══════════════════════════════════════════
   STORE SETTINGS
   ═══════════════════════════════════════════ */
async function dbLoadStoreSettings() {
  const { data, error } = await sb
    .from('store_settings').select('value').eq('key', 'main').maybeSingle();
  if (error) { console.error('[DB] load store_settings:', error.message); return null; }
  return data?.value || null;
}
async function dbSaveStoreSettings(store) {
  const { error } = await sb.from('store_settings').upsert({ key: 'main', value: store });
  if (error) console.error('[DB] save store_settings:', error.message);
}

/* ═══════════════════════════════════════════
   AUDIT LOG
   ═══════════════════════════════════════════ */
async function dbInsertAuditEntry(entry) {
  const { error } = await sb.from('audit_log').insert({
    entity:    entry.entity    || '',
    entity_id: entry.entityId  || '',
    action:    entry.action    || '',
    summary:   entry.summary   || '',
    note:      entry.note      || '',
    user_name: entry.user?.name || 'ระบบ'
  });
  if (error) console.error('[DB] insert audit_log:', error.message);
}
async function dbLoadAuditLog(limit = 500) {
  const { data, error } = await sb
    .from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) { console.error('[DB] load audit_log:', error.message); return null; }
  return data.map(row => ({
    id:       String(row.id),
    ts:       row.created_at,
    user:     { name: row.user_name || 'ระบบ', role: '', avatar: (row.user_name || '?')[0], id: 0 },
    entity:   row.entity,
    entityId: row.entity_id,
    action:   row.action,
    summary:  row.summary,
    note:     row.note
  }));
}

/* ═══════════════════════════════════════════
   REAL-TIME SYNC
   Fires custom events so every open browser tab
   and all team members' browsers stay in sync.
   ═══════════════════════════════════════════ */
function setupRealtimeSync() {
  sb.channel('ims-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async () => {
      const fresh = await dbLoadProducts();
      if (fresh) { PRODUCTS.length = 0; fresh.forEach(p => PRODUCTS.push(p)); }
      window.dispatchEvent(new CustomEvent('ims-products-change'));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async () => {
      const fresh = await dbLoadOrders();
      if (fresh) window._DB_ORDERS = fresh;
      window.dispatchEvent(new CustomEvent('ims-orders-change'));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bundles' }, async () => {
      const fresh = await dbLoadBundles();
      if (fresh) window._DB_BUNDLES = fresh;
      window.dispatchEvent(new CustomEvent('ims-bundles-change'));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bundle_items' }, async () => {
      const fresh = await dbLoadBundles();
      if (fresh) window._DB_BUNDLES = fresh;
      window.dispatchEvent(new CustomEvent('ims-bundles-change'));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'labels' }, async () => {
      const fresh = await dbLoadLabels();
      if (fresh) window._DB_LABELS = fresh;
      window.dispatchEvent(new CustomEvent('ims-labels-change'));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, async () => {
      const fresh = await dbLoadStoreSettings();
      if (fresh) window._DB_STORE = fresh;
      window.dispatchEvent(new CustomEvent('ims-store-change'));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_log' }, async () => {
      const fresh = await dbLoadAuditLog();
      if (fresh) window._DB_AUDIT_LOG = fresh;
      window.dispatchEvent(new CustomEvent('ims-audit-change'));
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') console.log('[DB] ✓ Real-time sync active');
    });
}

/* ═══════════════════════════════════════════
   INIT — called once on app startup
   Loads all data from Supabase into global
   window._DB_* caches and PRODUCTS array.
   ═══════════════════════════════════════════ */
async function dbInit() {
  try {
    const [products, orders, bundles, labels, storeSettings, auditLog] = await Promise.all([
      dbLoadProducts(),
      dbLoadOrders(),
      dbLoadBundles(),
      dbLoadLabels(),
      dbLoadStoreSettings(),
      dbLoadAuditLog()
    ]);

    /* Hydrate global PRODUCTS array (mutated in-place so existing
       PRODUCTS.find() / PRODUCTS.filter() calls stay valid) */
    if (products) {
      PRODUCTS.length = 0;
      products.forEach(p => PRODUCTS.push(p));
    }

    /* Store shared data in window globals so components can read
       after initialization without async calls */
    if (orders)        window._DB_ORDERS    = orders;
    if (bundles)       window._DB_BUNDLES   = bundles;
    if (labels)        window._DB_LABELS    = labels;
    if (storeSettings) window._DB_STORE     = storeSettings;
    if (auditLog)      window._DB_AUDIT_LOG = auditLog;

    setupRealtimeSync();
    console.log('[DB] ✓ Initialized —',
      (products?.length  ?? 0), 'products,',
      (orders?.length    ?? 0), 'orders,',
      (bundles?.length   ?? 0), 'bundles,',
      (labels?.length    ?? 0), 'labels,',
      (auditLog?.length  ?? 0), 'audit entries');
    return true;
  } catch (err) {
    console.error('[DB] init failed:', err);
    return false;
  }
}

Object.assign(window, {
  sb,
  dbInit, setupRealtimeSync,
  dbLoadProducts,      dbUpsertProducts,     dbDeleteProducts,
  dbLoadOrders,        dbUpsertOrders,       dbDeleteOrder,
  dbLoadBundles,       dbUpsertBundles,      dbDeleteBundle,
  dbLoadLabels,        dbUpsertLabels,       dbDeleteLabel,
  dbLoadStoreSettings, dbSaveStoreSettings,
  dbInsertAuditEntry,  dbLoadAuditLog
});
