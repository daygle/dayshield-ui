import { useEffect, useState } from 'react';
import { getInterfacesInventory } from '../../api/interfaces';
import type { NetworkInterface } from '../../types';

export function useInterfaceInventory() {
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);

  useEffect(() => {
    getInterfacesInventory()
      .then((res) => {
        setInterfaces(res.data?.configured ?? []);
      })
      .catch(() => setInterfaces([]));
  }, []);

  return interfaces;
}
