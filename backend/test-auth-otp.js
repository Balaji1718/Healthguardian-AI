import assert from "node:assert/strict";
import {
  sendPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPasswordWithToken,
  _resetOtpStoresForTesting,
  _getOtpRecordForTesting,
  hashOtp,
  OTP_TTL_MS,
  COOLDOWN_MS,
} from "./auth-otp.js";

process.env.NODE_ENV = "test";

console.log("==================================================================");
console.log("HealthGuardian AI: Email OTP Password Reset E2E Test Suite");
console.log("==================================================================");

async function runTests() {
  let passed = 0;
  let failed = 0;

  function pass(msg) {
    console.log(`  PASS  ${msg}`);
    passed++;
  }

  function fail(msg, err) {
    console.error(`  FAIL  ${msg}`);
    console.error(err);
    failed++;
  }

  _resetOtpStoresForTesting();

  // Test 1: Invalid email rejection
  try {
    const res = await sendPasswordResetOtp("invalid-email-address");
    assert.equal(res.ok, false);
    assert.match(res.error, /valid email/i);
    pass("Rejects invalid email format");
  } catch (err) {
    fail("Rejects invalid email format", err);
  }

  // Test 2: Valid email sends OTP (anti-enumeration check)
  const testEmail = "patient.test@healthguardian.ai";
  let firstOtp = null;
  try {
    const res = await sendPasswordResetOtp(testEmail);
    assert.equal(res.ok, true);
    assert.match(res.message, /verification code has been sent/i);

    const record = _getOtpRecordForTesting(testEmail);
    assert.ok(record, "OTP record should exist");
    assert.equal(record.attemptsLeft, 5);
    assert.ok(record.otpHash);
    assert.ok(record.salt);
    firstOtp = record._testOtp;
    assert.match(firstOtp, /^\d{6}$/, "OTP must be exactly 6 digits");
    pass("Generates cryptographically secure 6-digit OTP and hashes with salt");
  } catch (err) {
    fail("Generates cryptographically secure 6-digit OTP and hashes with salt", err);
  }

  // Test 3: Anti-enumeration for non-existent email
  try {
    const nonExistentEmail = "nonexistent.user9999@healthguardian.ai";
    const res = await sendPasswordResetOtp(nonExistentEmail);
    assert.equal(res.ok, true);
    assert.match(res.message, /verification code has been sent/i);
    pass("Anti-enumeration: non-existent email returns identical success message");
  } catch (err) {
    fail("Anti-enumeration: non-existent email returns identical success message", err);
  }

  // Test 4: Rate limit / 60-second cooldown
  try {
    const res = await sendPasswordResetOtp(testEmail);
    assert.equal(res.ok, false);
    assert.match(res.error, /wait.*seconds/i);
    assert.ok(res.cooldownRemainingSeconds > 0 && res.cooldownRemainingSeconds <= 60);
    pass("Enforces 60-second cooldown rate limit between OTP requests");
  } catch (err) {
    fail("Enforces 60-second cooldown rate limit between OTP requests", err);
  }

  // Test 5: Verify with wrong OTP decrements attempts
  try {
    const res = await verifyPasswordResetOtp(testEmail, "000000");
    assert.equal(res.ok, false);
    assert.equal(res.attemptsLeft, 4);
    assert.match(res.error, /4 attempts remaining/i);
    pass("Wrong OTP decrements attempts count (5 -> 4)");
  } catch (err) {
    fail("Wrong OTP decrements attempts count (5 -> 4)", err);
  }

  // Test 6: Lockout after 5 failed attempts
  try {
    await verifyPasswordResetOtp(testEmail, "111111"); // 3 left
    await verifyPasswordResetOtp(testEmail, "222222"); // 2 left
    await verifyPasswordResetOtp(testEmail, "333333"); // 1 left
    const finalFail = await verifyPasswordResetOtp(testEmail, "444444"); // 0 left -> lockout
    assert.equal(finalFail.ok, false);
    assert.match(finalFail.error, /no longer valid/i);

    const record = _getOtpRecordForTesting(testEmail);
    assert.equal(record, undefined, "Exhausted OTP record must be deleted");
    pass("Locks out and invalidates OTP after 5 consecutive incorrect attempts");
  } catch (err) {
    fail("Locks out and invalidates OTP after 5 consecutive incorrect attempts", err);
  }

  // Test 7: Successful OTP verification yields single-use resetSessionToken
  _resetOtpStoresForTesting();
  let sessionToken = null;
  try {
    await sendPasswordResetOtp(testEmail);
    const rec = _getOtpRecordForTesting(testEmail);
    const validOtp = rec._testOtp;

    const verifyRes = await verifyPasswordResetOtp(testEmail, validOtp);
    assert.equal(verifyRes.ok, true);
    assert.ok(verifyRes.resetSessionToken);
    assert.equal(verifyRes.resetSessionToken.length, 64); // 32-byte hex string
    sessionToken = verifyRes.resetSessionToken;

    // Verify OTP was consumed (cannot be reused)
    assert.equal(_getOtpRecordForTesting(testEmail), undefined);
    pass("Successful OTP verification yields 32-byte resetSessionToken and consumes OTP");
  } catch (err) {
    fail("Successful OTP verification yields 32-byte resetSessionToken and consumes OTP", err);
  }

  // Test 8: Reset password with invalid password (length < 8)
  try {
    const res = await resetPasswordWithToken(sessionToken, "short");
    assert.equal(res.ok, false);
    assert.match(res.error, /at least 8 characters/i);
    pass("Rejects new passwords shorter than 8 characters");
  } catch (err) {
    fail("Rejects new passwords shorter than 8 characters", err);
  }

  // Test 9: Reset password successfully with token
  try {
    const res = await resetPasswordWithToken(sessionToken, "NewSecurePassword123!");
    assert.equal(res.ok, true);
    assert.match(res.message, /password has been reset successfully/i);
    pass("Successfully resets password using valid resetSessionToken");
  } catch (err) {
    fail("Successfully resets password using valid resetSessionToken", err);
  }

  // Test 10: Replay / reuse prevention for resetSessionToken
  try {
    const res = await resetPasswordWithToken(sessionToken, "AnotherPassword123!");
    assert.equal(res.ok, false);
    assert.match(res.error, /expired|invalid/i);
    pass("Strict single-use token: token is destroyed and cannot be reused");
  } catch (err) {
    fail("Strict single-use token: token is destroyed and cannot be reused", err);
  }

  // Test 11: Expired OTP is rejected
  try {
    _resetOtpStoresForTesting();
    await sendPasswordResetOtp(testEmail);
    const rec = _getOtpRecordForTesting(testEmail);
    // Artificially age the OTP past 10 minutes
    rec.expiresAt = Date.now() - 1000;

    const res = await verifyPasswordResetOtp(testEmail, rec._testOtp);
    assert.equal(res.ok, false);
    assert.match(res.error, /expired/i);
    pass("Rejects expired OTP codes (10-minute TTL enforced)");
  } catch (err) {
    fail("Rejects expired OTP codes (10-minute TTL enforced)", err);
  }

  console.log("==================================================================");
  console.log(`Summary: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
