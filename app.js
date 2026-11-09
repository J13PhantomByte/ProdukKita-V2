/* ProdukKita — katalog, keranjang, checkout & voucher (tanpa backend; data di localStorage). */
(() => {
  'use strict';

  /* ---------- Konfigurasi ---------- */
  const CATEGORIES = ['Makanan', 'Minuman', 'Dessert', 'Lainnya'];
  const KEYS = { products: 'pk_products', cart: 'pk_cart', orders: 'pk_orders', voucher: 'pk_voucher' };

  const SEED = [
    { id: 1, nama: 'Es Kopi Susu', barang: 'Minuman', harga: 15000, stok: 10, gambar: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=800&q=80' },
    { id: 2, nama: 'Burger Beef', barang: 'Makanan', harga: 25000, stok: 5, gambar: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80' },
    { id: 3, nama: 'Strawberry Cake', barang: 'Dessert', harga: 20000, stok: 3, gambar: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80' },
    { id: 4, nama: 'French Fries', barang: 'Makanan', harga: 12000, stok: 8, gambar: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&q=80' },
  ];

  const SHIPPING = {
    reguler: { label: 'Reguler', desc: 'Estimasi 2–4 hari', cost: 10000 },
    express: { label: 'Express', desc: 'Estimasi 1 hari', cost: 20000 },
    ambil: { label: 'Ambil di toko', desc: 'Gratis, siap dalam 30 menit', cost: 0 },
  };
  const PAYMENTS = {
    transfer: { label: 'Transfer Bank', desc: 'Bayar via transfer, konfirmasi otomatis (demo)' },
    qris: { label: 'QRIS / E-wallet', desc: 'GoPay, OVO, DANA, ShopeePay (demo)' },
    cod: { label: 'Bayar di tempat (COD)', desc: 'Bayar tunai saat pesanan diterima' },
  };

  const VOUCHERS = [
    { code: 'HEMAT10', type: 'percent', value: 10, max: 20000, min: 30000, desc: 'Diskon 10% (maks. Rp20.000) • min. belanja Rp30.000' },
    { code: 'DISKON5K', type: 'flat', value: 5000, min: 20000, desc: 'Potongan Rp5.000 • min. belanja Rp20.000' },
    { code: 'ONGKIRGRATIS', type: 'shipping', max: 15000, min: 25000, desc: 'Subsidi ongkir hingga Rp15.000 • min. belanja Rp25.000' },
    { code: 'PRODUKKITA20', type: 'percent', value: 20, max: 30000, min: 60000, desc: 'Diskon 20% (maks. Rp30.000) • min. belanja Rp60.000' },
  ];

  /* ---------- Util ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const rp = (n) => 'Rp' + Math.round(n).toLocaleString('id-ID');
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="100%" height="100%" fill="#e8edf5"/><text x="50%" y="50%" fill="#4b5568" font-family="sans-serif" font-size="26" text-anchor="middle">Gambar belum tersedia</text></svg>');

  const memory = {};
  const store = {
    get(key, fallback) {
      try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
      catch { return key in memory ? memory[key] : fallback; }
    },
    set(key, value) {
      memory[key] = value;
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* mode privat: pakai memori */ }
    },
  };

  /* ---------- State ---------- */
  let products = store.get(KEYS.products, null) || SEED.map((p) => ({ ...p }));
  let cart = store.get(KEYS.cart, {});           // { [productId]: qty }
  let orders = store.get(KEYS.orders, []);
  let voucherCode = store.get(KEYS.voucher, '') || '';
  let lastTrigger = null;
  const save = () => {
    store.set(KEYS.products, products); store.set(KEYS.cart, cart);
    store.set(KEYS.orders, orders); store.set(KEYS.voucher, voucherCode);
  };
  const byId = (id) => products.find((p) => p.id === Number(id));

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  /* ---------- Keranjang ---------- */
  function cartLines() {
    const lines = [];
    let changed = false;
    for (const [id, qty] of Object.entries(cart)) {
      const p = byId(id);
      if (!p || p.stok <= 0) { delete cart[id]; changed = true; continue; }
      const q = Math.min(qty, p.stok);
      if (q !== qty) { cart[id] = q; changed = true; }
      lines.push({ p, qty: q });
    }
    if (changed) save();
    return lines;
  }
  const cartSubtotal = (lines = cartLines()) => lines.reduce((s, l) => s + l.p.harga * l.qty, 0);
  const cartCount = (lines = cartLines()) => lines.reduce((s, l) => s + l.qty, 0);

  function addToCart(id) {
    const p = byId(id); if (!p) return;
    const cur = cart[p.id] || 0;
    if (cur >= p.stok) { toast(`Stok ${p.nama} hanya ${p.stok}.`); return; }
    cart[p.id] = cur + 1; save(); refreshAll();
    toast(`${p.nama} ditambahkan ke keranjang.`);
  }
  function setQty(id, qty) {
    const p = byId(id); if (!p) return;
    if (qty <= 0) delete cart[p.id];
    else cart[p.id] = Math.min(qty, p.stok);
    save(); refreshAll();
  }

  /* ---------- Voucher ---------- */
  const findVoucher = (code) => VOUCHERS.find((v) => v.code === String(code).trim().toUpperCase());
  function evalVoucher(v, subtotal, shipCost) {
    if (subtotal <= 0) return { ok: false, reason: 'Keranjang masih kosong.' };
    if (subtotal < v.min) return { ok: false, reason: `Belanja ${rp(v.min - subtotal)} lagi untuk memakai voucher ini.` };
    let discount = 0, shipDisc = 0;
    if (v.type === 'percent') discount = Math.min(Math.floor((subtotal * v.value) / 100), v.max);
    else if (v.type === 'flat') discount = Math.min(v.value, subtotal);
    else if (v.type === 'shipping') {
      if (shipCost <= 0) return { ok: false, reason: 'Tidak berlaku untuk "Ambil di toko" (tanpa ongkir).' };
      shipDisc = Math.min(shipCost, v.max);
    }
    return { ok: true, discount, shipDisc };
  }
  const selectedShip = () => ($('input[name="ship"]:checked') || {}).value || 'reguler';

  function totals() {
    const lines = cartLines();
    const subtotal = cartSubtotal(lines);
    const shipCost = subtotal > 0 ? SHIPPING[selectedShip()].cost : 0;
    const v = voucherCode ? findVoucher(voucherCode) : null;
    const res = v ? evalVoucher(v, subtotal, shipCost) : null;
    const discount = res && res.ok ? res.discount : 0;
    const shipDisc = res && res.ok ? res.shipDisc : 0;
    const total = Math.max(0, subtotal - discount + shipCost - shipDisc);
    return { lines, subtotal, shipCost, voucher: v, res, discount, shipDisc, total };
  }

  /* ---------- Render: katalog ---------- */
  function renderCatalog() {
    const q = $('#q').value.trim().toLowerCase();
    const kat = $('#kategori').value;
    const list = products
      .filter((p) => (!kat || p.barang === kat) && (!q || p.nama.toLowerCase().includes(q) || p.barang.toLowerCase().includes(q)))
      .sort((a, b) => b.id - a.id);
    $('#count-pill').textContent = list.length;
    $('#count-pill').setAttribute('aria-label', `${list.length} produk`);
    const grid = $('#product-grid');
    if (!list.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><h3>Produk belum ditemukan</h3><p class="muted">Coba kata kunci lain atau tambahkan produk baru.</p></div>';
      return;
    }
    grid.innerHTML = list.map((p) => {
      const inCart = cart[p.id] || 0;
      const habis = p.stok <= 0;
      const maxed = inCart >= p.stok;
      const stokTxt = habis ? 'Stok habis' : p.stok <= 3 ? `Sisa ${p.stok} unit` : `Stok: ${p.stok} unit`;
      return `<article class="card" data-cat="${esc(p.barang)}">
        <div class="card-img"><img src="${esc(p.gambar)}" alt="${esc(p.nama)}" width="800" height="600" loading="lazy" decoding="async" data-img>${habis ? '<div class="sold" aria-hidden="true">HABIS</div>' : ''}</div>
        <div class="card-body">
          <span class="pill">${esc(p.barang)}</span>
          <h3>${esc(p.nama)}</h3>
          <p class="stock ${!habis && p.stok <= 3 ? 'low' : ''}">${stokTxt}${inCart ? ` · ${inCart} di keranjang` : ''}</p>
          <p class="price"><span class="sr-only" style="position:absolute;left:-9999px">Harga: </span>${rp(p.harga)}</p>
          <div class="card-actions">
            <button class="btn btn-primary" type="button" data-act="add" data-id="${p.id}" ${habis || maxed ? 'disabled' : ''} aria-label="Tambah ${esc(p.nama)} ke keranjang">${habis ? 'Stok habis' : maxed ? 'Maks. stok di keranjang' : '+ Keranjang'}</button>
            <div class="sub">
              <button class="btn btn-sm btn-outline" type="button" data-act="edit" data-id="${p.id}" aria-label="Edit produk ${esc(p.nama)}">Edit</button>
              <button class="btn btn-sm btn-danger" type="button" data-act="delete" data-id="${p.id}" aria-label="Hapus produk ${esc(p.nama)}">Hapus</button>
            </div>
          </div>
        </div>
      </article>`;
    }).join('');
  }

  /* ---------- Render: keranjang ---------- */
  function renderCart() {
    const lines = cartLines();
    const count = cartCount(lines);
    const badge = $('#cart-badge');
    badge.textContent = count; badge.setAttribute('aria-label', `${count} item`);

    const body = $('#cart-body'), foot = $('#cart-foot');
    if (!lines.length) {
      body.innerHTML = '<div class="empty-state"><h3>Keranjang kosong</h3><p class="muted">Tambahkan produk dari katalog.</p></div>';
      foot.innerHTML = '<button class="btn btn-light btn-lg" type="button" data-close="cart-dialog">Lihat katalog</button>';
      return;
    }
    body.innerHTML = lines.map(({ p, qty }) => `
      <div class="cart-line">
        <img src="${esc(p.gambar)}" alt="" data-img>
        <div>
          <h3>${esc(p.nama)}</h3>
          <p class="unit">${rp(p.harga)} / unit</p>
          <div class="line-bottom">
            <div class="qty" role="group" aria-label="Jumlah ${esc(p.nama)}">
              <button type="button" data-act="dec" data-id="${p.id}" aria-label="Kurangi jumlah ${esc(p.nama)}">−</button>
              <output aria-live="polite">${qty}</output>
              <button type="button" data-act="inc" data-id="${p.id}" ${qty >= p.stok ? 'disabled' : ''} aria-label="Tambah jumlah ${esc(p.nama)}">+</button>
            </div>
            <span class="line-total">${rp(p.harga * qty)}</span>
          </div>
          <button class="link-btn" type="button" data-act="remove" data-id="${p.id}" aria-label="Hapus ${esc(p.nama)} dari keranjang" style="padding:.3rem 0">Hapus</button>
        </div>
      </div>`).join('');
    foot.innerHTML = `
      <div class="sub-row"><span>Subtotal</span><span>${rp(cartSubtotal(lines))}</span></div>
      <p class="note">Voucher dan ongkir dihitung di halaman checkout.</p>
      <a class="btn btn-primary btn-lg" href="#/checkout" data-close="cart-dialog">Lanjut ke Checkout</a>`;
  }

  /* ---------- Render: checkout ---------- */
  function renderChoices() {
    const mk = (name, obj, def, withPrice) => Object.entries(obj).map(([k, o]) =>
      `<label class="choice"><input type="radio" name="${name}" value="${k}" ${k === def ? 'checked' : ''}>
        <span><strong>${esc(o.label)}</strong><small>${esc(o.desc)}</small></span>
        ${withPrice ? `<span class="c-price">${o.cost ? rp(o.cost) : 'Gratis'}</span>` : ''}</label>`).join('');
    $('#ship-choices').innerHTML = mk('ship', SHIPPING, 'reguler', true);
    $('#pay-choices').innerHTML = mk('pay', PAYMENTS, 'transfer', false);
  }

  function renderSummary() {
    const t = totals();
    const empty = !t.lines.length;
    $('#checkout-empty').hidden = !empty;
    $('#checkout-layout').hidden = empty;
    if (empty) return;

    $('#sum-items').innerHTML = t.lines.map(({ p, qty }) =>
      `<li><span>${esc(p.nama)} × ${qty}</span><span>${rp(p.harga * qty)}</span></li>`).join('');

    // Voucher: pesan status
    const msg = $('#voucher-msg');
    if (t.voucher && t.res && t.res.ok) { msg.className = 'voucher-msg ok'; msg.textContent = `Voucher ${t.voucher.code} dipakai. Hemat ${rp(t.discount + t.shipDisc)}.`; }
    else if (t.voucher && t.res) { msg.className = 'voucher-msg err'; msg.textContent = `${t.voucher.code} belum bisa dipakai: ${t.res.reason}`; }
    else if (!msg.dataset.keep) { msg.className = 'voucher-msg'; msg.textContent = ''; }
    delete msg.dataset.keep;

    $('#voucher-list').innerHTML = VOUCHERS.map((v) => {
      const r = evalVoucher(v, t.subtotal, t.shipCost);
      const applied = t.voucher && t.voucher.code === v.code;
      return `<div class="v-item ${applied ? 'applied' : ''} ${r.ok ? '' : 'off'}">
        <div><b>${v.code}</b><span>${esc(v.desc)}</span>${!r.ok ? `<span><br><em>${esc(r.reason)}</em></span>` : ''}</div>
        ${applied
          ? '<button class="btn btn-sm btn-light" type="button" data-act="voucher-remove">Lepas</button>'
          : `<button class="btn btn-sm btn-outline" type="button" data-act="voucher-use" data-code="${v.code}" ${r.ok ? '' : 'disabled'} aria-label="Pakai voucher ${v.code}">Pakai</button>`}
      </div>`;
    }).join('');

    $('#voucher-input').value = voucherCode;
    $('#totals').innerHTML = `
      <div><dt>Subtotal (${cartCount(t.lines)} item)</dt><dd>${rp(t.subtotal)}</dd></div>
      ${t.discount ? `<div class="disc"><dt>Diskon voucher (${esc(t.voucher.code)})</dt><dd>−${rp(t.discount)}</dd></div>` : ''}
      <div><dt>Ongkos kirim (${esc(SHIPPING[selectedShip()].label)})</dt><dd>${t.shipCost ? rp(t.shipCost) : 'Gratis'}</dd></div>
      ${t.shipDisc ? `<div class="disc"><dt>Subsidi ongkir (${esc(t.voucher.code)})</dt><dd>−${rp(t.shipDisc)}</dd></div>` : ''}
      <div class="grand"><dt>Total bayar</dt><dd>${rp(t.total)}</dd></div>`;
    $('#address-field').hidden = selectedShip() === 'ambil';
  }

  function applyVoucher(code) {
    const msg = $('#voucher-msg');
    const raw = String(code || '').trim();
    msg.dataset.keep = '1';
    if (!raw) { msg.className = 'voucher-msg err'; msg.textContent = 'Masukkan kode voucher terlebih dahulu.'; return; }
    const v = findVoucher(raw);
    if (!v) { msg.className = 'voucher-msg err'; msg.textContent = `Kode "${raw.toUpperCase()}" tidak ditemukan.`; $('#voucher-input').focus(); return; }
    const t = totals();
    const r = evalVoucher(v, t.subtotal, t.shipCost);
    if (!r.ok) { msg.className = 'voucher-msg err'; msg.textContent = `${v.code} belum bisa dipakai: ${r.reason}`; return; }
    voucherCode = v.code; save(); renderSummary();
  }
  function removeVoucher() {
    voucherCode = ''; save();
    const msg = $('#voucher-msg'); renderSummary();
    msg.className = 'voucher-msg'; msg.textContent = 'Voucher dilepas.';
  }

  /* ---------- Validasi & pesanan ---------- */
  function setErr(id, text) {
    const input = $('#' + id), err = $('#' + id + '-err');
    if (!err) return;
    err.hidden = !text; err.textContent = text || '';
    if (text) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
  }
  function validateCheckout(updateSummary = true) {
    const f = $('#checkout-form');
    const errors = [];
    const nama = f.nama.value.trim(), hp = f.hp.value.replace(/[\s-]/g, ''), email = f.email.value.trim(), alamat = f.alamat.value.trim();
    const needAddr = selectedShip() !== 'ambil';
    const check = (id, cond, msg) => { setErr(id, cond ? '' : msg); if (!cond) errors.push({ id, msg }); };
    check('co-nama', nama.length >= 2, 'Nama lengkap wajib diisi (minimal 2 karakter).');
    check('co-hp', /^(\+62|62|0)8\d{7,12}$/.test(hp), 'Nomor WhatsApp tidak valid. Contoh: 08123456789.');
    check('co-email', !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Format email tidak valid.');
    if (needAddr) check('co-alamat', alamat.length >= 10, 'Alamat lengkap wajib diisi (minimal 10 karakter).'); else setErr('co-alamat', '');
    if (!updateSummary) return errors;
    const box = $('#co-errors');
    if (errors.length) {
      box.innerHTML = `<strong>Periksa kembali data berikut:</strong><ul>${errors.map((e) => `<li><a href="#${e.id}" data-focus="${e.id}">${esc(e.msg)}</a></li>`).join('')}</ul>`;
      box.hidden = false;
    } else box.hidden = true;
    return errors;
  }

  function placeOrder(e) {
    e.preventDefault();
    const errors = validateCheckout();
    if (errors.length) { $('#co-errors').focus(); return; }

    const t = totals();
    if (!t.lines.length) { location.hash = '#/'; return; }
    const f = e.target;
    const ship = selectedShip(), pay = ($('input[name="pay"]:checked') || {}).value || 'transfer';

    // Pastikan stok masih cukup, lalu kurangi.
    for (const { p, qty } of t.lines) {
      if (p.stok < qty) { toast(`Stok ${p.nama} berubah. Periksa keranjang Anda.`); refreshAll(); return; }
    }
    const id = 'PK-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    const order = {
      id, date: new Date().toISOString(),
      items: t.lines.map(({ p, qty }) => ({ nama: p.nama, harga: p.harga, qty })),
      customer: { nama: f.nama.value.trim(), hp: f.hp.value.trim(), email: f.email.value.trim(), alamat: ship === 'ambil' ? '' : f.alamat.value.trim(), catatan: f.catatan.value.trim() },
      shipping: { key: ship, label: SHIPPING[ship].label, cost: t.shipCost },
      payment: { key: pay, label: PAYMENTS[pay].label },
      voucher: t.res && t.res.ok ? t.voucher.code : null,
      subtotal: t.subtotal, discount: t.discount, shipDiscount: t.shipDisc, total: t.total,
    };
    t.lines.forEach(({ p, qty }) => { p.stok -= qty; });
    orders.unshift(order);
    cart = {}; voucherCode = ''; save();
    f.reset();
    renderChoices();
    refreshAll();
    location.hash = '#/sukses/' + id;
  }

  function receiptHTML(o) {
    const d = new Date(o.date).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });
    const c = o.customer;
    return `<div class="receipt">
      <h3>Pesanan ${esc(o.id)}</h3>
      <dl class="meta">
        <dt>Tanggal</dt><dd>${esc(d)}</dd>
        <dt>Penerima</dt><dd>${esc(c.nama)} · ${esc(c.hp)}</dd>
        <dt>Pengiriman</dt><dd>${esc(o.shipping.label)}${c.alamat ? ' — ' + esc(c.alamat) : ''}</dd>
        <dt>Pembayaran</dt><dd>${esc(o.payment.label)}</dd>
        ${c.catatan ? `<dt>Catatan</dt><dd>${esc(c.catatan)}</dd>` : ''}
      </dl>
      <ul class="sum-items">${o.items.map((i) => `<li><span>${esc(i.nama)} × ${i.qty}</span><span>${rp(i.harga * i.qty)}</span></li>`).join('')}</ul>
      <dl class="totals">
        <div><dt>Subtotal</dt><dd>${rp(o.subtotal)}</dd></div>
        ${o.discount ? `<div class="disc"><dt>Diskon (${esc(o.voucher)})</dt><dd>−${rp(o.discount)}</dd></div>` : ''}
        <div><dt>Ongkos kirim</dt><dd>${o.shipping.cost ? rp(o.shipping.cost) : 'Gratis'}</dd></div>
        ${o.shipDiscount ? `<div class="disc"><dt>Subsidi ongkir (${esc(o.voucher)})</dt><dd>−${rp(o.shipDiscount)}</dd></div>` : ''}
        <div class="grand"><dt>Total bayar</dt><dd>${rp(o.total)}</dd></div>
      </dl></div>`;
  }
  function payInstruction(o) {
    if (o.payment.key === 'transfer') return `Transfer <strong>${rp(o.total)}</strong> ke rekening <strong>1234 5678 90</strong> a.n. ProdukKita (contoh/demo). Cantumkan kode pesanan <strong>${esc(o.id)}</strong>.`;
    if (o.payment.key === 'qris') return `Scan QRIS toko untuk membayar <strong>${rp(o.total)}</strong> (demo — tidak ada pembayaran nyata).`;
    return `Siapkan uang tunai <strong>${rp(o.total)}</strong> saat pesanan diterima.`;
  }

  function renderSuccess(id) {
    const o = orders.find((x) => x.id === id);
    const box = $('#success-box');
    if (!o) { box.innerHTML = '<div class="empty-state"><h2 tabindex="-1">Pesanan tidak ditemukan</h2><a class="btn btn-primary" href="#/">Kembali ke katalog</a></div>'; return; }
    box.innerHTML = `
      <div class="center"><div class="success-mark" aria-hidden="true">✓</div>
        <p class="eyebrow">PESANAN DITERIMA</p><h1 tabindex="-1">Terima kasih, ${esc(o.customer.nama.split(' ')[0])}!</h1>
        <p class="muted">Kode pesanan Anda <strong>${esc(o.id)}</strong>.</p></div>
      <div class="pay-box" role="note">${payInstruction(o)}</div>
      ${receiptHTML(o)}
      <div class="actions-row">
        <button class="btn btn-outline" type="button" onclick="window.print()">Cetak struk</button>
        <a class="btn btn-light" href="#/pesanan">Riwayat pesanan</a>
        <a class="btn btn-primary" href="#/">Belanja lagi</a>
      </div>`;
  }
  function renderOrders() {
    const box = $('#orders-list');
    if (!orders.length) { box.innerHTML = '<div class="empty-state"><h2>Belum ada pesanan</h2><p class="muted">Pesanan yang Anda buat akan muncul di sini.</p><a class="btn btn-primary" href="#/">Mulai belanja</a></div>'; return; }
    box.innerHTML = orders.map((o) => `<details class="order-card"><summary><span>${esc(o.id)}</span><span>${new Date(o.date).toLocaleDateString('id-ID', { dateStyle: 'medium' })} · ${rp(o.total)}</span></summary>${receiptHTML(o)}</details>`).join('');
  }

  /* ---------- Produk (CRUD) ---------- */
  const pdlg = () => $('#product-dialog');
  function openProductForm(id) {
    const p = id ? byId(id) : null;
    $('#pf-errors').hidden = true;
    $('#pf-id').value = p ? p.id : '';
    $('#pf-nama').value = p ? p.nama : '';
    $('#pf-kategori').value = p ? p.barang : CATEGORIES[0];
    $('#pf-harga').value = p ? p.harga : '';
    $('#pf-stok').value = p ? p.stok : '';
    $('#pf-gambar').value = p ? p.gambar : '';
    $('#pf-title').textContent = p ? 'Edit Produk' : 'Tambah Produk';
    $('#pf-submit').textContent = p ? 'Simpan Perubahan' : 'Simpan Produk';
    pdlg().showModal(); $('#pf-nama').focus();
  }
  function submitProduct(e) {
    e.preventDefault();
    const id = $('#pf-id').value;
    const nama = $('#pf-nama').value.trim(), barang = $('#pf-kategori').value, gambar = $('#pf-gambar').value.trim();
    const hargaRaw = $('#pf-harga').value.trim(), stokRaw = $('#pf-stok').value.trim();
    const harga = Number(hargaRaw), stok = Number(stokRaw);
    const errs = [];
    if (!nama || nama.length > 120) errs.push('Nama produk wajib diisi (maksimal 120 karakter).');
    if (!CATEGORIES.includes(barang)) errs.push('Kategori produk tidak valid.');
    if (hargaRaw === '' || !Number.isInteger(harga) || harga < 0 || harga > 2147483647) errs.push('Harga harus berupa bilangan bulat positif atau nol.');
    if (stokRaw === '' || !Number.isInteger(stok) || stok < 0 || stok > 100000000) errs.push('Stok harus berupa bilangan bulat positif atau nol.');
    let okUrl = false;
    try { const u = new URL(gambar); okUrl = u.protocol === 'https:' && u.hostname.toLowerCase() === 'images.unsplash.com' && gambar.length <= 500; } catch { /* tidak valid */ }
    if (!okUrl) errs.push('URL gambar harus berupa HTTPS dari images.unsplash.com.');
    const box = $('#pf-errors');
    if (errs.length) {
      box.innerHTML = `<strong>Periksa kembali data berikut:</strong><ul>${errs.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>`;
      box.hidden = false; box.focus(); return;
    }
    if (id) {
      Object.assign(byId(id), { nama, barang, harga, stok, gambar }); toast('Produk berhasil diperbarui.');
    } else {
      products.push({ id: products.reduce((m, p) => Math.max(m, p.id), 0) + 1, nama, barang, harga, stok, gambar }); toast('Produk berhasil ditambahkan.');
    }
    save(); pdlg().close(); refreshAll();
  }
  function deleteProduct(id) {
    const p = byId(id); if (!p) return;
    if (!confirm(`Hapus "${p.nama}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    products = products.filter((x) => x.id !== p.id); delete cart[p.id]; save(); refreshAll(); toast('Produk berhasil dihapus.');
  }

  /* ---------- Router ---------- */
  function route() {
    const h = location.hash || '#/';
    let view = 'catalog', arg = '';
    if (h.startsWith('#/checkout')) view = 'checkout';
    else if (h.startsWith('#/sukses')) { view = 'success'; arg = decodeURIComponent(h.split('/')[2] || ''); }
    else if (h.startsWith('#/pesanan')) view = 'orders';
    document.querySelectorAll('[data-view]').forEach((s) => { s.hidden = s.dataset.view !== view; });
    if (view === 'checkout') renderSummary();
    if (view === 'success') renderSuccess(arg);
    if (view === 'orders') renderOrders();
    document.title = { catalog: 'Katalog', checkout: 'Checkout', success: 'Pesanan Berhasil', orders: 'Pesanan Saya' }[view] + ' | ProdukKita';
    window.scrollTo(0, 0);
    const heading = $(`[data-view="${view}"] h1, [data-view="${view}"] h2`);
    if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
  }

  function refreshAll() {
    renderCatalog(); renderCart();
    if (!$('#view-checkout').hidden) renderSummary();
  }

  /* ---------- Event ---------- */
  document.addEventListener('click', (e) => {
    const closeBtn = e.target.closest('[data-close]');
    if (closeBtn) { const d = document.getElementById(closeBtn.dataset.close); if (d && d.open) d.close(); }

    const fo = e.target.closest('[data-focus]');
    if (fo) { e.preventDefault(); $('#' + fo.dataset.focus).focus(); return; }

    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const { act, id, code } = btn.dataset;
    if (act === 'add') addToCart(id);
    else if (act === 'inc') setQty(id, (cart[id] || 0) + 1);
    else if (act === 'dec') setQty(id, (cart[id] || 0) - 1);
    else if (act === 'remove') setQty(id, 0);
    else if (act === 'edit') { lastTrigger = btn; openProductForm(id); }
    else if (act === 'delete') deleteProduct(id);
    else if (act === 'voucher-use') applyVoucher(code);
    else if (act === 'voucher-remove') removeVoucher();
  });

  // Fallback gambar rusak
  document.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG' && e.target.dataset.img !== undefined && e.target.src !== PLACEHOLDER) e.target.src = PLACEHOLDER;
  }, true);

  function init() {
    const catOpts = CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('');
    $('#kategori').insertAdjacentHTML('beforeend', catOpts);
    $('#pf-kategori').innerHTML = catOpts;
    renderChoices();

    $('#filter-form').addEventListener('submit', (e) => e.preventDefault());
    $('#q').addEventListener('input', renderCatalog);
    $('#kategori').addEventListener('change', renderCatalog);
    $('#filter-reset').addEventListener('click', () => { $('#q').value = ''; $('#kategori').value = ''; renderCatalog(); });

    $('#btn-add-product').addEventListener('click', () => openProductForm(null));
    $('#product-form').addEventListener('submit', submitProduct);
    $('#open-cart').addEventListener('click', () => $('#cart-dialog').showModal());
    // Klik di luar panel menutup dialog
    document.querySelectorAll('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

    $('#checkout-form').addEventListener('submit', placeOrder);
    $('#checkout-form').addEventListener('change', (e) => { if (e.target.name === 'ship') renderSummary(); });
    ['co-nama', 'co-hp', 'co-email', 'co-alamat'].forEach((id) => $('#' + id).addEventListener('blur', () => { if (!$('#co-errors').hidden) validateCheckout(false); }));
    $('#voucher-apply').addEventListener('click', () => applyVoucher($('#voucher-input').value));
    $('#voucher-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyVoucher(e.target.value); } });

    $('#reset-demo').addEventListener('click', () => {
      if (!confirm('Reset semua data demo (produk, keranjang, pesanan)?')) return;
      products = SEED.map((p) => ({ ...p })); cart = {}; orders = []; voucherCode = ''; save();
      location.hash = '#/'; refreshAll(); toast('Data demo dikembalikan.');
    });

    window.addEventListener('hashchange', route);
    refreshAll(); route();
  }
  init();
})();
