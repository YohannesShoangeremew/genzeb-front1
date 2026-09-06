// Game IDs the local player has already seen end (win/lose/cancel) this session.
//
// Used to stop the card picker from auto-re-entering a game that's over: after a
// win the player is auto-returned to the lobby, but React Query's stale cache can
// briefly still show that game as DRAWING with the player's cards — which would
// bounce them back into the finished room and fire the win announcement a second
// time. Membership here means "don't auto-enter / don't re-announce this game".
export const finishedGames = new Set<string>();
