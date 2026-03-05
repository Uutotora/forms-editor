'use client';

import { useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';

// Тихая синхронизация при первом открытии приложения
// performSync вызывается напрямую — без проверки на unsaved (при старте их нет в памяти)
export function AppInitializer() {
  const { performSync } = useStore();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    performSync();
  }, [performSync]);

  return null;
}
