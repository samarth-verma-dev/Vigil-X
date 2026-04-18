# Vigil-X: Smart Campus Access Control System

A Firebase-based access control system for campus security featuring QR code scanning, face-based device binding, role-based authentication, and gate-specific access policies.

## 🏗️ Project Structure

```
sau-vigil/
├── backend/                    # Firebase backend
│   ├── functions/             # Cloud Functions
│   │   ├── src/
│   │   │   ├── index.ts       # Functions entry point
│   │   │   ├── scan.ts        # QR scanning logic
│   │   │   ├── qr.ts          # QR generation
│   │   │   ├── auth.ts        # Authentication
│   │   │   ├── guard.ts       # Guard decisions
│   │   │   ├── parcels.ts     # Parcel management
│   │   │   ├── visitors.ts    # Visitor sessions
│   │   │   ├── face.ts        # Face embedding (NEW)
│   │   │   ├── seed.ts        # Database seeding
│   │   │   └── middleware/    # Validation middleware
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── firebase.json          # Firebase config
│   ├── firestore.rules        # Security rules
│   └── firestore.indexes.json # Database indexes
│
├── vigilx/                    # Frontend Expo app
│   ├── app/                   # Expo Router screens
│   │   ├── (auth)/           # Authentication screens
│   │   │   ├── login.tsx
│   │   │   └── face-capture.tsx  # Face registration (NEW)
│   │   ├── (student)/        # Student screens
│   │   │   └── qr.tsx        # QR display
│   │   ├── (faculty)/        # Faculty screens
│   │   │   └── qr.tsx
│   │   ├── (guard)/          # Guard screens
│   │   │   └── scanner.tsx   # QR scanner
│   │   ├── (worker)/         # Worker screens (NEW)
│   │   │   └── qr.tsx
│   │   └── (visitor)/        # Visitor screens
│   ├── services/             # API & Firebase services
│   │   ├── firebase.ts       # Firebase initialization
│   │   └── api.ts            # API service layer
│   ├── context/              # React context
│   │   └── AuthContext.tsx   # Auth state management
│   ├── components/           # Reusable components
│   ├── constants/            # App constants
│   ├── hooks/                # Custom hooks
│   ├── assets/               # Images, fonts
│   ├── package.json
│   └── tsconfig.json
│
├── docs/                      # Documentation
│   ├── API.md                # API documentation
│   ├── ARCHITECTURE.md       # System architecture
│   ├── DEPLOYMENT.md         # Deployment guide
│   ├── SECURITY.md           # Security considerations
│   └── TESTING.md            # Testing guide
│
├── .kiro/                    # Kiro spec files
│   └── specs/
│       └── firebase-backend-integration/
│           ├── design.md
│           ├── requirements.md
│           └── tasks.md
│
└── README.md                 # This file
```

## 🚀 Features

### Core Features
- **QR Code Access Control**: Time-limited QR codes with HMAC signatures
- **Face-Based Device Binding**: 128-dimensional face embeddings using face-api.js
- **Role-Based Authentication**: Student, Faculty, Guard, Worker, Visitor roles
- **Gate-Specific Behavior**: Different UI/logic for main gate vs hostel gates
- **Offline Mode**: Cached QR codes valid for 5 minutes
- **Worker Subcategories**: Mess workers (main gate only), Maintenance workers (all gates)
- **Sub-2-Second Scans**: Optimized for fast entry processing
- **Parcel Management**: Delivery notifications and tracking

### Security Features
- HMAC-SHA256 signature verification
- 60-second QR expiry
- Face embedding verification
- Device binding
- Role-based Firestore security rules
- Privacy-preserving embeddings (not reversible to photos)

## 📋 Prerequisites

- Node.js 18+
- Firebase CLI: `npm install -g firebase-tools`
- Expo CLI: `npm install -g expo-cli`
- Firebase project (dev and production)

## 🛠️ Setup

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
cd functions
npm install
```

3. Configure Firebase:
```bash
firebase login
firebase use --add  # Select your Firebase project
```

4. Set environment variables:
```bash
firebase functions:config:set \
  qr.secret="your-hmac-secret-key" \
  app.region="asia-south1"
```

5. Deploy Firestore rules and indexes:
```bash
firebase deploy --only firestore:rules,firestore:indexes
```

6. Deploy Cloud Functions:
```bash
firebase deploy --only functions
```

7. Seed database (optional):
```bash
# Call the seedDatabase function via HTTP or Firebase console
```

### Frontend Setup

1. Navigate to vigilx directory:
```bash
cd vigilx
```

2. Install dependencies:
```bash
npm install
```

3. Download face-api.js models:
```bash
# Download models from https://github.com/justadudewhohacks/face-api.js-models
# Place in vigilx/assets/models/
```

4. Configure Firebase:
- Update `vigilx/services/firebase.ts` with your Firebase config

5. Start development server:
```bash
npx expo start
```

## 🗄️ Database Schema

### Collections

#### `users`
```typescript
{
  uid: string
  name: string
  email: string
  role: "student" | "faculty" | "visitor" | "worker" | "guard"
  workerType?: "mess" | "maintenance" | "other"
  status: string
  permissions: {
    gates: string[]  // For workers
  }
  deviceId?: string
  faceEmbedding?: boolean
  photoURL?: string  // Firebase Storage URL
  fcmToken?: string
}
```

#### `face_embeddings`
```typescript
{
  uid: string  // Document ID
  embedding: number[]  // 128-dimensional vector
  createdAt: Timestamp
  deviceId: string
}
```

#### `logs`
```typescript
{
  logId: string
  userId: string
  userName: string
  userRole: string
  gateId: string
  gateName: string
  timestamp: Timestamp
  systemDecision: "ALLOW" | "DENY" | "PENDING"
  guardDecision?: "ALLOW" | "DENY"
  flags: string[]
  deviceId: string
  faceVerified?: boolean
}
```

#### `pending_scans`
```typescript
{
  logId: string
  userId: string
  gateId: string
  guardId: string
  expiresAt: Timestamp
  createdAt: Timestamp
}
```

#### `parcels`
```typescript
{
  parcelId: string
  studentId: string
  description: string
  guardId: string
  status: "pending" | "collected"
  createdAt: Timestamp
  collectedAt?: Timestamp
}
```

#### `gates`
```typescript
{
  gateId: string
  name: string
  type: "main" | "hostel"
  location: string
}
```

## 🔐 Security

### Photo Storage
- **User Photos**: Stored in Firebase Storage at `user-photos/{uid}.jpg`
- **Access**: Public read (for guard display), authenticated write
- **Purpose**: Displayed to guards during QR scans

### Face Embeddings
- **Storage**: Firestore collection `face_embeddings/{uid}`
- **Format**: 128-dimensional normalized vector (face-api.js)
- **Privacy**: Not reversible to original photo
- **Access**: Owner read/write only
- **Purpose**: Device binding verification

### QR Codes
- **Signature**: HMAC-SHA256 with secret key
- **Expiry**: 60 seconds
- **Offline Cache**: Max 5 minutes
- **Verification**: Constant-time comparison

## 🧪 Testing

Run backend tests:
```bash
cd backend/functions
npm test
```

Run frontend tests:
```bash
cd vigilx
npm test
```

See [docs/TESTING.md](docs/TESTING.md) for detailed testing guide.

## 📚 Documentation

- [API Documentation](docs/API.md)
- [Architecture Overview](docs/ARCHITECTURE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Security Considerations](docs/SECURITY.md)
- [Testing Guide](docs/TESTING.md)

## 🚦 Gate-Specific Behavior

### Main Gate
- **Students**: Auto-allowed, minimal info displayed (name + photo only)
- **Others**: Pending decision, full details displayed, guard approval required

### Hostel Gates
- **All Users**: Full details always displayed
- **Decision**: ALLOW/DENY/PENDING based on permissions
- **Guard**: Can approve/deny pending scans

## 👥 Worker Roles

### Mess Worker
- **Access**: Main gate only
- **Permissions**: `permissions.gates = ["main-gate"]`

### Maintenance Worker
- **Access**: Main gate + all hostel gates
- **Permissions**: `permissions.gates = ["main-gate", "hostel-gate-1", "hostel-gate-2", ...]`

### Other Worker
- **Access**: Custom gate list
- **Permissions**: Configured per worker

## 📱 Offline Mode

- **QR Display**: Works offline with cached QR (max 5 minutes)
- **QR Scanning**: Requires network connectivity (no offline scanning)
- **Auto-Refresh**: QR refreshes automatically when network restored
- **Indicator**: Visual "Offline Mode" indicator shown to user

## 🔄 API Endpoints

### Cloud Functions

- `POST /scanQR` - Scan QR code at gate
- `POST /generateQR` - Generate QR code for user
- `POST /guardDecision` - Submit guard decision for pending scan
- `POST /uploadFaceEmbedding` - Upload face embedding and photo
- `POST /createParcel` - Create parcel for student
- `POST /collectParcel` - Mark parcel as collected
- `POST /createVisitorSession` - Create visitor pass
- `POST /validateVisitor` - Validate visitor QR

See [docs/API.md](docs/API.md) for detailed API documentation.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write tests
5. Submit a pull request

## 📄 License

[MIT License]

## 👨‍💻 Authors

[Team-Logical Error]

