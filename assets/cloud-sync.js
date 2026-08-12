// TELEX credentials remain local until the encrypted HISPAFLY AOC settings vault is enabled.
export async function startCloudSync() {
  window.dispatchEvent(new CustomEvent('hpf:settings-local-only'));
}
startCloudSync();
