const hasAzureTrustedSigning =
  Boolean(process.env.AZURE_ENDPOINT) &&
  Boolean(process.env.AZURE_CODE_SIGNING_ACCOUNT_NAME) &&
  Boolean(process.env.AZURE_CERTIFICATE_PROFILE_NAME) &&
  Boolean(process.env.AZURE_PUBLISHER_NAME);

module.exports = {
  appId: "com.htq.desktop",
  productName: "Hours to Qualify",
  directories: {
    output: "release",
    buildResources: "build"
  },
  files: [
    "dist/**/*",
    "dist-electron/**/*",
    "package.json"
  ],
  mac: {
    category: "public.app-category.productivity",
    target: [
      "dmg",
      "zip"
    ],
    artifactName: "${productName}-${version}-mac-${arch}.${ext}",
    icon: "build/icon.icns",
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: "build/entitlements.mac.plist",
    entitlementsInherit: "build/entitlements.mac.inherit.plist"
  },
  win: {
    target: "nsis",
    icon: "build/icon.ico",
    ...(hasAzureTrustedSigning
      ? {
          azureSignOptions: {
            publisherName: process.env.AZURE_PUBLISHER_NAME,
            endpoint: process.env.AZURE_ENDPOINT,
            certificateProfileName: process.env.AZURE_CERTIFICATE_PROFILE_NAME,
            codeSigningAccountName: process.env.AZURE_CODE_SIGNING_ACCOUNT_NAME
          }
        }
      : {})
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    allowToChangeInstallationDirectory: false,
    artifactName: "${productName}-${version}-windows-installer-${arch}.${ext}"
  },
  portable: {
    artifactName: "${productName}-${version}-windows-portable-${arch}.${ext}"
  }
};
