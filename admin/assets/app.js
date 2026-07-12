/* ==========================================================================
   TransitOps — shared shell behaviour (sidebar toggle, tabs, modals, badges)
   ========================================================================== */

function initShell(){
  const toggle = document.querySelector("[data-nav-toggle]");
  const sidebar = document.querySelector(".sidebar");
  if(toggle && sidebar){
    toggle.addEventListener("click", () => sidebar.classList.toggle("is-open"));
    document.addEventListener("click", (e) => {
      if(sidebar.classList.contains("is-open") && !sidebar.contains(e.target) && !toggle.contains(e.target)){
        sidebar.classList.remove("is-open");
      }
    });
  }

  // Mark active sidebar link based on current filename
  const current = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".sidebar-link").forEach(link => {
    const href = link.getAttribute("href");
    if(href === current) link.classList.add("is-active");
  });
}

function initTabs(){
  document.querySelectorAll("[data-tabs]").forEach(group => {
    const tabs = group.querySelectorAll(".tab");
    tabs.forEach(tab => {
      tab.addEventListener("click", (e) => {
        e.preventDefault();
        const targetId = tab.getAttribute("data-tab");
        tabs.forEach(t => t.classList.remove("is-active"));
        tab.classList.add("is-active");
        group.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("is-active"));
        const panel = document.getElementById(targetId);
        if(panel) panel.classList.add("is-active");
      });
    });
  });
}

function initModals(){
  document.querySelectorAll("[data-modal-open]").forEach(btn => {
    btn.addEventListener("click", () => {
      const modal = document.getElementById(btn.getAttribute("data-modal-open"));
      if(modal) modal.classList.add("is-open");
    });
  });
  document.querySelectorAll("[data-modal-close]").forEach(btn => {
    btn.addEventListener("click", () => {
      const overlay = btn.closest(".modal-overlay");
      if(overlay) overlay.classList.remove("is-open");
    });
  });
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if(e.target === overlay) overlay.classList.remove("is-open");
    });
  });
}

/* ---- Badge helpers, mapped to schema status fields ---------------------- */

const StatusBadge = {
  vehicle(status){
    const map = {
      active: ["success", "Active"],
      idle: ["neutral", "Idle"],
      maintenance: ["warning", "Maintenance"],
      retired: ["neutral", "Retired"],
    };
    const [cls, label] = map[status] || ["neutral", status];
    return `<span class="badge badge-${cls}">${label}</span>`;
  },
  driver(status){
    const map = {
      available: ["success", "Available"],
      on_trip: ["info", "On Trip"],
      suspended: ["warning", "Suspended"],
    };
    const [cls, label] = map[status] || ["neutral", status];
    return `<span class="badge badge-${cls}">${label}</span>`;
  },
  trip(status){
    const map = {
      pending: ["neutral", "Pending"],
      dispatched: ["info", "Dispatched"],
      in_transit: ["primary", "In Transit"],
      completed: ["success", "Completed"],
      cancelled: ["warning", "Cancelled"],
    };
    const [cls, label] = map[status] || ["neutral", status];
    return `<span class="badge badge-${cls}">${label}</span>`;
  },
  risk(level){
    const map = { low: ["success", "Low Risk"], medium: ["warning", "Medium Risk"], high: ["warning", "High Risk"] };
    const [cls, label] = map[level] || ["neutral", level];
    return `<span class="badge badge-${cls}">${label}</span>`;
  },
  document(status){
    const map = { valid: ["success", "Valid"], expiring: ["warning", "Expiring"], expired: ["warning", "Expired"] };
    const [cls, label] = map[status] || ["neutral", status];
    return `<span class="badge badge-${cls}">${label}</span>`;
  },
  maintenance(status){
    const map = { open: ["warning", "Open"], in_progress: ["info", "In Progress"], closed: ["success", "Closed"] };
    const [cls, label] = map[status] || ["neutral", status];
    return `<span class="badge badge-${cls}">${label}</span>`;
  },
  severity(level){
    const map = { critical: "critical", warning: "critical", info: "info", success: "success" };
    return map[level] || "info";
  },
};

function healthMeterClass(score){
  if(score >= 70) return "is-success";
  if(score >= 45) return "";
  return "is-warning";
}

function initials(name){
  return name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
}

document.addEventListener("DOMContentLoaded", () => {
  initShell();
  initTabs();
  initModals();
});
