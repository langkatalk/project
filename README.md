# Langkatalk

Portal berita Langkatalk: HTML statis + Supabase (database dan login) + Vercel (hosting).
Tidak ada proses build. Cukup unggah folder ini.

## Isi folder
- `index.html` : situs publik, halaman masuk, dan ruang redaksi
- `config.js` : alamat dan kunci Supabase (kamu isi sendiri)
- `supabase/schema.sql` : tabel, aturan akses (RLS), dan alur redaksi
- `vercel.json`, `package.json` : pengaturan hosting dan perintah lokal
- `assets/` : logo dan favicon

## 1. Siapkan Supabase
1. Daftar di https://supabase.com, klik **New project**. Catat password database, pilih region Singapore.
2. Buka **SQL Editor > New query**, tempel seluruh isi `supabase/schema.sql`, klik **Run**.
3. Buka **Authentication > Providers > Email**. Selama uji coba, matikan **Confirm email** supaya pendaftar bisa langsung masuk. Nyalakan lagi saat situs sudah live.
4. Buka **Project Settings > API**. Salin **Project URL** dan **anon public key**.

## 2. Isi config.js
Ganti dua nilai di `config.js` dengan URL dan anon key tadi. Jangan pernah memakai `service_role` key.

## 3. Coba di komputer (opsional, perlu Node.js 18+)
```
npm run dev
```
Buka http://localhost:3000

## 4. Jadikan dirimu direktur
1. Buka situs, klik **Masuk > Daftar penulis**, buat akunmu (pakai email aktif).
2. Di Supabase **SQL Editor**, jalankan (ganti emailnya):
```sql
update public.profiles
   set role = 'direktur', username = 'mfakhri', full_name = 'M. Fakhri'
 where id = (select id from auth.users where email = 'EMAIL_KAMU@contoh.com');
```
3. Keluar lalu masuk lagi. Menu direktur akan muncul. Login bisa pakai `MFakhri` atau emailmu.

## 5. Buat akun pimpinan redaksi
Di Supabase: **Authentication > Users > Add user** (centang **Auto Confirm User**), lalu jalankan:
```sql
update public.profiles
   set role = 'pemred', username = 'pemred', full_name = 'Pimpinan Redaksi'
 where id = (select id from auth.users where email = 'EMAIL_PEMRED@contoh.com');
```
Peran lain (redaktur, editor, reporter) diatur direktur lewat menu **Pengguna dan peran**.

## 6. Deploy ke Vercel
1. Buat repositori di GitHub dan unggah isi folder ini.
2. Di https://vercel.com: **Add New > Project**, pilih repositori itu. Framework: **Other**. Biarkan build command kosong. Klik **Deploy**.
3. Setelah live, buka Supabase **Authentication > URL Configuration**, isi **Site URL** dengan alamat Vercel-mu (misalnya https://langkatalk.vercel.app).
4. Domain sendiri: Vercel **Settings > Domains**.

## Catatan keamanan
- Keamanan ada di database (RLS dan fungsi `advance_article`), bukan di tampilan. Status naskah tidak bisa diubah di luar alur redaksi walaupun orang membuka konsol peramban.
- Kolom `anon key` boleh publik. `service_role` key tidak boleh masuk ke repositori.
- Login memakai nama pengguna lewat fungsi `email_for_username`, yang membuat email bisa ditebak dari nama pengguna. Jika tidak ingin itu, hapus fungsi tersebut dan wajibkan login dengan email.

## Batasan versi ini
- Halaman berita dirender di peramban, jadi SEO-nya lebih lemah dari Next.js. Mesin pencari modern tetap bisa membacanya, tetapi untuk SEO maksimal, tahap berikutnya adalah pindah ke Next.js.
- Isi naskah berupa teks biasa (belum TipTap) dan belum ada unggah foto (Supabase Storage).
