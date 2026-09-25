import os
import subprocess
from PIL import Image

BRAIN_DIR = r"C:\Users\trive\.gemini\antigravity-ide\brain\52f96157-6e3e-4cb8-8619-0ad25b3aa085"
SCRATCH_DIR = os.path.join(BRAIN_DIR, "scratch")
os.makedirs(SCRATCH_DIR, exist_ok=True)

EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

# HTML for Option 4: Dual-Tab Google Messages Hybrid
HTML_OPT4 = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=430, initial-scale=1.0">
<title>Option 4 - Dual-Tab Google Messages</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
  html, body {
    width: 430px;
    height: 932px;
    background-color: #0d1117;
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #f1f5f9;
    overflow: hidden;
  }
  .phone-frame {
    width: 430px;
    height: 932px;
    background: #0d1117;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  /* Status Bar */
  .status-bar {
    height: 48px;
    padding: 0 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 14px;
    font-weight: 600;
    color: #e2e8f0;
  }
  .dynamic-island {
    width: 120px;
    height: 32px;
    background: #000;
    border-radius: 20px;
  }
  /* Top App Bar */
  .top-app-bar {
    padding: 8px 20px 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .brand-badge {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .brand-logo {
    width: 38px;
    height: 38px;
    background: linear-gradient(135deg, #10b981, #059669);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
  }
  .brand-title {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.5px;
    color: #ffffff;
  }
  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .icon-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #161b22;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255,255,255,0.07);
    color: #94a3b8;
  }
  .profile-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    border: 2px solid #10b981;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 15px;
    color: #fff;
  }

  /* Dual Segmented Tabs (Google Messages Hybrid) */
  .segmented-tabs-container {
    padding: 0 20px 14px;
  }
  .segmented-tabs {
    display: flex;
    background: #161b22;
    padding: 4px;
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.06);
    gap: 4px;
  }
  .tab-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 12px;
    font-size: 13.5px;
    font-weight: 700;
    border: none;
    cursor: pointer;
  }
  .tab-btn.active {
    background: linear-gradient(135deg, #10b981, #059669);
    color: #ffffff;
    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
  }
  .tab-btn.inactive {
    background: transparent;
    color: #94a3b8;
  }
  .tab-badge {
    padding: 2px 7px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 800;
  }
  .tab-btn.active .tab-badge {
    background: rgba(255,255,255,0.25);
    color: #ffffff;
  }
  .tab-btn.inactive .tab-badge {
    background: #21262d;
    color: #8b949e;
  }

  /* Search Pill Bar */
  .search-pill {
    margin: 0 20px 12px;
    background: #161b22;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 24px;
    padding: 10px 18px;
    display: flex;
    align-items: center;
    gap: 12px;
    color: #8b949e;
    font-size: 14px;
  }

  /* Conversation Thread List */
  .thread-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .thread-item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 14px;
    border-radius: 16px;
    transition: background 0.2s;
    background: transparent;
    cursor: pointer;
  }
  .thread-item.active-item {
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.15);
  }
  .avatar-wrapper {
    position: relative;
    flex-shrink: 0;
  }
  .avatar-circle {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    color: #fff;
    font-weight: 700;
  }
  .online-dot {
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #10b981;
    border: 2.5px solid #0d1117;
  }
  .thread-content {
    flex: 1;
    min-width: 0;
  }
  .thread-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }
  .sender-name {
    font-size: 15.5px;
    font-weight: 700;
    color: #ffffff;
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .verified-badge {
    width: 16px;
    height: 16px;
    background: #10b981;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 10px;
    font-weight: 900;
  }
  .timestamp {
    font-size: 12px;
    color: #8b949e;
    font-weight: 500;
    flex-shrink: 0;
  }
  .thread-snippet-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .thread-snippet {
    font-size: 13.5px;
    color: #94a3b8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .snippet-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 8px;
    font-size: 11.5px;
    font-weight: 700;
  }
  .chip-audio {
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }
  .chip-gps {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }
  .unread-badge {
    width: 20px;
    height: 20px;
    background: #10b981;
    color: #ffffff;
    border-radius: 50%;
    font-size: 11px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4);
  }

  /* Floating Action Button */
  .fab-button {
    position: absolute;
    bottom: 96px;
    right: 22px;
    background: linear-gradient(135deg, #10b981, #059669);
    color: #ffffff;
    padding: 14px 22px;
    border-radius: 28px;
    font-size: 14.5px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 10px 25px rgba(16, 185, 129, 0.45);
    border: 1px solid rgba(255,255,255,0.2);
    cursor: pointer;
  }

  /* Bottom Navigation Bar */
  .bottom-nav {
    height: 78px;
    background: #161b22;
    border-top: 1px solid rgba(255,255,255,0.06);
    display: flex;
    justify-content: space-around;
    align-items: center;
    padding-bottom: 12px;
  }
  .nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    color: #8b949e;
    font-size: 11px;
    font-weight: 600;
  }
  .nav-item.active {
    color: #10b981;
  }
  .nav-icon {
    font-size: 20px;
  }
</style>
</head>
<body>
<div class="phone-frame">
  <!-- Status Bar -->
  <div class="status-bar">
    <span>9:41</span>
    <div class="dynamic-island"></div>
    <div style="display:flex; gap:6px; align-items:center;">
      <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3C7.5 3 3.7 4.9 1 8l11 13 11-13c-2.7-3.1-6.5-5-11-5z"/></svg>
      <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M16 4h-2V2h-4v2H8C6.9 4 6 4.9 6 6v14c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z"/></svg>
    </div>
  </div>

  <!-- Top App Bar -->
  <div class="top-app-bar">
    <div class="brand-badge">
      <div class="brand-logo">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
          <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
        </svg>
      </div>
      <div>
        <div class="brand-title">AgriShield</div>
      </div>
    </div>
    <div class="header-actions">
      <div class="icon-btn">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>
      </div>
      <div class="profile-avatar">TR</div>
    </div>
  </div>

  <!-- Dual Segmented Tabs (Google Messages Hybrid) -->
  <div class="segmented-tabs-container">
    <div class="segmented-tabs">
      <button class="tab-btn active">
        <span>💬 Provider Chats</span>
        <span class="tab-badge">2</span>
      </button>
      <button class="tab-btn inactive">
        <span>🔔 Field Alerts</span>
        <span class="tab-badge">15</span>
      </button>
    </div>
  </div>

  <!-- Search Pill Bar -->
  <div class="search-pill">
    <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
    </svg>
    <span>Search provider chats & equipment...</span>
  </div>

  <!-- Conversation Thread List -->
  <div class="thread-list">
    <!-- Item 1: Ramesh Farm Services -->
    <div class="thread-item active-item">
      <div class="avatar-wrapper">
        <div class="avatar-circle" style="background: linear-gradient(135deg, #10b981, #047857);">
          🚜
        </div>
        <div class="online-dot"></div>
      </div>
      <div class="thread-content">
        <div class="thread-header">
          <div class="sender-name">
            <span>Ramesh Farm Services</span>
            <span class="verified-badge">✓</span>
          </div>
          <span class="timestamp" style="color: #34d399; font-weight:700;">9:15 AM</span>
        </div>
        <div class="thread-snippet-row">
          <div class="thread-snippet">
            <span class="snippet-chip chip-audio">🎙️ 0:14</span>
            <span style="color: #f1f5f9; font-weight: 500;">Saw location, tractor reaching in 10m</span>
          </div>
          <div class="unread-badge">1</div>
        </div>
      </div>
    </div>

    <!-- Item 2: Precision Spray Hub -->
    <div class="thread-item">
      <div class="avatar-wrapper">
        <div class="avatar-circle" style="background: linear-gradient(135deg, #0284c7, #0369a1);">
          🚁
        </div>
        <div class="online-dot"></div>
      </div>
      <div class="thread-content">
        <div class="thread-header">
          <div class="sender-name">
            <span>Precision Spray Hub</span>
            <span class="verified-badge">✓</span>
          </div>
          <span class="timestamp">11:30 AM</span>
        </div>
        <div class="thread-snippet-row">
          <div class="thread-snippet">
            <span class="snippet-chip chip-gps">📍 GPS</span>
            <span>Plot #3 chilli drone spraying confirmed</span>
          </div>
          <div class="unread-badge">1</div>
        </div>
      </div>
    </div>

    <!-- Item 3: Balaji Harvester Hub -->
    <div class="thread-item">
      <div class="avatar-wrapper">
        <div class="avatar-circle" style="background: linear-gradient(135deg, #d97706, #b45309);">
          🌾
        </div>
      </div>
      <div class="thread-content">
        <div class="thread-header">
          <div class="sender-name">
            <span>Balaji Harvester Hub</span>
          </div>
          <span class="timestamp">Yesterday</span>
        </div>
        <div class="thread-snippet-row">
          <div class="thread-snippet">
            <span>Paddy harvester scheduled for tomorrow 6 AM</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Item 4: Sri Sai Solar Irrigation -->
    <div class="thread-item">
      <div class="avatar-wrapper">
        <div class="avatar-circle" style="background: linear-gradient(135deg, #059669, #065f46);">
          💧
        </div>
      </div>
      <div class="thread-content">
        <div class="thread-header">
          <div class="sender-name">
            <span>Sri Sai Solar Irrigation</span>
          </div>
          <span class="timestamp">Sep 23</span>
        </div>
        <div class="thread-snippet-row">
          <div class="thread-snippet">
            <span>Solar pump installation check scheduled</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Item 5: AgriShield Helpdesk -->
    <div class="thread-item">
      <div class="avatar-wrapper">
        <div class="avatar-circle" style="background: linear-gradient(135deg, #8b5cf6, #6d28d9);">
          🛡️
        </div>
      </div>
      <div class="thread-content">
        <div class="thread-header">
          <div class="sender-name">
            <span>AgriShield Support Desk</span>
          </div>
          <span class="timestamp">Sep 21</span>
        </div>
        <div class="thread-snippet-row">
          <div class="thread-snippet">
            <span>Ticket #8841 has been resolved by Admin</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Floating Action Button -->
  <div class="fab-button">
    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
      <path d="M12 4v16m8-8H4"></path>
    </svg>
    <span>New Booking</span>
  </div>

  <!-- Bottom Navigation Bar -->
  <div class="bottom-nav">
    <div class="nav-item">
      <span class="nav-icon">🏠</span>
      <span>Home</span>
    </div>
    <div class="nav-item">
      <span class="nav-icon">🗺️</span>
      <span>Field</span>
    </div>
    <div class="nav-item">
      <span class="nav-icon">📷</span>
      <span>Scan</span>
    </div>
    <div class="nav-item active">
      <span class="nav-icon">💬</span>
      <span>Chats</span>
    </div>
    <div class="nav-item">
      <span class="nav-icon">⚙️</span>
      <span>More</span>
    </div>
  </div>
</div>
</body>
</html>
"""

# HTML for Option 5: High-Legibility Rural Farmer Edition (Bilingual Telugu + English)
HTML_OPT5 = """<!DOCTYPE html>
<html lang="te">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=430, initial-scale=1.0">
<title>Option 5 - Rural Farmer Bilingual Edition</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Noto+Sans+Telugu:wght@500;600;700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
  html, body {
    width: 430px;
    height: 932px;
    background-color: #0f172a;
    font-family: 'Noto Sans Telugu', 'Plus Jakarta Sans', sans-serif;
    color: #f8fafc;
    overflow: hidden;
  }
  .phone-frame {
    width: 430px;
    height: 932px;
    background: #0f172a;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  /* Status Bar */
  .status-bar {
    height: 48px;
    padding: 0 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 14px;
    font-weight: 700;
    color: #e2e8f0;
  }
  .dynamic-island {
    width: 120px;
    height: 32px;
    background: #000;
    border-radius: 20px;
  }
  /* Top App Bar */
  .top-app-bar {
    padding: 10px 20px 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #1e293b;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .brand-badge {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .brand-logo {
    width: 42px;
    height: 42px;
    background: linear-gradient(135deg, #10b981, #047857);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
  }
  .brand-title {
    font-size: 19px;
    font-weight: 800;
    color: #ffffff;
    line-height: 1.2;
  }
  .brand-subtitle {
    font-size: 12px;
    color: #94a3b8;
    font-weight: 600;
  }
  .profile-circle {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: #334155;
    border: 2px solid #10b981;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 15px;
    color: #38bdf8;
  }

  /* Quick Category Chips */
  .category-chips-bar {
    padding: 12px 18px;
    display: flex;
    gap: 8px;
    overflow-x: auto;
    background: #0f172a;
  }
  .filter-chip {
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 13.5px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
    border: 1px solid rgba(255,255,255,0.08);
  }
  .filter-chip.active {
    background: #10b981;
    color: #ffffff;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
    border-color: transparent;
  }
  .filter-chip.inactive {
    background: #1e293b;
    color: #94a3b8;
  }

  /* Rural Thread List with Extra-Large Touch Targets */
  .thread-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .thread-card {
    background: #1e293b;
    border-radius: 18px;
    padding: 14px 16px;
    border: 1px solid rgba(255,255,255,0.06);
    display: flex;
    gap: 14px;
    align-items: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  }
  .thread-card.highlight {
    border-color: rgba(16, 185, 129, 0.35);
    background: linear-gradient(180deg, #1e293b 0%, #172554 100%);
  }
  .avatar-large {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26px;
    flex-shrink: 0;
  }
  .card-body {
    flex: 1;
    min-width: 0;
  }
  .card-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 2px;
  }
  .card-name-te {
    font-size: 16px;
    font-weight: 800;
    color: #ffffff;
    line-height: 1.3;
  }
  .card-name-en {
    font-size: 12.5px;
    color: #94a3b8;
    font-weight: 600;
    margin-bottom: 4px;
  }
  .card-snippet {
    font-size: 13.5px;
    color: #cbd5e1;
    font-weight: 500;
    line-height: 1.3;
  }
  .time-text {
    font-size: 12px;
    font-weight: 700;
    color: #94a3b8;
  }
  /* Call / Action Button Right */
  .card-action-side {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    flex-shrink: 0;
  }
  .call-btn {
    background: #0284c7;
    color: #ffffff;
    padding: 6px 12px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 4px;
    border: none;
    box-shadow: 0 2px 6px rgba(2, 132, 199, 0.35);
  }
  .unread-pill {
    background: #10b981;
    color: #ffffff;
    font-size: 11px;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: 10px;
  }

  /* Bottom Navigation Bar */
  .bottom-nav {
    height: 78px;
    background: #1e293b;
    border-top: 1px solid rgba(255,255,255,0.06);
    display: flex;
    justify-content: space-around;
    align-items: center;
    padding-bottom: 12px;
  }
  .nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 700;
  }
  .nav-item.active {
    color: #10b981;
  }
  .nav-icon {
    font-size: 20px;
  }
</style>
</head>
<body>
<div class="phone-frame">
  <!-- Status Bar -->
  <div class="status-bar">
    <span>9:41</span>
    <div class="dynamic-island"></div>
    <div style="display:flex; gap:6px; align-items:center;">
      <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3C7.5 3 3.7 4.9 1 8l11 13 11-13c-2.7-3.1-6.5-5-11-5z"/></svg>
      <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M16 4h-2V2h-4v2H8C6.9 4 6 4.9 6 6v14c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z"/></svg>
    </div>
  </div>

  <!-- Top App Bar -->
  <div class="top-app-bar">
    <div class="brand-badge">
      <div class="brand-logo">🌾</div>
      <div>
        <div class="brand-title">సందేశాలు & హెచ్చరికలు</div>
        <div class="brand-subtitle">AgriShield Notifications & Messages</div>
      </div>
    </div>
    <div class="profile-circle">రైతు</div>
  </div>

  <!-- Quick Category Chips -->
  <div class="category-chips-bar">
    <div class="filter-chip active">
      <span>అన్నీ (All)</span>
    </div>
    <div class="filter-chip inactive">
      <span>🚜 యంత్రాలు (Machines)</span>
    </div>
    <div class="filter-chip inactive">
      <span>🌿 తెగుళ్లు (Diseases)</span>
    </div>
    <div class="filter-chip inactive">
      <span>🌧️ వర్షం (Weather)</span>
    </div>
  </div>

  <!-- Thread List -->
  <div class="thread-list">
    <!-- Card 1: Ramesh Farm Services -->
    <div class="thread-card highlight">
      <div class="avatar-large" style="background: linear-gradient(135deg, #10b981, #047857);">
        🚜
      </div>
      <div class="card-body">
        <div class="card-top">
          <div class="card-name-te">రమేష్ ఫార్మ్ సర్వీసెస్</div>
          <span class="time-text" style="color:#34d399;">10 నిమి</span>
        </div>
        <div class="card-name-en">Ramesh Farm Services (55HP Tractor)</div>
        <div class="card-snippet">
          🎙️ డ్రైవర్ 9:15 AMకి పొలానికి వస్తున్నాడు
        </div>
      </div>
      <div class="card-action-side">
        <span class="unread-pill">1 కొత్తది</span>
        <button class="call-btn">📞 కాల్</button>
      </div>
    </div>

    <!-- Card 2: Crop Disease Alert -->
    <div class="thread-card">
      <div class="avatar-large" style="background: linear-gradient(135deg, #f59e0b, #b45309);">
        ⚠️
      </div>
      <div class="card-body">
        <div class="card-top">
          <div class="card-name-te">పంట వ్యాధి హెచ్చరిక</div>
          <span class="time-text">15 నిమి</span>
        </div>
        <div class="card-name-en">Crop Health Alert - Pasupugallu</div>
        <div class="card-snippet">
          టమోటా ప్లాట్ #2 లో లేట్ బ్లైట్ తెగులు గుర్తింపు
        </div>
      </div>
      <div class="card-action-side">
        <span class="unread-pill" style="background:#ef4444;">అత్యవసరం</span>
      </div>
    </div>

    <!-- Card 3: Weather Rain Forecast -->
    <div class="thread-card">
      <div class="avatar-large" style="background: linear-gradient(135deg, #0284c7, #0369a1);">
        🌧️
      </div>
      <div class="card-body">
        <div class="card-top">
          <div class="card-name-te">భారీ వర్ష సూచన</div>
          <span class="time-text">1 గంట</span>
        </div>
        <div class="card-name-en">Weather Alert - Heavy Rain Forecast</div>
        <div class="card-snippet">
          రాబోయే 3 గంటల్లో మీ మండలంలో వర్షం కురిసే అవకాశం
        </div>
      </div>
      <div class="card-action-side">
        <span style="font-size:11px; color:#94a3b8; font-weight:700;">సూచన</span>
      </div>
    </div>

    <!-- Card 4: Balaji Harvester Hub -->
    <div class="thread-card">
      <div class="avatar-large" style="background: linear-gradient(135deg, #8b5cf6, #6d28d9);">
        🌾
      </div>
      <div class="card-body">
        <div class="card-top">
          <div class="card-name-te">బాలాజీ హార్వెస్టర్ హబ్</div>
          <span class="time-text">నిన్న</span>
        </div>
        <div class="card-name-en">Balaji Harvester Hub (Paddy Harvester)</div>
        <div class="card-snippet">
          రేపు ఉదయం 6:00కి వరి కోత మిషన్ సిద్ధంగా ఉంటుంది
        </div>
      </div>
      <div class="card-action-side">
        <button class="call-btn">📞 కాల్</button>
      </div>
    </div>
  </div>

  <!-- Bottom Navigation Bar -->
  <div class="bottom-nav">
    <div class="nav-item">
      <span class="nav-icon">🏠</span>
      <span>హోమ్</span>
    </div>
    <div class="nav-item">
      <span class="nav-icon">🗺️</span>
      <span>పొలం</span>
    </div>
    <div class="nav-item">
      <span class="nav-icon">📷</span>
      <span>స్కాన్</span>
    </div>
    <div class="nav-item active">
      <span class="nav-icon">🔔</span>
      <span>హెచ్చరికలు</span>
    </div>
    <div class="nav-item">
      <span class="nav-icon">⚙️</span>
      <span>ఇతర</span>
    </div>
  </div>
</div>
</body>
</html>
"""

def render_mockups():
    opt4_html_path = os.path.join(SCRATCH_DIR, "opt4.html")
    opt5_html_path = os.path.join(SCRATCH_DIR, "opt5.html")
    
    with open(opt4_html_path, "w", encoding="utf-8") as f:
        f.write(HTML_OPT4)
    with open(opt5_html_path, "w", encoding="utf-8") as f:
        f.write(HTML_OPT5)
        
    opt4_png_path = os.path.join(SCRATCH_DIR, "opt4.png")
    opt5_png_path = os.path.join(SCRATCH_DIR, "opt5.png")
    
    opt4_jpg_path = os.path.join(BRAIN_DIR, "notif_ui_opt4.jpg")
    opt5_jpg_path = os.path.join(BRAIN_DIR, "notif_ui_opt5.jpg")
    
    print("Rendering Option 4...")
    cmd4 = [
        EDGE_PATH,
        "--headless=new",
        f"--screenshot={opt4_png_path}",
        "--window-size=500,1000",
        "--hide-scrollbars",
        f"file:///{opt4_html_path.replace(os.sep, '/')}"
    ]
    subprocess.run(cmd4, check=True)
    
    print("Rendering Option 5...")
    cmd5 = [
        EDGE_PATH,
        "--headless=new",
        f"--screenshot={opt5_png_path}",
        "--window-size=500,1000",
        "--hide-scrollbars",
        f"file:///{opt5_html_path.replace(os.sep, '/')}"
    ]
    subprocess.run(cmd5, check=True)
    
    # Crop exact 430x932 and convert PNG to high-quality JPG
    if os.path.exists(opt4_png_path):
        img4 = Image.open(opt4_png_path).convert("RGB")
        # crop (0, 0, 430, 932)
        img4_cropped = img4.crop((0, 0, 430, 932))
        img4_cropped.save(opt4_jpg_path, "JPEG", quality=95)
        print(f"Saved: {opt4_jpg_path} ({os.path.getsize(opt4_jpg_path)} bytes)")
        
    if os.path.exists(opt5_png_path):
        img5 = Image.open(opt5_png_path).convert("RGB")
        img5_cropped = img5.crop((0, 0, 430, 932))
        img5_cropped.save(opt5_jpg_path, "JPEG", quality=95)
        print(f"Saved: {opt5_jpg_path} ({os.path.getsize(opt5_jpg_path)} bytes)")

if __name__ == "__main__":
    render_mockups()
