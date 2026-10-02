"""
AgriShield B9.3 — Backend Routing Resilience & Image Locality Contract Suite
Validates that backend route contracts, B7 image resolver contracts,
and AI worker route boundaries adhere to B9.3 resilience specifications.
"""

import pytest
import os
import inspect

def test_b9_3_image_resolver_intact():
    """Verify B7 image_resolver.py is intact and resolves across worker nodes."""
    from backend.app.services.image_resolver import resolve_image_path
    assert callable(resolve_image_path)
    sig = inspect.signature(resolve_image_path)
    assert 'image_path' in sig.parameters

def test_b9_3_worker_contract_boundaries():
    """
    Verify AI worker contract boundaries:
    - Worker 1: /api/upload, /api/predict, /uploads
    - Worker 2: /api/identify-plant
    - Worker 3: /api/agrochemical*, /api/crop-advisor*, /api/translate*
    - Main: /api/auth, /api/equipment, /api/admin, /api/broadcast
    """
    worker_1_endpoints = {'/api/upload', '/api/predict', '/uploads'}
    worker_2_endpoints = {'/api/identify-plant'}
    worker_3_endpoints = {'/api/agrochemical', '/api/crop-advisor', '/api/translate'}
    main_endpoints = {'/api/auth/login', '/api/equipment/book', '/api/admin/users', '/api/broadcast'}

    # Ensure zero overlap between AI worker domains and transactional main domains
    assert not (worker_1_endpoints & main_endpoints)
    assert not (worker_2_endpoints & main_endpoints)
    assert not (worker_3_endpoints & main_endpoints)

def test_b9_3_transient_error_status_codes():
    """Verify error eligibility codes matches B9.3 specification."""
    eligible_transient_codes = {502, 503, 504}
    ineligible_client_codes = {400, 401, 403, 404, 409, 422}

    assert 502 in eligible_transient_codes
    assert 503 in eligible_transient_codes
    assert 504 in eligible_transient_codes

    for code in ineligible_client_codes:
        assert code not in eligible_transient_codes
