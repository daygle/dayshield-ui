// Utility to format interface display name as "Friendly Name (NIC Name)"
export function formatInterfaceDisplayName(friendlyName: string | undefined, nicName: string): string {
  const friendly = friendlyName?.trim();
  if (!friendly) return nicName;
  if (friendly.toLowerCase() === nicName.trim().toLowerCase()) return friendly;
  return `${friendly} (${nicName})`;
}
