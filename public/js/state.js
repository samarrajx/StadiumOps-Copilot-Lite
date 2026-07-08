/**
 * @file state.js
 * Minimal pub-sub application store. No external library.
 * This is the single source of truth for the whole UI.
 *
 * Usage:
 *   const store = createStore({ phase: 'loading', gates: [] });
 *   const unsub = store.subscribe((state) => render(state));
 *   store.setState({ phase: 'ready' }); // shallow-merges, notifies subscribers
 */

/**
 * Creates a reactive store with shallow-merge updates.
 *
 * @param {object} initialState - Initial state snapshot.
 * @returns {{ getState: Function, setState: Function, subscribe: Function }}
 */
export function createStore(initialState) {
  // Internal state — never exposed by reference, only via getState() copies
  let state = { ...initialState };

  // Use a Set so each subscriber function is registered at most once
  const listeners = new Set();

  /**
   * Returns a shallow copy of the current state.
   * Callers may safely read (but not mutate) the returned object.
   */
  function getState() {
    return { ...state };
  }

  /**
   * Shallow-merges `partial` into the current state, then synchronously
   * notifies every registered subscriber with a copy of the new state.
   *
   * @param {object} partial - Fields to merge into state.
   */
  function setState(partial) {
    state = { ...state, ...partial };
    const snapshot = { ...state };
    for (const fn of listeners) {
      fn(snapshot);
    }
  }

  /**
   * Registers a subscriber function that is called after every setState.
   * Returns an unsubscribe function — call it to stop receiving notifications.
   *
   * @param {Function} fn - Called with the new state snapshot after each update.
   * @returns {Function} Unsubscribe function.
   */
  function subscribe(fn) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }

  return { getState, setState, subscribe };
}
