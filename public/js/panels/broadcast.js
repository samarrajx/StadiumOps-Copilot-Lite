/**
 * @file broadcast.js
 * PA/Digital Signage Broadcast panel for the StadiumOps Copilot control-room UI.
 *
 * SECURITY: Uses el() and clearChildren() exclusively. No innerHTML.
 */

import { el, clearChildren, refreshIcons } from '../utils/dom.js';

const AVAILABLE_LANGUAGES = [
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'ar', label: 'Arabic' },
  { code: 'de', label: 'German' },
  { code: 'hi', label: 'Hindi' },
];

const MAX_MESSAGE_LENGTH = 300;

// ---------------------------------------------------------------------------
// renderBroadcastPanel
// ---------------------------------------------------------------------------

export function renderBroadcastPanel(container, state, handlers = {}) {
  clearChildren(container);

  // 1. Message Textarea and Counter
  const textarea = el('textarea', {
    class: 'broadcast-textarea',
    placeholder: 'Enter announcement for digital signage...',
    maxlength: MAX_MESSAGE_LENGTH.toString(),
    rows: '3'
  });
  textarea.value = state.message || '';
  if (state.loading) textarea.setAttribute('disabled', 'true');

  textarea.addEventListener('input', (e) => {
    if (handlers.onInput) handlers.onInput(e.target.value);
  });

  const charCount = state.message.length;
  const counterEl = el('div', { class: 'broadcast-counter' }, [
    `${charCount} / ${MAX_MESSAGE_LENGTH}`
  ]);

  const inputGroup = el('div', { class: 'broadcast-input-group mt-2' }, [
    textarea,
    counterEl
  ]);

  // 2. Language Selection
  const langList = el('div', { class: 'broadcast-lang-list flex gap-2 flex-wrap mb-4' }, []);

  for (const lang of AVAILABLE_LANGUAGES) {
    const isChecked = state.selectedLanguages.includes(lang.code);
    
    const checkbox = el('input', {
      type: 'checkbox',
      value: lang.code,
      id: `lang-cb-${lang.code}`,
      style: 'display:none;'
    });
    if (isChecked) checkbox.setAttribute('checked', 'true');
    if (state.loading) checkbox.setAttribute('disabled', 'true');

    checkbox.addEventListener('change', (e) => {
      if (handlers.onLangToggle) handlers.onLangToggle(lang.code, e.target.checked);
    });

    const badgeClass = isChecked ? 'badge-info' : 'badge-outline';
    const label = el('label', { for: `lang-cb-${lang.code}`, class: `badge ${badgeClass} cursor-pointer` }, [
      checkbox,
      lang.label
    ]);
    langList.appendChild(label);
  }

  // 3. Submit Button
  const submitBtn = el('button', {
    class: 'btn btn-primary w-full justify-center',
    'aria-busy': state.loading ? 'true' : 'false',
  }, [
    el('i', { 'data-lucide': 'radio' }),
    state.loading ? 'Translating...' : 'Generate Translations'
  ]);
  
  if (state.loading) submitBtn.setAttribute('disabled', 'true');
  submitBtn.addEventListener('click', () => {
    if (handlers.onSubmit) handlers.onSubmit();
  });

  // 4. Error state
  let errorNode = null;
  if (state.error) {
    errorNode = el('div', { class: 'error-message text-danger mt-2', role: 'alert' }, [state.error]);
  }

  // 5. Result section
  let resultGroup = null;
  if (state.loading && !state.result) {
    resultGroup = el('div', { class: 'skeleton mt-4', style: 'height:100px;' }, []);
  } else if (state.result) {
    resultGroup = el('div', { class: 'broadcast-results mt-4', 'aria-live': 'polite' }, []);
    
    // Translated blocks
    const allTranslations = [
      { language: 'en (Plain)', text: state.result.plainLanguage },
      ...state.result.translations
    ];

    for (const t of allTranslations) {
      const tBlock = el('div', { class: `translation-card` }, [
        el('div', { class: 'translation-card__header' }, [
          t.language.toUpperCase(),
          el('i', { 'data-lucide': 'copy', class: 'cursor-pointer' })
        ]),
        t.text
      ]);
      resultGroup.appendChild(tBlock);
    }
  }

  // Assemble
  const controlsDiv = el('div', {}, [
    inputGroup,
    langList,
    submitBtn
  ]);

  container.appendChild(controlsDiv);
  if (errorNode) container.appendChild(errorNode);
  if (resultGroup) container.appendChild(resultGroup);

  refreshIcons();
}

// ---------------------------------------------------------------------------
// mountBroadcastPanel
// ---------------------------------------------------------------------------

/**
 * Wires the broadcast panel logic.
 *
 * @param {HTMLElement} container
 * @param {{ fetchBroadcast: Function }} api
 */
export function mountBroadcastPanel(container, api) {
  let state = {
    message: '',
    selectedLanguages: [],
    loading: false,
    result: null,
    error: null,
  };

  // Rather than fully re-rendering on every keystroke (which ruins textarea focus),
  // we update state silently, and only manually update the counter DOM element.
  const handleInput = (val) => {
    state.message = val;
    // Manual DOM update to preserve focus
    const counterEl = container.querySelector('.broadcast-counter');
    if (counterEl) {
      counterEl.textContent = `${val.length} / ${MAX_MESSAGE_LENGTH}`;
    }
  };

  const handleLangToggle = (code, isChecked) => {
    if (isChecked) {
      if (!state.selectedLanguages.includes(code)) {
        state.selectedLanguages.push(code);
      }
    } else {
      state.selectedLanguages = state.selectedLanguages.filter(l => l !== code);
    }
    // Safe to re-render for checkboxes
    renderBroadcastPanel(container, state, { onInput: handleInput, onLangToggle: handleLangToggle, onSubmit: handleSubmit });
  };

  const handleSubmit = async () => {
    if (state.loading) return;
    
    const text = state.message.trim();
    if (!text) {
      state.error = 'Message cannot be empty.';
      renderBroadcastPanel(container, state, { onInput: handleInput, onLangToggle: handleLangToggle, onSubmit: handleSubmit });
      return;
    }
    
    if (state.selectedLanguages.length === 0) {
      state.error = 'Select at least one language.';
      renderBroadcastPanel(container, state, { onInput: handleInput, onLangToggle: handleLangToggle, onSubmit: handleSubmit });
      return;
    }

    state.loading = true;
    state.error = null;
    state.result = null;
    renderBroadcastPanel(container, state, { onInput: handleInput, onLangToggle: handleLangToggle, onSubmit: handleSubmit });

    try {
      const res = await api.fetchBroadcast(text, state.selectedLanguages);
      state.result = res;
      state.loading = false;
      renderBroadcastPanel(container, state, { onInput: handleInput, onLangToggle: handleLangToggle, onSubmit: handleSubmit });
    } catch (err) {
      state.error = err.message;
      state.loading = false;
      renderBroadcastPanel(container, state, { onInput: handleInput, onLangToggle: handleLangToggle, onSubmit: handleSubmit });
    }
  };

  // Initial render
  renderBroadcastPanel(container, state, { onInput: handleInput, onLangToggle: handleLangToggle, onSubmit: handleSubmit });
}
