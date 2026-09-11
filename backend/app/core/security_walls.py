import time
import re
import hmac
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple, Set
import logging

from backend.app.db.mongodb import get_database
from backend.app.core.audit_logger import log_security_event

logger = logging.getLogger("security_walls")

# ─────────────────────────────────────────────────────────────
# Wall 1: Honeypot Decoy Trap Registry
# ─────────────────────────────────────────────────────────────
# Routes that only automated vulnerability scanners and malicious bots probe.
# Legitimate farmers and frontend applications will never access these paths.
HONEYPOT_PROBES: Set[str] = {
    "/.env",
    "/.env.backup",
    "/.env.local",
    "/.git",
    "/.git/config",
    "/wp-admin",
    "/wp-login.php",
    "/wp-content",
    "/xmlrpc.php",
    "/phpmyadmin",
    "/pma",
    "/mysql",
    "/admin.php",
    "/config.json",
    "/backup.sql",
    "/dump.sql",
    "/.aws/credentials",
    "/id_rsa",
    "/.ssh/id_rsa",
    "/server-status",
    "/actuator/health",
    "/solr",
    "/vendor/phpunit",
    "/eval-stdin.php"
}

# Whitelist for local development and private network ranges
TRUSTED_IPS: Set[str] = {
    "127.0.0.1",
    "::1",
    "localhost",
    "testclient"
}

def is_trusted_ip(ip: str) -> bool:
    """Check if IP is local, loopback, or private development subnet."""
    if not ip or ip in TRUSTED_IPS:
        return True
    if ip.startswith("127.") or ip.startswith("192.168.") or ip.startswith("10."):
        return True
    return False

def is_honeypot_path(path: str) -> bool:
    """Returns True if the requested URL path is a known hacker honeypot trap."""
    if not path:
        return False
    normalized = path.lower().rstrip("/")
    if normalized in HONEYPOT_PROBES or any(normalized.startswith(trap) for trap in HONEYPOT_PROBES):
        return True
    return False


# ─────────────────────────────────────────────────────────────
# Wall 2: Adaptive IP Jail & Auto-Ban Engine
# ─────────────────────────────────────────────────────────────
# In-memory fast lookup cache: ip -> { "reason": str, "banned_at": float, "expires_at": float, "strikes": int }
_JAILED_IPS: Dict[str, dict] = {}

# Failed login attempt tracking (Farmer-Friendly): ip -> list of attempt timestamps
_LOGIN_ATTEMPTS: Dict[str, List[float]] = {}

# Soft cooldown tracking: ip -> cooldown_expires_timestamp
_LOGIN_COOLDOWNS: Dict[str, float] = {}

# Malicious payload strike counter: ip -> list of violation timestamps
_MALICIOUS_STRIKES: Dict[str, List[float]] = {}


def is_ip_jailed(ip: str) -> Tuple[bool, Optional[str], Optional[float]]:
    """
    Check if an IP address is currently jailed.
    Returns (is_jailed, reason, remaining_seconds).
    """
    if is_trusted_ip(ip):
        return False, None, None

    now = time.time()
    jail_info = _JAILED_IPS.get(ip)
    if jail_info:
        if now < jail_info["expires_at"]:
            remaining = jail_info["expires_at"] - now
            return True, jail_info["reason"], remaining
        else:
            # Ban expired, release from jail
            del _JAILED_IPS[ip]

    return False, None, None


async def jail_ip(ip: str, reason: str, duration_hours: float = 24.0):
    """Jail an attacker's IP address and persist the ban record to MongoDB."""
    if is_trusted_ip(ip):
        return

    now = time.time()
    expires_at = now + (duration_hours * 3600)
    
    _JAILED_IPS[ip] = {
        "ip": ip,
        "reason": reason,
        "banned_at": now,
        "expires_at": expires_at,
        "duration_hours": duration_hours,
        "banned_at_iso": datetime.now(timezone.utc).isoformat(),
        "expires_at_iso": (datetime.now(timezone.utc) + timedelta(hours=duration_hours)).isoformat()
    }

    log_security_event("IP_JAILED", {
        "ip": ip,
        "reason": reason,
        "duration_hours": duration_hours
    }, level="WARNING", client_ip=ip)

    # Persist to database asynchronously
    try:
        db = await get_database()
        await db.security_banned_ips.update_one(
            {"ip": ip},
            {"$set": {
                "ip": ip,
                "reason": reason,
                "banned_at": datetime.now(timezone.utc),
                "expires_at": datetime.now(timezone.utc) + timedelta(hours=duration_hours),
                "active": True
            }},
            upsert=True
        )
    except Exception as e:
        logger.warning(f"Could not persist banned IP {ip} to MongoDB: {e}")


async def unban_ip(ip: str) -> bool:
    """Manually unban an IP address from both memory and database."""
    unbanned = False
    if ip in _JAILED_IPS:
        del _JAILED_IPS[ip]
        unbanned = True

    try:
        db = await get_database()
        res = await db.security_banned_ips.update_many(
            {"ip": ip},
            {"$set": {"active": False, "unbanned_at": datetime.now(timezone.utc)}}
        )
        if res.modified_count > 0:
            unbanned = True
    except Exception as e:
        logger.warning(f"Could not update unban in MongoDB: {e}")

    log_security_event("IP_UNBANNED", {"ip": ip}, level="INFO")
    return unbanned


async def sync_banned_ips_from_db():
    """Sync active bans from MongoDB into memory on startup."""
    try:
        db = await get_database()
        now_dt = datetime.now(timezone.utc)
        cursor = db.security_banned_ips.find({"active": True, "expires_at": {"$gt": now_dt}})
        docs = await cursor.to_list(500)
        now = time.time()
        for doc in docs:
            exp_dt = doc.get("expires_at")
            if exp_dt:
                exp_timestamp = exp_dt.replace(tzinfo=timezone.utc).timestamp() if exp_dt.tzinfo is None else exp_dt.timestamp()
                if exp_timestamp > now:
                    _JAILED_IPS[doc["ip"]] = {
                        "ip": doc["ip"],
                        "reason": doc.get("reason", "Administrative Security Ban"),
                        "banned_at": now,
                        "expires_at": exp_timestamp,
                        "duration_hours": max(1.0, (exp_timestamp - now) / 3600),
                        "banned_at_iso": doc.get("banned_at", now_dt).isoformat(),
                        "expires_at_iso": exp_dt.isoformat()
                    }
    except Exception as e:
        logger.warning(f"Could not sync banned IPs from DB: {e}")


def check_login_cooldown(ip: str) -> Tuple[bool, int]:
    """
    Farmer-Friendly Login Cooldown Check:
    Checks if this IP is in a soft cooldown. Returns (in_cooldown, remaining_seconds).
    Does NOT ban the IP.
    """
    if is_trusted_ip(ip):
        return False, 0

    now = time.time()
    cooldown_expiry = _LOGIN_COOLDOWNS.get(ip, 0)
    if now < cooldown_expiry:
        remaining = int(cooldown_expiry - now)
        return True, max(1, remaining)
    elif ip in _LOGIN_COOLDOWNS:
        del _LOGIN_COOLDOWNS[ip]

    return False, 0


def record_failed_login(ip: str) -> Tuple[bool, int]:
    """
    Record a failed login attempt.
    If >= 5 failed attempts in 5 minutes, triggers a 60-second soft cooldown (NOT a permanent ban).
    Returns (cooldown_triggered, remaining_seconds).
    """
    if is_trusted_ip(ip):
        return False, 0

    now = time.time()
    cutoff = now - 300 # 5 minute sliding window
    attempts = _LOGIN_ATTEMPTS.setdefault(ip, [])
    attempts = [t for t in attempts if t > cutoff]
    attempts.append(now)
    _LOGIN_ATTEMPTS[ip] = attempts

    if len(attempts) >= 5:
        # Trigger gentle 60-second cooldown for farmer safety
        _LOGIN_COOLDOWNS[ip] = now + 60
        _LOGIN_ATTEMPTS[ip] = [] # Reset window
        log_security_event("LOGIN_SOFT_COOLDOWN_TRIGGERED", {"ip": ip, "attempts": 5}, level="WARNING", client_ip=ip)
        return True, 60

    return False, 0


def record_successful_login(ip: str):
    """Clear failed login attempts upon valid farmer login."""
    if ip in _LOGIN_ATTEMPTS:
        del _LOGIN_ATTEMPTS[ip]
    if ip in _LOGIN_COOLDOWNS:
        del _LOGIN_COOLDOWNS[ip]


# ─────────────────────────────────────────────────────────────
# Wall 3: Deep Request Inspection WAF (Web Application Firewall)
# ─────────────────────────────────────────────────────────────
DANGEROUS_PAYLOAD_PATTERNS = [
    # Path Traversal
    (re.compile(r"(\.\./|\.\.\\|%2e%2e%2f|%2e%2e\/)", re.IGNORECASE), "Path Traversal Attack Attempt"),
    # Shell Command Injection
    (re.compile(r"(;\s*(cat|rm|ls|id|whoami|chmod|chown|kill|wget|curl)\b|\|\s*(cat|ls|id|whoami|sh|bash)\b|`.*?`|\$\(id\))", re.IGNORECASE), "Command Injection Pattern Detected"),
    # Common NoSQL / Mongo operators in unparsed queries
    (re.compile(r"(\$where|\$regex|\$ne|\$gt|\$nin)\s*:", re.IGNORECASE), "NoSQL Injection Pattern Detected"),
    # High-risk XSS injection
    (re.compile(r"(<script\b|javascript\s*:|vbscript\s*:|onload\s*=|onerror\s*=|onclick\s*=|document\.cookie)", re.IGNORECASE), "Cross-Site Scripting (XSS) Vector Detected")
]

def inspect_for_threats(content: str) -> Optional[str]:
    """
    Scans a string (query, header, or body segment) against WAF threat signatures.
    Returns threat description if matched, or None.
    """
    if not content or len(content) < 4:
        return None
    for pattern, description in DANGEROUS_PAYLOAD_PATTERNS:
        if pattern.search(content):
            return description
    return None


async def record_malicious_strike(ip: str, threat: str):
    """
    Tracks malicious injection strikes.
    If an IP sends 3 malicious payloads within 2 minutes, auto-jails for 12 hours.
    """
    if is_trusted_ip(ip):
        return

    now = time.time()
    cutoff = now - 120 # 2 minute window
    strikes = _MALICIOUS_STRIKES.setdefault(ip, [])
    strikes = [t for t in strikes if t > cutoff]
    strikes.append(now)
    _MALICIOUS_STRIKES[ip] = strikes

    log_security_event("MALICIOUS_PAYLOAD_BLOCKED", {
        "ip": ip,
        "threat": threat,
        "strike_count": len(strikes)
    }, level="WARNING", client_ip=ip)

    if len(strikes) >= 3:
        await jail_ip(ip, reason=f"Multiple Malicious Injections: {threat}", duration_hours=12.0)


# ─────────────────────────────────────────────────────────────
# Wall 4: Ghost Bot-Trap Validator
# ─────────────────────────────────────────────────────────────
BOT_TRAP_FIELDS = {"bot_trap", "website_url", "company_fax", "hidden_trap"}

def validate_bot_trap(payload: dict, client_ip: str = "127.0.0.1") -> bool:
    """
    Inspects incoming form data for ghost honeypot fields.
    If any honeypot field has a value, it confirms an automated scraping bot.
    Returns True if safe, False if bot detected.
    """
    if not isinstance(payload, dict):
        return True

    for field in BOT_TRAP_FIELDS:
        val = payload.get(field)
        if val and str(val).strip():
            log_security_event("BOT_TRAP_TRIGGERED", {
                "field": field,
                "value": str(val)[:50],
                "ip": client_ip
            }, level="WARNING", client_ip=client_ip)
            return False

    return True


# ─────────────────────────────────────────────────────────────
# Wall 5: Cryptographic Anti-Replay Nonce & Timestamp Verification
# ─────────────────────────────────────────────────────────────
_SEEN_NONCES: Dict[str, float] = {}

def verify_anti_replay(timestamp_str: Optional[str], nonce: Optional[str], max_age_seconds: int = 90) -> bool:
    """
    Verifies that a sensitive administrative or telemetry packet has not been replayed.
    - Timestamp must be within max_age_seconds of server time.
    - Nonce must be unique and not previously seen within the validity window.
    """
    if not timestamp_str or not nonce:
        return True # Optional for standard backward-compatible calls

    try:
        ts = float(timestamp_str)
    except (ValueError, TypeError):
        return False

    now = time.time()
    # Check if timestamp is too far in the past or future (skew > max_age)
    if abs(now - ts) > max_age_seconds:
        return False

    # Check nonce cache and prune old entries
    cutoff = now - max_age_seconds
    for n in list(_SEEN_NONCES.keys()):
        if _SEEN_NONCES[n] < cutoff:
            del _SEEN_NONCES[n]

    if nonce in _SEEN_NONCES:
        return False # Replay detected!

    _SEEN_NONCES[nonce] = now
    return True


# ─────────────────────────────────────────────────────────────
# Security Walls Status Reporter (For Admin Console)
# ─────────────────────────────────────────────────────────────
def get_security_walls_status() -> dict:
    """Returns real-time operational status and metrics for all 5 security walls."""
    now = time.time()
    active_bans = [
        info for info in _JAILED_IPS.values()
        if now < info.get("expires_at", 0)
    ]
    return {
        "walls": [
            {
                "id": "wall_1",
                "name": "Honeypot Decoy Traps",
                "status": "active",
                "description": "23 scanner traps active (/.env, /wp-admin, /phpmyadmin, etc.) with 24h auto-ban.",
                "probes_monitored": len(HONEYPOT_PROBES)
            },
            {
                "id": "wall_2",
                "name": "Adaptive IP Jail & Tarpit",
                "status": "active",
                "description": "Multi-tier IP jail with persistent storage and farmer soft-cooldown guardrails.",
                "currently_jailed_count": len(active_bans)
            },
            {
                "id": "wall_3",
                "name": "Deep Request Inspection WAF",
                "status": "active",
                "description": "Layer 7 packet inspection blocking Path Traversal, NoSQL, Shell, and XSS.",
                "signatures_active": len(DANGEROUS_PAYLOAD_PATTERNS)
            },
            {
                "id": "wall_4",
                "name": "Ghost Bot Traps",
                "status": "active",
                "description": "Invisible form fields on Login, Register, and Support trapping automated headless scripts.",
                "fields_active": len(BOT_TRAP_FIELDS)
            },
            {
                "id": "wall_5",
                "name": "Cryptographic Anti-Replay Engine",
                "status": "active",
                "description": "Timestamp window & nonce validation defeating packet interception and replay attacks.",
                "replay_window_seconds": 90
            }
        ],
        "active_bans_count": len(active_bans),
        "jailed_ips": active_bans
    }
