export function isTradingLicensed(profile) {
  return profile?.trading_license_status === "licensed";
}

export function tradingLicenseLabel(profile) {
  return isTradingLicensed(profile) ? "Licensed trader" : "License required";
}
