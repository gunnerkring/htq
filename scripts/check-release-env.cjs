#!/usr/bin/env node

const platform = process.argv[2];

function hasAll(keys) {
  return keys.every((key) => Boolean(process.env[key]));
}

function fail(lines) {
  console.error(lines.join("\n"));
  process.exit(1);
}

if (!platform) {
  fail([
    "Missing release platform argument.",
    "Usage: node scripts/check-release-env.cjs <mac|windows>"
  ]);
}

if (platform === "mac") {
  const hasSigningCert = hasAll(["CSC_LINK", "CSC_KEY_PASSWORD"]);
  const hasApiKeyNotarization = hasAll(["APPLE_API_KEY", "APPLE_API_KEY_ID", "APPLE_API_ISSUER"]);
  const hasAppleIdNotarization = hasAll([
    "APPLE_ID",
    "APPLE_APP_SPECIFIC_PASSWORD",
    "APPLE_TEAM_ID"
  ]);
  const hasKeychainProfile = hasAll(["APPLE_KEYCHAIN", "APPLE_KEYCHAIN_PROFILE"]);

  const errors = [];

  if (!hasSigningCert) {
    errors.push("- Missing macOS signing certificate env vars: CSC_LINK and CSC_KEY_PASSWORD.");
  }

  if (!hasApiKeyNotarization && !hasAppleIdNotarization && !hasKeychainProfile) {
    errors.push(
      "- Missing notarization credentials. Provide one of:",
      "  APPLE_API_KEY + APPLE_API_KEY_ID + APPLE_API_ISSUER",
      "  APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID",
      "  APPLE_KEYCHAIN + APPLE_KEYCHAIN_PROFILE"
    );
  }

  if (errors.length > 0) {
    fail([
      "macOS release signing/notarization is not fully configured.",
      ...errors
    ]);
  }

  console.log("macOS release credentials look complete.");
  process.exit(0);
}

if (platform === "windows") {
  const hasStandardCert = hasAll(["WIN_CSC_LINK", "WIN_CSC_KEY_PASSWORD"]) ||
    hasAll(["CSC_LINK", "CSC_KEY_PASSWORD"]);
  const hasAzureTrustedSigningConfig = hasAll([
    "AZURE_ENDPOINT",
    "AZURE_CODE_SIGNING_ACCOUNT_NAME",
    "AZURE_CERTIFICATE_PROFILE_NAME",
    "AZURE_PUBLISHER_NAME"
  ]);
  const hasAzureTrustedSigningAuth = hasAll([
    "AZURE_TENANT_ID",
    "AZURE_CLIENT_ID",
    "AZURE_CLIENT_SECRET"
  ]);

  if (!hasStandardCert && !(hasAzureTrustedSigningConfig && hasAzureTrustedSigningAuth)) {
    fail([
      "Windows release signing is not fully configured.",
      "- Provide WIN_CSC_LINK + WIN_CSC_KEY_PASSWORD (or CSC_LINK + CSC_KEY_PASSWORD),",
      "  or provide Azure Trusted Signing values:",
      "  AZURE_ENDPOINT, AZURE_CODE_SIGNING_ACCOUNT_NAME,",
      "  AZURE_CERTIFICATE_PROFILE_NAME, AZURE_PUBLISHER_NAME,",
      "  AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET."
    ]);
  }

  console.log("Windows release signing credentials look complete.");
  process.exit(0);
}

fail([
  `Unsupported release platform: ${platform}`,
  "Use mac or windows."
]);
