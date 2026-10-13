export interface SettingsReport {
  title: string;
  applied: string[];
  skipped: string[];
}

export interface ExtensionState {
  enabled: boolean;
  blockAI: boolean;
  ecoTab: boolean;
  autoDenyCookies: boolean;
  ecoApplied: boolean;
  backup: {
    web?: boolean;
    blockAI?: boolean;
    prediction?: { previousValue: boolean };
  };
  report: SettingsReport | null;
}

export type Feature = "blockAI" | "ecoTab";
export type MessageType = "getState" | "setWeb" | "setAutoDenyCookies" | "setFeature" | "applyEco" | "restore";
export interface ExtensionMessage {
  type: MessageType;
  enabled?: boolean;
  feature?: Feature;
}
export type ExtensionResponse = { ok: true; state: ExtensionState } | { ok: false; error: string };
