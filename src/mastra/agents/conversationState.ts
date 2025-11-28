const conversationStates = new Map<string, {
  selectedRegion?: string;
  lastSearchName?: string;
  lastSearchResults?: any[];
  step: 'select_region' | 'enter_name' | 'enter_national_id' | 'completed';
  lastUpdate: number;
}>();

const TIMEOUT_MS = 30 * 60 * 1000;

function cleanupOldStates() {
  const now = Date.now();
  for (const [key, state] of conversationStates.entries()) {
    if (now - state.lastUpdate > TIMEOUT_MS) {
      conversationStates.delete(key);
    }
  }
}

export function getConversationState(chatId: string | number) {
  cleanupOldStates();
  const key = String(chatId);
  let state = conversationStates.get(key);
  if (!state) {
    state = {
      step: 'select_region',
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
  state.step = 'enter_name';
  state.lastUpdate = Date.now();
  conversationStates.set(key, state);
}

export function setSearchResults(chatId: string | number, name: string, results: any[]) {
  const key = String(chatId);
  const state = getConversationState(chatId);
  state.lastSearchName = name;
  state.lastSearchResults = results;
  state.step = 'enter_national_id';
  state.lastUpdate = Date.now();
  conversationStates.set(key, state);
}

export function resetConversation(chatId: string | number) {
  const key = String(chatId);
  conversationStates.set(key, {
    step: 'select_region',
    lastUpdate: Date.now(),
  });
}

export function getCurrentRegion(chatId: string | number): string | undefined {
  return getConversationState(chatId).selectedRegion;
}

export function getCurrentStep(chatId: string | number): string {
  return getConversationState(chatId).step;
}
