# 🎵 Sound Wave Production — Serverless Platform

![Serverless Architecture](https://img.shields.io/badge/Architecture-Serverless-FF9900?style=for-the-badge&logo=amazonaws)
![NodeJS](https://img.shields.io/badge/Node.js-16.x-339933?style=for-the-badge&logo=nodedotjs)
![AWS Lambda](https://img.shields.io/badge/AWS-Lambda-FF9900?style=for-the-badge&logo=aws-lambda)
![API Gateway](https://img.shields.io/badge/Amazon-API%20Gateway-FF4F8B?style=for-the-badge&logo=amazon-api-gateway)

Selamat datang di repositori pemesanan tiket **Sound Wave Production**. Proyek ini merupakan platform tiket yang tahan banting ketika terjadi puncak trafik tak terduga (*war ticket*) berkat penerapan prinsip **Decoupled Serverless Architecture**. 

_Terinspirasi dari modul resmi LKS (Lomba Kompetensi Siswa) Nasional bidang Cloud Computing 2025._

---

## 🏛 Arsitektur Sistem

Aplikasi ini dibagi secara ketat menjadi dua komponen utama:

### 1. Frontend (Statik & Responsif)
Folder `frontend/` berisi murni kode UI web client.
- **Teknologi**: Frontend dirancang untuk dideploy ke **AWS Amplify** atau layanan hosting statis S3.
- **Peran**: Menyajikan tatap muka dinamis untuk pelanggan tanpa membebani sisi komputasi backend. Berkomunikasi dengan *API Gateway Endpoint* (REST dan WebSocket).

### 2. Backend (Event-Driven Cloud)
Sisi server-side dirancang menggunakan ekosistem *Cloud Native* AWS.
- **API Gateway (REST & WebSocket)**: Menjadi pintu gerbang routing trafik pengguna menuju sumber komputasi.
- **AWS Lambda**: *Function as a Service* (FaaS) Node.js (v16.x) yang berjalan hanya saat dibutuhkan (terhubung melalui *monorepo* `backend/`).
- **Amazon SQS (FIFO)**: Mengantre orderan tiket pelanggan secara *First-In-First-Out* (sehingga mencegah duplikasi tiket & memastikan yang klik duluan dapat tiket duluan).
- **Amazon DynamoDB**: Database *NoSQL* *ultra-fast* yang menyimpan token login admin dan ID koneksi WebSocket dengan dukungan konfigurasi RCU/WCU *Auto Scaling*.
- **PostgreSQL RDS**: Database Relasional terpisah untuk menampung riwayat transaksi dan stok tiket. Dilindungi oleh konfigurasi Private Subnet VPC & kredensialnya tersimpan di **SSM Parameter Store**.
- **S3 Bucket Lifecycle**: Menyimpan bukti pembayaran pelanggan dengan konfigurasi otomatis berpindah ke arsip *Glacier Deep Archive* setelah 6 bulan.

---

## 📂 Struktur Repositori

```text
├── frontend/             # Root aplikasi UI
│   ├── index.html        # Kerangka web
│   ├── style.css         # Styling aesthetic global
│   └── app.js            # Interaktivitas DOM & State
│
├── backend/              # Node.js Lambda Functions (Monorepo)
│   ├── package.json      # Shared dependencies (Postgres, AWS SDK)
│   ├── token.js          # Generator Token + DynamoDB Put
│   ├── auth.js           # IAM Custom Authorizer
│   ├── queueOrder.js     # Menambahkan order ke SQS FIFO
│   ├── writeOrder.js     # Worker SQS -> Insert ke RDS
│   ├── readEvent.js      # Fetch data Event dari RDS
│   ├── websocket/        # Route logic untuk WebSocket API
│   │   └── index.js      
│   └── ... 
```

---

## 🚀 Panduan Deployment Manual

Jika Anda menggunakan repositori ini sebagai arena berlatih AWS Cloud, ikuti langkah-langkah di bawah ini:

### Persiapan Dependensi
Masuk ke terminal di folder backend dan instal requirement yang dibutuhkan:
```bash
cd backend
npm install
```

### Membuat Endpoint Lambda
Karena arsitektur Lambda dirancang sebagai *Monorepo*, lakukan pengemasan (Zipping) seluruh isi dari folder `backend/`:
1. Zip file (masukkan file `package.json`, `node_modules`, dan semua file `*.js`).
2. Masukkan Zip tersebut pada fungsi Lambda yang dibuat di US-West-2 / AWS Console.
3. Alihkan **Handler Name** sesuai dengan fitur yang dituju di Console AWS (Contoh: ketik `auth.handler` jika men-deploy fungsi Authorizer, ketik `queueOrder.handler` untuk fungsi terima order).

### Koneksi Frontend 
1. Jalankan API Gateway Anda dan kumpulkan *Invoke URL* nya.
2. Edit baris pertama pada `frontend/app.js`:
   ```javascript
   const API_BASE_URL = "https://[YOUR_API_ID].execute-api.us-west-2.amazonaws.com/prod";
   ```
3. Hilangkan semua logika simulasi (seperti `setTimeout`) di `app.js` dan ganti menjadi standard `fetch()` Request. 

---

## 🛡 Keamanan

Keseluruhan kredensial tidak boleh ada yang ditulis *hardcoded*. Baca parameter SSM menggunakan library SDK AWS dan berikan role akses menggunakan IAM (IAM Execution Role `LabRole`). Layanan backend tidak boleh memiliki port publik yang terekspos.

> *"May the cloud be with you."* — Sound Wave Engineers 🎸
