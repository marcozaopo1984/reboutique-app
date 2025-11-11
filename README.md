# Reboutique Gestionale

Full-stack management application built with **NestJS** (backend) and **Next.js** (frontend), 
integrated with **Firebase Authentication** and **Cloud Firestore**.

---

## 🚀 Architecture Overview

- **Frontend** → Next.js (React + TypeScript)
  - Firebase Authentication (Google or email/password)
  - Dynamic UI to manage tenants and other entities
- **Backend** → NestJS + Firebase Admin SDK
  - REST API with validation and authentication guards
  - Persists data in Firestore

---

## 🧰 Requirements

- Node.js **v20 LTS**
- npm **v10+**
- Firebase project (with Firestore + Authentication enabled)

---

## ⚙️ Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/marcozaopo1984/reboutique-app.git
cd reboutique-app
