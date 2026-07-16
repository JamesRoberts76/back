document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  const botContainer = document.getElementById('bot-container');
  const botInterface = document.getElementById('sovereign-bot-interface');
  const trigger = document.querySelector('[data-diagnostic-trigger="chat-open"]');

  if (!body || !botContainer || !botInterface) return;

  const siteId = body.dataset.siteId || 'unknown-site';
  const sessionContext = body.dataset.sessionContext || 'default';

  const mountPlaceholder = () => {
    botContainer.dataset.state = 'ready';
    botInterface.innerHTML = `
      <div class="bot-shell">
        <p><strong>Architect interface:</strong> worker connection pending.</p>
        <p>Site: ${siteId}</p>
        <p>Context: ${sessionContext}</p>
        <p>Status: static chassis confirmed.</p>
      </div>
    `;
  };

  if (trigger) {
    trigger.addEventListener('click', mountPlaceholder);
  }

  console.log('Sovereign chassis ready for', siteId, 'with context', sessionContext);

  if (window.NETWORK_CONFIG) {
    console.log('Network config loaded:', window.NETWORK_CONFIG.version);
  }
});
