"""No-Torch feed ranker unit tests."""
from app.main import Affinity, Candidate, score_candidate


def test_preferred_genre_boosts():
    aff = Affinity(preferredGenres=["gospel"])
    a = Candidate(id="1", genre="gospel", likeCount=10)
    b = Candidate(id="2", genre="pop", likeCount=10)
    assert score_candidate(a, aff) > score_candidate(b, aff)


def test_skip_penalizes():
    aff = Affinity(skippedIds=["x"])
    a = Candidate(id="x", likeCount=100)
    b = Candidate(id="y", likeCount=10)
    assert score_candidate(a, aff) < score_candidate(b, aff)
