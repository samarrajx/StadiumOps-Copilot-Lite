/**
 * @file assistant.js
 * Decision Assistant panel for the StadiumOps Copilot control-room UI.
 *
 * SECURITY: Uses el() and clearChildren() exclusively. No innerHTML.
 */

import { el, clearChildren, refreshIcons, renderMarkdownToDOM } from '../utils/dom.js';

const QUICK_ACTIONS = [
  "What's the status at Gate C?",
  "Are there any delays?",
  "Give me a summary of attendance."
];

// ---------------------------------------------------------------------------
// renderAssistantPanel
// ---------------------------------------------------------------------------

export function renderAssistantPanel(container, state, handlers = {}) {
  clearChildren(container);

  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.height = '100%';

  // 1. Message List
  const messageList = el('div', {
    class: 'assistant-history',
    'aria-live': 'polite',
    'aria-atomic': 'false',
  });

  if (state.history.length === 0) {
    const emptyState = el('div', { class: 'empty-state flex flex-col items-center justify-center h-full text-muted gap-4 mt-8' }, [
      el('i', { 'data-lucide': 'message-square', style: 'width: 32px; height: 32px;' }),
      'How can I help with Stadium Operations today?'
    ]);
    
    const chipsDiv = el('div', { class: 'flex flex-wrap gap-2 justify-center mt-4' }, []);
    for (const qa of QUICK_ACTIONS) {
      const chip = el('button', { class: 'badge badge-outline cursor-pointer hover:bg-panel' }, [qa]);
      chip.addEventListener('click', () => {
        if (handlers.onInput) handlers.onInput(qa);
        if (handlers.onSubmit) handlers.onSubmit(qa); // Pass explicitly to avoid state lag
      });
      chipsDiv.appendChild(chip);
    }
    
    emptyState.appendChild(chipsDiv);
    messageList.appendChild(emptyState);
  } else {
    for (const msg of state.history) {
      const isUser = msg.role === 'user';
      
      const avatarEl = el('div', { class: 'msg-avatar' }, [
        el('i', { 'data-lucide': isUser ? 'user' : 'bot', style: 'width: 16px; height: 16px;' })
      ]);
      
      const contentEl = el('div', { class: 'msg-content' }, []);
      if (isUser) {
        contentEl.appendChild(document.createTextNode(msg.content));
      } else {
        const mdNodes = renderMarkdownToDOM(msg.content);
        for (const node of mdNodes) {
          contentEl.appendChild(node);
        }
      }
      
      messageList.appendChild(
        el('div', { class: `chat-msg chat-msg--${msg.role}` }, [avatarEl, contentEl])
      );
    }
  }

  // Typing Indicator
  if (state.loading) {
    const avatarEl = el('div', { class: 'msg-avatar' }, [
      el('i', { 'data-lucide': 'bot', style: 'width: 16px; height: 16px;' })
    ]);
    const indicator = el('div', { class: 'typing-indicator' }, [
      el('div', { class: 'typing-dot' }, []),
      el('div', { class: 'typing-dot' }, []),
      el('div', { class: 'typing-dot' }, [])
    ]);
    const contentEl = el('div', { class: 'msg-content' }, [indicator]);
    
    messageList.appendChild(
      el('div', { class: `chat-msg chat-msg--assistant` }, [avatarEl, contentEl])
    );
  }

  // 2. Error message
  let errorNode = null;
  if (state.error) {
    errorNode = el('div', { class: 'error-message text-danger mt-2 mb-2', role: 'alert' }, [state.error]);
  }

  // 3. Input area
  const inputEl = el('input', {
    type: 'text',
    class: 'assistant-input flex-grow',
    placeholder: 'Ask about operations...',
    value: state.input || '',
  });
  
  if (state.loading) {
    inputEl.setAttribute('disabled', 'true');
  }

  inputEl.addEventListener('input', (e) => {
    if (handlers.onInput) handlers.onInput(e.target.value);
  });

  inputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !state.loading && handlers.onSubmit) {
      handlers.onSubmit();
    }
  });

  const submitBtn = el('button', {
    class: 'btn btn-primary',
    'aria-busy': state.loading ? 'true' : 'false',
  }, [
    el('i', { 'data-lucide': 'send' })
  ]);

  if (state.loading) {
    submitBtn.setAttribute('disabled', 'true');
  }

  submitBtn.addEventListener('click', () => {
    if (handlers.onSubmit) handlers.onSubmit();
  });

  const inputGroup = el('div', { class: 'assistant-input-group mt-2 flex gap-2' }, [inputEl, submitBtn]);

  // Assemble
  container.appendChild(messageList);
  if (errorNode) {
    container.appendChild(errorNode);
  }
  container.appendChild(inputGroup);

  // Auto-scroll to bottom
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      messageList.scrollTop = messageList.scrollHeight;
    });
  }

  refreshIcons();

  if (!state.loading && document.activeElement !== inputEl) {
    // optional autofocus
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
