// Utility to format gateway display name as "Friendly Name_Auto" or fallback to name
export function formatGatewayDisplayName(iface: { description?: string; name: string }, isAuto: boolean): string {
  const friendly = iface.description?.trim();
  if (isAuto) {
    if (friendly && friendly.length > 0) {
      return `${friendly}_Auto`;
    }
    return `${iface.name}_Auto`;
  }
  return friendly && friendly.length > 0 ? friendly : iface.name;
}
