(function () {
  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDate(d) {
    if (!d) {
      return "-";
    }
    var date = new Date(d);
    return date.toLocaleDateString();
  }

  function formatDateTime(d) {
    if (!d) {
      return "-";
    }
    var date = new Date(d);
    return date.toLocaleString();
  }

  function formatBytes(size) {
    if (!size && size !== 0) {
      return "-";
    }
    if (size < 1024) {
      return size + " B";
    }
    if (size < 1024 * 1024) {
      return (size / 1024).toFixed(1) + " KB";
    }
    return (size / (1024 * 1024)).toFixed(1) + " MB";
  }

  function slugStatus(status) {
    if (status === "On track") {
      return "on-track";
    }
    if (status === "At risk") {
      return "at-risk";
    }
    return "behind";
  }

  function statusBadge(status) {
    return '<span class="badge ' + slugStatus(status) + '">' + escapeHtml(status) + "</span>";
  }

  function toast(message) {
    var el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    var root = document.getElementById("toast-container");
    root.appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 3000);
  }

  function openModal(title, bodyHtml, footerHtml) {
    var root = document.getElementById("modal-root");
    root.innerHTML = '<div class="modal-backdrop" id="modal-close-target"><div class="modal"><div class="row" style="justify-content:space-between"><h3 style="margin:0">' +
      escapeHtml(title) +
      '</h3><button class="btn small" id="modal-x">Close</button></div><div style="margin-top:10px">' +
      bodyHtml +
      '</div><div class="row" style="justify-content:flex-end;margin-top:12px">' +
      (footerHtml || "") +
      "</div></div></div>";

    var closer = function (event) {
      if (event.target.id === "modal-close-target" || event.target.id === "modal-x") {
        closeModal();
      }
    };

    root.querySelector(".modal-backdrop").addEventListener("click", closer);
  }

  function closeModal() {
    var root = document.getElementById("modal-root");
    root.innerHTML = "";
  }

  function iconCheck() {
    return '<svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M16.7 5.3l-8 8-3.4-3.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  }

  function iconLink() {
    return '<svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M8 12l4-4m-6 1l-2 2a3 3 0 104 4l2-2m2-6l2-2a3 3 0 10-4-4L8 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  }

  window.UI = {
    escapeHtml: escapeHtml,
    formatDate: formatDate,
    formatDateTime: formatDateTime,
    formatBytes: formatBytes,
    statusBadge: statusBadge,
    toast: toast,
    openModal: openModal,
    closeModal: closeModal,
    iconCheck: iconCheck,
    iconLink: iconLink
  };
})();
