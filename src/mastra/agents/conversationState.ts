interface VoterData {
  nationalId?: string;
  pollingStationName?: string;
  pollingStationAddress?: string;
}

interface ConversationState {
  selectedRegion?: string;
  voterData: VoterData;
  step: 'select_region' | 'enter_national_id' | 'enter_polling_station_name' | 'enter_polling_station_address' | 'review_data' | 'completed';
  lastUpdate: number;
}

const conversationStates = new Map<string, ConversationState>();

const TIMEOUT_MS = 30 * 60 * 1000;

function cleanupOldStates() {
  const now = Date.now();
  for (const [key, state] of conversationStates.entries()) {
    if (now - state.lastUpdate > TIMEOUT_MS) {
      conversationStates.delete(key);
    }
  }
}

export function getConversationState(chatId: string | number): ConversationState {
  cleanupOldStates();
  const key = String(chatId);
  let state = conversationStates.get(key);
  if (!state) {
    state = {
      step: 'select_region',
      voterData: {},
      lastUpdate: Date.now(),
    };
    conversationStates.set(key, state);
  }
  return state;
}

export function setSelectedRegion(chatId: string | number, region: string) {
  const key = String(chatId);
  const state = getConversationState(chatId);
  state.selectedRegion = region;
  state.step = 'enter_national_id';
  state.lastUpdate = Date.now();
  conversationStates.set(key, state);
}

export function setNationalId(chatId: string | number, nationalId: string) {
  const key = String(chatId);
  const state = getConversationState(chatId);
  state.voterData.nationalId = nationalId;
  state.step = 'enter_polling_station_name';
  state.lastUpdate = Date.now();
  conversationStates.set(key, state);
}

export function setPollingStationName(chatId: string | number, name: string) {
  const key = String(chatId);
  const state = getConversationState(chatId);
  state.voterData.pollingStationName = name;
  state.step = 'enter_polling_station_address';
  state.lastUpdate = Date.now();
  conversationStates.set(key, state);
}

export function setPollingStationAddress(chatId: string | number, address: string) {
  const key = String(chatId);
  const state = getConversationState(chatId);
  state.voterData.pollingStationAddress = address;
  state.step = 'review_data';
  state.lastUpdate = Date.now();
  conversationStates.set(key, state);
}

export function confirmData(chatId: string | number) {
  const key = String(chatId);
  const state = getConversationState(chatId);
  state.step = 'completed';
  state.lastUpdate = Date.now();
  conversationStates.set(key, state);
}

export function resetConversation(chatId: string | number) {
  const key = String(chatId);
  conversationStates.set(key, {
    step: 'select_region',
    voterData: {},
    lastUpdate: Date.now(),
  });
}

export function getCurrentRegion(chatId: string | number): string | undefined {
  return getConversationState(chatId).selectedRegion;
}

export function getCurrentStep(chatId: string | number): ConversationState['step'] {
  return getConversationState(chatId).step;
}

export function getVoterData(chatId: string | number): VoterData {
  return getConversationState(chatId).voterData;
}

export function isValidNationalId(nationalId: string): boolean {
  const cleaned = nationalId.replace(/\s/g, '');
  return /^\d{14}$/.test(cleaned);
}

export function isValidNumber(num: string): boolean {
  const cleaned = num.replace(/\s/g, '');
  return /^\d+$/.test(cleaned);
}
