"""
Caching utilities for reports and expensive operations.

Provides TTL-based caching with automatic expiration.
Uses in-memory cache suitable for single-instance deployments.
For production multi-instance deployments, consider Redis.
"""
import hashlib
import json
from typing import Any, Optional, Callable
from datetime import datetime, timedelta
from cachetools import TTLCache
from functools import wraps

# Global cache instances
# TTL Cache with 5 minute expiration, max 100 items
report_cache = TTLCache(maxsize=100, ttl=300)


def generate_cache_key(prefix: str, **kwargs) -> str:
    """
    Generate a unique cache key from prefix and parameters.

    Args:
        prefix: Cache key prefix (e.g., 'tickets_summary')
        **kwargs: Parameters to include in cache key

    Returns:
        MD5 hash of serialized parameters
    """
    # Sort kwargs for consistent key generation
    sorted_params = sorted(kwargs.items())
    param_string = json.dumps(sorted_params, sort_keys=True, default=str)
    hash_object = hashlib.md5(f"{prefix}:{param_string}".encode())
    return hash_object.hexdigest()


def get_cached_report(key: str) -> Optional[Any]:
    """
    Get cached report data.

    Args:
        key: Cache key

    Returns:
        Cached data or None if not found/expired
    """
    return report_cache.get(key)


def set_cached_report(key: str, data: Any) -> None:
    """
    Store report data in cache.

    Args:
        key: Cache key
        data: Data to cache
    """
    report_cache[key] = data


def clear_report_cache() -> None:
    """Clear all cached reports."""
    report_cache.clear()


def invalidate_cache_pattern(pattern: str) -> int:
    """
    Invalidate cache entries matching a pattern.

    Args:
        pattern: Pattern to match (substring)

    Returns:
        Number of entries invalidated
    """
    # Note: This requires storing keys separately since TTLCache
    # doesn't support pattern matching out of the box
    # For now, we'll clear entire cache
    # TODO: Implement pattern-based invalidation with custom cache
    count = len(report_cache)
    report_cache.clear()
    return count


def cached_report(ttl: int = 300, key_prefix: str = "report"):
    """
    Decorator for caching report endpoints.

    Args:
        ttl: Time to live in seconds (default: 300 = 5 minutes)
        key_prefix: Prefix for cache key

    Usage:
        @cached_report(ttl=600, key_prefix="tickets_summary")
        async def get_ticket_summary(...):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract relevant parameters for cache key
            # Exclude 'db' and 'current_user' from cache key
            cache_params = {
                k: v for k, v in kwargs.items()
                if k not in ['db', 'current_user'] and v is not None
            }

            # Add user context to cache key (for RBAC)
            if 'current_user' in kwargs:
                user = kwargs['current_user']
                cache_params['user_type'] = user.user_type
                if user.user_type == 'client':
                    cache_params['client_id'] = str(user.client_id)

            # Generate cache key
            cache_key = generate_cache_key(key_prefix, **cache_params)

            # Try to get from cache
            cached_data = get_cached_report(cache_key)
            if cached_data is not None:
                return cached_data

            # Execute function
            result = await func(*args, **kwargs)

            # Store in cache
            set_cached_report(cache_key, result)

            return result

        return wrapper
    return decorator


class CacheStats:
    """Cache statistics tracker."""

    def __init__(self):
        self.hits = 0
        self.misses = 0
        self.sets = 0

    def record_hit(self):
        """Record cache hit."""
        self.hits += 1

    def record_miss(self):
        """Record cache miss."""
        self.misses += 1

    def record_set(self):
        """Record cache set."""
        self.sets += 1

    def get_stats(self) -> dict:
        """Get cache statistics."""
        total = self.hits + self.misses
        hit_rate = (self.hits / total * 100) if total > 0 else 0

        return {
            "hits": self.hits,
            "misses": self.misses,
            "sets": self.sets,
            "total_requests": total,
            "hit_rate_percent": round(hit_rate, 2),
            "cache_size": len(report_cache),
            "cache_maxsize": report_cache.maxsize
        }

    def reset(self):
        """Reset statistics."""
        self.hits = 0
        self.misses = 0
        self.sets = 0


# Global cache stats instance
cache_stats = CacheStats()
