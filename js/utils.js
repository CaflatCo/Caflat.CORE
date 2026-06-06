function generateId() {

  return (

    Date.now()
      .toString(36)

    +

    Math.random()
      .toString(36)
      .slice(2, 8)

  );

}

function formatCurrency(
  amount
) {

  return new Intl.NumberFormat(

    'en-PH',

    {
      style: 'currency',
      currency: 'PHP'
    }

  ).format(
    Number(amount || 0)
  );

}

function safeNumber(
  value,
  fallback = 0
) {

  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )

    ? parsed

    : fallback;

}

function sanitizeText(
  value
) {

  return String(
    value || ''
  )

    .trim();

}

function showNotification(
  message,
  type = 'info'
) {

  let container =
    document.getElementById(
      'notificationContainer'
    );

  if (!container) {

    container =
      document.createElement(
        'div'
      );

    container.id =
      'notificationContainer';

    container.style.position =
      'fixed';

    container.style.top =
      '20px';

    container.style.right =
      '20px';

    container.style.zIndex =
      '999999';

    container.style.display =
      'flex';

    container.style.flexDirection =
      'column';

    container.style.gap =
      '10px';

    document.body.appendChild(
      container
    );

  }

  const notification =
    document.createElement(
      'div'
    );

  notification.style.padding =
    '14px 18px';

  notification.style.border =
    '1px solid #111';

  notification.style.background =
    '#fff';

  notification.style.color =
    '#111';

  notification.style.fontSize =
    '13px';

  notification.style.fontWeight =
    '700';

  notification.style.letterSpacing =
    '1px';

  notification.style.boxShadow =
    '0 10px 24px rgba(0,0,0,.08)';

  notification.style.minWidth =
    '240px';

  notification.style.transform =
    'translateY(-10px)';

  notification.style.opacity =
    '0';

  notification.style.transition =
    'all .18s ease';

  if (type === 'success') {

    notification.style.borderLeft =
      '6px solid #16a34a';

  }

  if (type === 'error') {

    notification.style.borderLeft =
      '6px solid #dc2626';

  }

  if (type === 'info') {

    notification.style.borderLeft =
      '6px solid #111';

  }

  notification.textContent =
    message;

  container.appendChild(
    notification
  );

  requestAnimationFrame(
    () => {

      notification.style.opacity =
        '1';

      notification.style.transform =
        'translateY(0)';

    }
  );

  setTimeout(
    () => {

      notification.style.opacity =
        '0';

      notification.style.transform =
        'translateY(-10px)';

      setTimeout(
        () => {

          notification.remove();

        },
        180
      );

    },
    3000
  );

}

function openModal(
  modalId
) {

  const modal =
    document.getElementById(
      modalId
    );

  if (!modal)
    return;

  modal.classList.add(
    'active'
  );

  document.body.style.overflow =
    'hidden';

}

function closeModal(
  modalId
) {

  const modal =
    document.getElementById(
      modalId
    );

  if (!modal)
    return;

  modal.classList.remove(
    'active'
  );

  const stillOpen =
    document.querySelector(
      '.modal-overlay.active'
    );

  if (!stillOpen) {

    document.body.style.overflow =
      '';

  }

}

function clearForm(
  formId
) {

  const form =
    document.getElementById(
      formId
    );

  if (!form)
    return;

  form.reset();

}

function setElementValue(
  id,
  value
) {

  const el =
    document.getElementById(
      id
    );

  if (!el)
    return;

  el.value =
    value;

}

function getElementValue(
  id,
  fallback = ''
) {

  const el =
    document.getElementById(
      id
    );

  return el
    ? el.value
    : fallback;

}

function downloadTextFile(
  filename,
  content
) {

  const blob =
    new Blob(
      [content],
      {
        type: 'text/plain'
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      'a'
    );

  link.href = url;

  link.download =
    filename;

  document.body.appendChild(
    link
  );

  link.click();

  document.body.removeChild(
    link
  );

  URL.revokeObjectURL(
    url
  );

}

window.generateId =
  generateId;

window.formatCurrency =
  formatCurrency;

window.safeNumber =
  safeNumber;

window.sanitizeText =
  sanitizeText;

window.showNotification =
  showNotification;

window.openModal =
  openModal;

window.closeModal =
  closeModal;

window.clearForm =
  clearForm;

window.setElementValue =
  setElementValue;

window.getElementValue =
  getElementValue;

window.downloadTextFile =
  downloadTextFile;