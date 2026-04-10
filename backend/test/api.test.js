/**
 * SAU-Vigil Backend API Test Suite
 * 
 * Tests all Cloud Function endpoints against the local emulator.
 * Run: node backend/test/api.test.js
 * 
 * Prerequisites:
 *   1. Firebase emulators running: cd backend && firebase emulators:start
 *   2. Database seeded: POST http://localhost:5001/sau-vigil/asia-south1/seedDatabase
 */

const crypto = require("crypto");

const BASE = "http://127.0.0.1:5001/sau-vigil/asia-south1";
const QR_SECRET = "sau-vigil-dev-secret-key-2026";

// ─── Helpers ────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function makeQR(uid, offsetMs = 0) {
  const ts = Date.now() + offsetMs;
  const sig = crypto.createHmac("sha256", QR_SECRET).update(`${uid}:${ts}`).digest("hex");
  return JSON.stringify({ uid, ts, sig });
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, body: await res.json() };
}

function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function suite(name, fn) {
  console.log(`\n📋 ${name}`);
  try {
    await fn();
  } catch (e) {
    console.error(`  💥 Suite crashed: ${e.message}`);
    failed++;
  }
}

// ─── Seed ───────────────────────────────────────────────────

async function seed() {
  const res = await post("/seedDatabase", {});
  if (res.body.success) {
    console.log("🌱 Database seeded\n");
  } else {
    console.error("❌ Seed failed:", res.body);
    process.exit(1);
  }
}

// ─── Tests ──────────────────────────────────────────────────

async function testScanQR() {
  await suite("scanQR — Access Control", async () => {

    // 1. ALLOW: active student at main gate, correct device
    const r1 = await post("/scanQR", {
      qrData: makeQR("test-student-1"),
      gateId: "main-gate",
      guardId: "test-guard-1",
      deviceId: "device-001",
    });
    assert("Student at main gate → ALLOW", r1.body.decision === "ALLOW", JSON.stringify(r1.body));
    assert("Returns user name", r1.body.user?.name === "Arpan Kumar");
    assert("Returns logId", !!r1.body.logId);

    // 2. PENDING: hostel gate requires manual approval
    const r2 = await post("/scanQR", {
      qrData: makeQR("test-student-1"),
      gateId: "hostel-gate-a",
      guardId: "test-guard-1",
      deviceId: "device-001",
    });
    assert("Student at hostel gate → PENDING or ALLOW", ["PENDING", "ALLOW"].includes(r2.body.decision));

    // 3. DENY: suspended user
    const r3 = await post("/scanQR", {
      qrData: makeQR("test-suspended-1"),
      gateId: "main-gate",
      guardId: "test-guard-1",
      deviceId: "device-004",
    });
    assert("Suspended user → DENY", r3.body.decision === "DENY");
    assert("Flag: USER_INACTIVE", r3.body.flags?.includes("USER_INACTIVE"));

    // 4. DENY: device mismatch
    const r4 = await post("/scanQR", {
      qrData: makeQR("test-student-1"),
      gateId: "main-gate",
      guardId: "test-guard-1",
      deviceId: "wrong-device-xyz",
    });
    assert("Device mismatch → DENY", r4.body.decision === "DENY");
    assert("Flag: DEVICE_MISMATCH", r4.body.flags?.includes("DEVICE_MISMATCH"));

    // 5. DENY: no gate permission
    const r5 = await post("/scanQR", {
      qrData: makeQR("test-worker-1"),
      gateId: "hostel-gate-a",
      guardId: "test-guard-1",
      deviceId: "device-003",
    });
    assert("Worker at hostel gate → DENY", r5.body.decision === "DENY");
    assert("Flag: NO_GATE_PERMISSION", r5.body.flags?.includes("NO_GATE_PERMISSION"));

    // 6. DENY: expired QR (ts = 2 minutes ago)
    const r6 = await post("/scanQR", {
      qrData: makeQR("test-student-1", -2 * 60 * 1000),
      gateId: "main-gate",
      guardId: "test-guard-1",
      deviceId: "device-001",
    });
    assert("Expired QR → DENY", r6.body.decision === "DENY");
    assert("Flag: QR_EXPIRED", r6.body.flags?.includes("QR_EXPIRED"));

    // 7. DENY: tampered QR
    const r7 = await post("/scanQR", {
      qrData: JSON.stringify({ uid: "test-student-1", ts: Date.now(), sig: "fakesig" }),
      gateId: "main-gate",
      guardId: "test-guard-1",
      deviceId: "device-001",
    });
    assert("Tampered QR → DENY", r7.body.decision === "DENY");
    assert("Flag: INVALID_QR", r7.body.flags?.includes("INVALID_QR"));

    // 8. DENY: unknown user
    const r8 = await post("/scanQR", {
      qrData: makeQR("nonexistent-uid"),
      gateId: "main-gate",
      guardId: "test-guard-1",
      deviceId: "device-001",
    });
    assert("Unknown user → DENY", r8.body.decision === "DENY");

    // 9. 400: missing fields
    const r9 = await post("/scanQR", { qrData: "x" });
    assert("Missing fields → 400", r9.status === 400);

    // 10. Faculty has wildcard gate access
    const r10 = await post("/scanQR", {
      qrData: makeQR("test-faculty-1"),
      gateId: "hostel-gate-a",
      guardId: "test-guard-1",
      deviceId: "device-002",
    });
    assert("Faculty at any gate → ALLOW or PENDING", ["ALLOW", "PENDING"].includes(r10.body.decision));
  });
}

async function testGuardDecision() {
  await suite("guardDecision — Manual Approval", async () => {

    // First create a PENDING scan
    const scanRes = await post("/scanQR", {
      qrData: makeQR("test-student-1"),
      gateId: "hostel-gate-a",
      guardId: "test-guard-1",
      deviceId: "device-001",
    });

    if (!["PENDING", "ALLOW"].includes(scanRes.body.decision)) {
      assert("Setup: hostel scan created", false, `Got ${scanRes.body.decision}`);
      return;
    }

    if (scanRes.body.decision === "PENDING") {
      const logId = scanRes.body.logId;

      // ALLOW decision
      const r1 = await post("/guardDecision", {
        logId,
        decision: "ALLOW",
        guardId: "test-guard-1",
      });
      assert("Guard ALLOW decision → success", r1.body.success === true);
      assert("Returns logId", r1.body.logId === logId);

      // Double decision should fail
      const r2 = await post("/guardDecision", {
        logId,
        decision: "DENY",
        guardId: "test-guard-1",
      });
      assert("Double decision → 409 conflict", r2.status === 409);
    } else {
      console.log("  ⚠️  Hostel gate returned ALLOW (no curfew active) — skipping PENDING tests");
    }

    // Invalid decision value
    const r3 = await post("/guardDecision", {
      logId: "fake-log-id",
      decision: "MAYBE",
      guardId: "test-guard-1",
    });
    assert("Invalid decision value → 400", r3.status === 400);

    // Missing fields
    const r4 = await post("/guardDecision", { logId: "x" });
    assert("Missing fields → 400", r4.status === 400);
  });
}

async function testParcels() {
  await suite("createParcel + collectParcel", async () => {

    // Create parcel
    const r1 = await post("/createParcel", {
      userId: "test-student-1",
      description: "Amazon package - Laptop",
      guardId: "test-guard-1",
    });
    assert("Create parcel → 201", r1.status === 201);
    assert("Returns parcelId", !!r1.body.parcelId);

    const parcelId = r1.body.parcelId;

    // Collect parcel
    const r2 = await post("/collectParcel", {
      parcelId,
      guardId: "test-guard-1",
    });
    assert("Collect parcel → 200", r2.status === 200);
    assert("Success true", r2.body.success === true);

    // Double collect should fail
    const r3 = await post("/collectParcel", {
      parcelId,
      guardId: "test-guard-1",
    });
    assert("Double collect → 409", r3.status === 409);

    // Unknown user
    const r4 = await post("/createParcel", {
      userId: "nonexistent-user",
      description: "Test",
      guardId: "test-guard-1",
    });
    assert("Unknown user → 404", r4.status === 404);

    // Missing fields
    const r5 = await post("/createParcel", { userId: "test-student-1" });
    assert("Missing fields → 400", r5.status === 400);
  });
}

async function testVisitors() {
  await suite("createVisitorSession + validateVisitor", async () => {

    // Create visitor session
    const r1 = await post("/createVisitorSession", {
      name: "John Visitor",
      phone: "+919999999999",
      hostUserId: "test-student-1",
      purpose: "Meeting",
      validHours: 2,
      gates: ["main-gate"],
    });
    assert("Create visitor → 201", r1.status === 201);
    assert("Returns visitorId", !!r1.body.visitorId);
    assert("Returns validTill", !!r1.body.validTill);

    const visitorId = r1.body.visitorId;

    // Validate visitor
    const r2 = await get(`/validateVisitor?visitorId=${visitorId}`);
    assert("Validate visitor → 200", r2.status === 200);
    assert("Visitor is valid", r2.body.valid === true);
    assert("Returns visitor name", r2.body.visitor?.name === "John Visitor");

    // Unknown visitor
    const r3 = await get("/validateVisitor?visitorId=nonexistent");
    assert("Unknown visitor → 404", r3.status === 404);

    // Missing visitorId param
    const r4 = await get("/validateVisitor");
    assert("Missing visitorId → 400", r4.status === 400);

    // Unknown host
    const r5 = await post("/createVisitorSession", {
      name: "Test",
      phone: "+91000",
      hostUserId: "nonexistent-host",
      purpose: "Test",
    });
    assert("Unknown host → 404", r5.status === 404);
  });
}

async function testSeedDatabase() {
  await suite("seedDatabase", async () => {
    const r1 = await post("/seedDatabase", {});
    assert("Seed → success", r1.body.success === true);
    assert("Created 3 gates", r1.body.data?.gates === 3);
    assert("Created 6 users", r1.body.data?.users === 6);

    // GET should fail
    const res = await fetch(`${BASE}/seedDatabase`);
    assert("GET → 405", res.status === 405);
  });
}

// ─── Performance Test ────────────────────────────────────────

async function testPerformance() {
  await suite("Performance — scanQR < 2000ms", async () => {
    const times = [];

    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      await post("/scanQR", {
        qrData: makeQR("test-student-1"),
        gateId: "main-gate",
        guardId: "test-guard-1",
        deviceId: "device-001",
      });
      times.push(Date.now() - start);
    }

    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    const max = Math.max(...times);

    console.log(`  ⏱  Times: [${times.join(", ")}]ms`);
    console.log(`  ⏱  Avg: ${avg}ms | Max: ${max}ms`);
    assert(`Avg response < 2000ms (got ${avg}ms)`, avg < 2000);
    assert(`Max response < 3000ms (got ${max}ms)`, max < 3000);
  });
}

// ─── Run All ─────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  SAU-Vigil Backend API Test Suite");
  console.log("  Target: http://127.0.0.1:5001/sau-vigil");
  console.log("═══════════════════════════════════════════");

  // Check emulator is up
  try {
    await fetch(`${BASE}/seedDatabase`, { method: "HEAD" }).catch(() => {});
  } catch {
    console.error("\n❌ Cannot reach emulator at", BASE);
    console.error("   Run: cd backend && firebase emulators:start\n");
    process.exit(1);
  }

  await seed();
  await testSeedDatabase();
  await testScanQR();
  await testGuardDecision();
  await testParcels();
  await testVisitors();
  await testPerformance();

  console.log("\n═══════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════════\n");

  process.exit(failed > 0 ? 1 : 0);
}

main();
