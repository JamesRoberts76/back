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

  const renderShell = (html) => {
    botContainer.dataset.state = 'ready';
    botInterface.innerHTML = `<div class="bot-shell">${html}</div>`;
  };

  const renderIdle = () => {
    renderShell(`
      <p><strong>Architect interface:</strong> ready.</p>
      <p>Site: ${siteId}</p>
      <p>Context: ${sessionContext}</p>
      <button type="button" id="architect-start">Open Architect</button>
      <div id="architect-response" style="margin-top:1rem;"></div>
    `);

    const startBtn = document.getElementById('architect-start');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        sendMessage('Give me a concise orientation for this site.');
      });
    }
  };

  const setResponse = (text) => {
    const responseNode = document.getElementById('architect-response');
    if (responseNode) {
      responseNode.innerHTML = `<p>${escapeHtml(text)}</p>`;
    }
  };

  const setLoading = () => {
    const responseNode = document.getElementById('architect-response');
    if (responseNode) {
      responseNode.innerHTML = `<p>Architect is thinking...</p>`;
    }
  };

  const sendMessage = async (message) => {
    if (isLoading) return;
    isLoading = true;
    setLoading();

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
        setResponse(data?.message || 'Request failed.');
        return;
      }

      threadId = data.threadId || threadId;
      setResponse(data.message || 'No response received.');
    } catch (error) {
      setResponse('Worker connection failed.');
      console.error(error);
    } finally {
      isLoading = false;
    }
  };

  if (trigger) {
    trigger.addEventListener('click', renderIdle);
  } else {
    renderIdle();
  }

  console.log('Sovereign chassis ready for', siteId, 'with context', sessionContext);

  if (window.NETWORK_CONFIG) {
    console.log('Network config loaded:', window.NETWORK_CONFIG.version);
  }
});

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
