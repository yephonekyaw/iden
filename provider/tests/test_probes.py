"""Liveness and readiness — two questions with different consequences."""

from redis.exceptions import RedisError


class TestProbes:
    async def test_liveness_is_independent_of_readiness(
        self, client, catalogue, redis, monkeypatch
    ):
        """A liveness probe that fails on a database outage restart-loops the
        whole fleet while the database recovers. Same request, same broken
        dependency, two different answers — that is the whole point of the split.
        """
        monkeypatch.setattr(redis, "ping", _raising(RedisError("down")))

        assert (await client.get("/health/ready")).status_code == 503

        live = await client.get("/health/live")
        assert live.status_code == 200
        assert live.json()["status"] == "alive"

    async def test_readiness_is_200_when_everything_answers(self, client, catalogue):
        response = await client.get("/health/ready")

        assert response.status_code == 200
        assert response.json() == {"status": "ok", "database": "ok", "redis": "ok"}

    async def test_readiness_reports_which_dependency_failed(
        self, client, catalogue, redis, monkeypatch
    ):
        """The status code is the contract — a load balancer drains the replica
        without parsing the body — but the body is what a human needs."""
        monkeypatch.setattr(redis, "ping", _raising(RedisError("down")))

        response = await client.get("/health/ready")
        assert response.status_code == 503
        assert response.json() == {
            "status": "degraded",
            "database": "ok",
            "redis": "unreachable",
        }

    async def test_health_stays_200_when_a_dependency_is_down(
        self, client, catalogue, redis, monkeypatch
    ):
        """`/health` is for a human reading the body: it distinguishes *the
        service is down* from *the service is up and telling you why*."""
        monkeypatch.setattr(redis, "ping", _raising(RedisError("down")))

        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "degraded"


def _raising(exc: Exception):
    async def fail(*args, **kwargs):
        raise exc

    return fail
