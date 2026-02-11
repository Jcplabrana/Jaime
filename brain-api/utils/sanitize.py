"""Input sanitization utilities."""


def escape_ilike(text: str) -> str:
    """Escape SQL ILIKE wildcard characters (%, _) in user input."""
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
