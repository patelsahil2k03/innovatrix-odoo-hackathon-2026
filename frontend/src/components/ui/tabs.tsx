"use client";

import { useState, type ReactNode } from "react";

export interface TabDef {
  id: string;
  label: string;
  content: ReactNode;
}

export function Tabs({ tabs }: { tabs: TabDef[] }) {
  const [activeId, setActiveId] = useState(tabs[0]?.id);

  return (
    <div>
      <div className="tabs">
        {tabs.map((tab) => (
          <a
            key={tab.id}
            href="#"
            className={`tab ${activeId === tab.id ? "is-active" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              setActiveId(tab.id);
            }}
          >
            {tab.label}
          </a>
        ))}
      </div>
      {tabs.map((tab) => (
        <div key={tab.id} className={`tab-panel ${activeId === tab.id ? "is-active" : ""}`}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}
