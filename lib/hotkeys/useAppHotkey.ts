"use client";

import { useEffect } from "react";
import { useHotkeyContext } from "./HotkeyProvider";

export function useAppHotkey(
  hotkeyId: string,
  action: () => void | Promise<void>
) {
  const { registerAction, unregisterAction } = useHotkeyContext();

  useEffect(() => {
    registerAction(hotkeyId, action);
    return () => unregisterAction(hotkeyId);
  }, [hotkeyId, action, registerAction, unregisterAction]);
}
