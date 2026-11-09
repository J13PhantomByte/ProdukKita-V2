# ProdukKita — Versi HTML, CSS & JavaScript

Versi statis dari ProdukKita (tanpa PHP/MySQL). Buka `index.html` langsung di browser.
Data produk, keranjang, dan pesanan disimpan di `localStorage` browser.

## File
- `index.html` — struktur halaman (katalog, checkout, sukses, riwayat, dialog)
- `style.css`  — tampilan (tanpa Bootstrap, tetap menjaga aksesibilitas)
- `app.js`     — logika: CRUD produk, keranjang, voucher, checkout

## Fitur
- CRUD produk (tambah/edit/hapus) + cari & filter kategori (validasi sama seperti versi PHP)
- Keranjang (drawer) dengan batas stok, ubah jumlah, hapus
- Checkout: data penerima (validasi), pilihan pengiriman, metode pembayaran
- Voucher, total dihitung otomatis; stok berkurang saat pesanan dibuat
- Struk/konfirmasi pesanan + riwayat pesanan + cetak struk

## Kode voucher
| Kode | Efek | Min. belanja |
|---|---|---|
| HEMAT10 | Diskon 10% (maks. Rp20.000) | Rp30.000 |
| DISKON5K | Potongan Rp5.000 | Rp20.000 |
| ONGKIRGRATIS | Subsidi ongkir hingga Rp15.000 (tidak berlaku ambil di toko) | Rp25.000 |
| PRODUKKITA20 | Diskon 20% (maks. Rp30.000) | Rp60.000 |

Voucher bisa diubah di konstanta `VOUCHERS` pada `app.js`.

## Catatan
- Pembayaran bersifat demo (tidak ada transaksi nyata).
- Gambar produk tetap dari images.unsplash.com sehingga butuh internet.
- Karena data ada di browser, aplikasi ini bukan pengganti backend sungguhan.
