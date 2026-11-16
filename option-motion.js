(() => {
  'use strict';
  const selector = '.studio-header .sister-link, .studio-header .nav-button, .reset-row button, .site-header nav a, .site-header #help';
  const skip = 'svg, input, select, textarea, .text-roll, [aria-hidden="true"], .count, .connection-dot';
  function enhance() {
    document.querySelectorAll(selector).forEach(target => {
      const trigger = target.closest('label, button, a') || target;
      trigger.classList.add('text-roll-trigger');
      const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          return node.parentElement.closest(skip) || !node.textContent.trim()
            ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        }
      });
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(node => {
        const value = node.textContent;
        if (value.trim().length > 24) return;
        const label = document.createElement('i');
        label.className = 'text-roll';
        const source = document.createElement('i');
        source.className = 'text-roll-source';
        source.textContent = value;
        label.append(source);
        const visual = document.createElement('i');
        visual.className = 'text-roll-visual';
        visual.setAttribute('aria-hidden', 'true');
        Array.from(value).forEach((char, index) => {
          const cell = document.createElement('i');
          cell.className = 'text-roll-cell';
          const track = document.createElement('i');
          track.className = 'text-roll-track';
          track.style.setProperty('--roll-index', index);
          track.textContent = char;
          track.dataset.char = char;
          cell.append(track);
          visual.append(cell);
        });
        label.append(visual);
        node.replaceWith(label);
      });
    });
  }
  enhance();
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; enhance(); });
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
})();
