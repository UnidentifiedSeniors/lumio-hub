export function hasTwoPartyConfirmation(trade) {
  return Object.hasOwn(trade || {}, "sender_confirmed_at")
    && Object.hasOwn(trade || {}, "recipient_confirmed_at");
}
