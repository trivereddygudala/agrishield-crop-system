"""
Core infrastructure exceptions for AgriShield.
"""

class DatabaseUnavailableException(Exception):
    """
    Raised when the MongoDB database service is unavailable, unreachable,
    or cannot be initialized. Represents infrastructure failure, not business logic errors.
    """
    def __init__(self, message: str = "Database service is temporarily unavailable. Please retry in a few moments."):
        self.message = message
        super().__init__(self.message)
