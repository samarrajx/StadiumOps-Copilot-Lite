/**
 * @file assistant.js
 * Decision Assistant panel for the StadiumOps Copilot control-room UI.
 *
 * SECURITY: Uses el() and clearChildren() exclusively. No innerHTML.
 */

import { el, clearChildren } from '../utils/dom.js';

// ---------------------------------------------------------------------------
// renderAssistantPanel
// ---------------------------------------------------------------------------

/**
 * Renders the assistant UI.
 *
 * @param {HTMLElement} container
 * @param {object} state - { history: [{role, content}], input: string, loading: boolean, error: string|null }
 * @param {object} handlers - { onInput: (value) => void, onSubmit: () => void }
 */
export function renderAssistantPanel(container, state, handlers = {}) {
  clearChildren(container);

  // 1. Message List
  const messageList = el('div', {
    class: 'assistant-history',
    'aria-live': 'polite',
    'aria-atomic': 'false',
  });

  if (state.history.length === 0) {
    messageList.appendChild(
      el('p', { class: 'empty-state text-muted' }, ['Ask a question to begin.'])
    );
  } else {
    for (const msg of state.history) {
      const isUser = msg.role === 'user';
      const roleLabel = isUser ? 'You: ' : 'Assistant: ';
      
      const roleEl = el('strong', { class: 'msg-role-label sr-only-or-visual' }, [roleLabel]);
      const contentEl = el('span', { class: 'msg-content' }, [msg.content]);
      
      messageList.appendChild(
        el('div', { class: `chat-msg chat-msg--${msg.role}` }, [roleEl, contentEl])
      );
    }
  }

  // 2. Error message (if any)
  let errorNode = null;
  if (state.error) {
    errorNode = el('div', { class: 'error-message', role: 'alert' }, [state.error]);
  }

  // 3. Input area
  const inputEl = el('input', {
    type: 'text',
    class: 'assistant-input',
    placeholder: 'Ask about gate status, wait times...',
    value: state.input || '',
  });
  
  if (state.loading) {
    inputEl.setAttribute('disabled', 'true');
  }

  inputEl.addEventListener('input', (e) => {
    if (handlers.onInput) handlers.onInput(e.target.value);
  });

  // Allow pressing Enter to submit
  inputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !state.loading && handlers.onSubmit) {
      handlers.onSubmit();
    }
  });

  const submitBtn = el('button', {
    class: 'btn-submit',
    'aria-busy': state.loading ? 'true' : 'false',
  }, [state.loading ? 'Thinking...' : 'Send']);

  if (state.loading) {
    submitBtn.setAttribute('disabled', 'true');
  }

  submitBtn.addEventListener('click', () => {
    if (handlers.onSubmit) handlers.onSubmit();
  });

  const inputGroup = el('div', { class: 'assistant-input-group' }, [inputEl, submitBtn]);

  // Assemble
  container.appendChild(messageList);
  if (errorNode) {
    container.appendChild(errorNode);
  }
  container.appendChild(inputGroup);

  // Auto-focus input on render if not loading, unless this is a test env without real focus
  if (!state.loading && document.activeElement !== inputEl) {
    // Avoid stealing focus aggressively if the user is clicking elsewhere, 
    // but in a real app, autofocusing here is often expected. We'll leave it
    // simple and rely on user clicks, except perhaps programmatically focusing
    // after a submit finishes.
  }
}

// ---------------------------------------------------------------------------
// mountAssistantPanel
// ---------------------------------------------------------------------------

/**
 * Wires the panel logic.
 *
 * @param {HTMLElement} container
 * @param {{ fetchAssistantAnswer: Function }} api
 */
export function mountAssistantPanel(container, api) {
  let state = {
    history: [],
    input: '',
    loading: false,
    error: null,
  };

  const update = (partial) => {
    state = { ...state, ...partial };
    renderAssistantPanel(container, state, { onInput: handleInput, onSubmit: handleSubmit });
  };

  const handleInput = (val) => {
    // We update the state input value but DO NOT trigger a full re-render here,
    // to avoid losing the browser's text cursor focus on every keystroke.
    state.input = val;
  };

  const handleSubmit = async () => {
    const question = state.input.trim();
    if (!question) return; // Defense in depth: validate non-empty
    if (state.loading) return;

    // 1. Append user message immediately and set loading
    const userMsg = { role: 'user', content: question };
    const historyForApi = [...state.history]; // Copy before appending user msg for the API call (which expects prior history)
    
    update({
      history: [...state.history, userMsg],
      loading: true,
      error: null,
    });

    // 2. Call API
    try {
      const response = await api.fetchAssistantAnswer(question, historyForApi);
      
      // 3. On success, append assistant reply and clear input
      update({
        history: [...state.history, { role: 'assistant', content: response.answer }],
        input: '',
        loading: false,
      });
      
      // Attempt to re-focus the newly rendered input field
      const newInput = container.querySelector('.assistant-input');
      if (newInput) newInput.focus();

    } catch (err) {
      // 4. On error, surface without corrupting history (user msg stays)
      update({
        loading: false,
        error: err.message,
      });
    }
  };

  // Initial render
  renderAssistantPanel(container, state, { onInput: handleInput, onSubmit: handleSubmit });
}
