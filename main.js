document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  const botContainer = document.getElementById('bot-container');
  const botInterface = document.getElementById('sovereign-bot-interface');
  const trigger = document.querySelector('[data-diagnostic-trigger="chat-open"]');

  if (!body || !botContainer || !botInterface) return;

  const siteId = body.dataset.siteId || 'unknown-site';
  const sessionContext = body.dataset.sessionContext || 'default';

  let threadId = null;
  let isLoading = false;
  let lastSubmitAt = 0;

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function renderPanel() {
    botContainer.dataset.state = 'ready';
    botInterface.innerHTML = `
      <div id="architect-panel" class="architect-panel">
        <div id="briefing-display" class="briefing-display">
          <p class="architect-status">The Architect is ready. Define the constraint.</p>
        </div>
        <div id="architect-input-wrapper" class="architect-input-wrapper">
          <textarea
            id="architect-input"
            class="architect-input"
            placeholder="Input structural query..."
            rows="1"
            maxlength="500"
            aria-label="Architect input"
          ></textarea>
          <button
            id="send-briefing"
            class="architect-submit"
            type="button"
            aria-label="Submit briefing"
          >
            Submit
          </button>
        </div>
        <p id="architect-meta" class="architect-meta">Enter to submit. Shift+Enter for line break.</p>
      </div>
    `;

    const input = document.getElementById('architect-input');
    const button = document.getElementById('send-briefing');

    if (input) {
      autoResize(input);

      input.addEventListener('input', () => {
        autoResize(input);
      });

      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          submitBriefing();
        }
      });
    }

    if (button) {
      button.addEventListener('click', () => {
        submitBriefing();
      });
    }
  }

  function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
  }

  function setLoadingState(loading) {
    const panel = document.getElementById('architect-panel');
    const input = document.getElementById('architect-input');
    const button = document.getElementById('send-briefing');

    isLoading = loading;

    if (panel) {
      panel.dataset.loading = loading ? 'true' : 'false';
    }

    if (input) {
      input.disabled = loading;
    }

    if (button) {
      button.disabled = loading;
    }
  }

  function renderError() {
    const display = document.getElementById('briefing-display');
    if (!display) return;

    display.innerHTML = `
      <p class="architect-error">Architect offline. Review structural inputs.</p>
    `;
  }

  function renderBriefing(question, answer) {
    const display = document.getElementById('briefing-display');
    if (!display) return;

    display.innerHTML = `
      <div class="briefing-entry">
        <p class="briefing-label">Current briefing</p>
        <div class="briefing-question">
          <p class="briefing-kicker">Input</p>
          <p>${escapeHtml(question)}</p>
        </div>
        <div class="briefing-answer">
          <p class="briefing-kicker">Architect</p>
          <div class="briefing-copy">${formatAnswer(answer)}</div>
        </div>
      </div>
    `;
  }

  function renderLoading(question) {
    const display = document.getElementById('briefing-display');
    if (!display) return;

    display.innerHTML = `
      <div class="briefing-entry">
        <p class="briefing-label">Current briefing</p>
        <div class="briefing-question">
          <p class="briefing-kicker">Input</p>
          <p>${escapeHtml(question)}</p>
        </div>
        <div class="briefing-answer">
          <p class="briefing-kicker">Architect</p>
          <p class="architect-status">Reviewing structure...</p>
        </div>
      </div>
    `;
  }

  function formatAnswer(answer) {
    const safe = escapeHtml(answer);
    const paragraphs = safe
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .filter(Boolean);

    return paragraphs.map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`).join('');
  }

  async function submitBriefing() {
    const now = Date.now();
    if (isLoading || now - lastSubmitAt < 500) return;

    const input = document.getElementById('architect-input');
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    lastSubmitAt = now;
    renderLoading(message);
    setLoadingState(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-Sovereign-Origin': window.location.origin
        },
        body: JSON.stringify({
          siteId,
          sessionContext,
          message,
          threadId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        renderError();
        return;
      }

      threadId = data.threadId || threadId;
      renderBriefing(message, data.message || 'No response received.');
      input.value = '';
      autoResize(input);
    } catch (error) {
      console.error(error);
      renderError();
    } finally {
      setLoadingState(false);
    }
  }

    renderPanel();

  if (trigger) {
    trigger.style.display = 'none';
  }

  console.log('Sovereign chassis ready for', siteId, 'with context', sessionContext);

  if (window.NETWORK_CONFIG) {
    console.log('Network config loaded:', window.NETWORK_CONFIG.version);
  }
});
